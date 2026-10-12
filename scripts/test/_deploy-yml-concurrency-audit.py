#!/usr/bin/env python3
"""Offline structural audit of .github/workflows/deploy.yml.

Guards against the class of `Invalid workflow file` / `Unrecognized
named-value` parse errors that GitHub only reports after a push.

Checks:
  1. YAML parses.
  2. No workflow-level `concurrency:` block.
  3. No `matrix.` reference anywhere in non-comment code (the workflow
     has no matrix; `matrix` is not allowed in `jobs.<id>.if`).
  4. Every job-level `if:` / `name:` / `environment:` / `concurrency`
     expression uses only contexts allowed at that level
     (github | inputs | vars | needs [+ strategy/matrix for name/env]).
     In particular no `env.`, `secrets.`, `steps.` or `matrix.` in `if:`.
  5. Triggers: no `push`; `workflow_dispatch` and `workflow_run` present.
  6. `jobs.deploy.needs == plan` and its `if:` reads needs.plan.outputs.
  7. Three-Env §5.2 grep: >= 3 INFRA_ENV_(DEV|PROD) matches.

Usage: python scripts/test/_deploy-yml-concurrency-audit.py  (exit 0 = pass)
"""
from __future__ import annotations

import re
import sys

import yaml

PATH = ".github/workflows/deploy.yml"
EXPR = re.compile(r"\$\{\{(.*?)\}\}", re.S)
CTX = re.compile(r"(?<![\w.'])([a-z_]+)\.")
IF_ALLOWED = {"github", "inputs", "vars", "needs"}
JOB_KEY_ALLOWED = IF_ALLOWED | {"strategy", "matrix"}


def contexts(expr: str) -> set[str]:
    """Return the root context names referenced in an expression."""
    no_strings = re.sub(r"'[^']*'", "''", expr)
    return set(CTX.findall(no_strings))


def strip_comments(text: str) -> str:
    return "\n".join(
        ln for ln in text.splitlines() if not ln.lstrip().startswith("#")
    )


def main() -> int:
    text = open(PATH, encoding="utf-8").read()
    failures: list[str] = []

    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        print(f"FAIL | YAML parse: {exc}")
        return 1
    print("OK | YAML parses")

    if doc.get("concurrency"):
        failures.append("workflow-level 'concurrency:' block present")

    if "matrix." in strip_comments(text):
        failures.append("'matrix.' referenced in non-comment code")

    jobs = doc.get("jobs") or {}
    for job_id, job in jobs.items():
        raw_if = job.get("if")
        if raw_if is not None:
            bad = contexts(str(raw_if)) - IF_ALLOWED
            if bad:
                failures.append(f"jobs.{job_id}.if uses disallowed contexts {sorted(bad)}")
        for key in ("name", "environment", "concurrency", "runs-on"):
            value = job.get(key)
            if value is None:
                continue
            for expr in EXPR.findall(str(value)):
                bad = contexts(expr) - JOB_KEY_ALLOWED
                if bad:
                    failures.append(f"jobs.{job_id}.{key} uses disallowed contexts {sorted(bad)}")

    # PyYAML parses the bare key `on` as boolean True.
    triggers = doc.get("on", doc.get(True)) or {}
    if "push" in triggers:
        failures.append("'push' trigger present (races images.yml)")
    for needed in ("workflow_dispatch", "workflow_run"):
        if needed not in triggers:
            failures.append(f"trigger '{needed}' missing")

    deploy = jobs.get("deploy") or {}
    if deploy.get("needs") != "plan":
        failures.append(f"jobs.deploy.needs is {deploy.get('needs')!r}, expected 'plan'")
    if "needs.plan.outputs.should_deploy" not in str(deploy.get("if")):
        failures.append("jobs.deploy.if does not gate on needs.plan.outputs.should_deploy")

    matches = re.findall(r"INFRA_ENV_(?:DEV|PROD)", text)
    if len(matches) < 3:
        failures.append(f"expected >=3 INFRA_ENV_(DEV|PROD) matches, got {len(matches)}")

    if failures:
        for msg in failures:
            print(f"FAIL | {msg}")
        return 1
    print("All post-fix verifications passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
