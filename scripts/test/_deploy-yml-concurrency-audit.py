#!/usr/bin/env python3
"""Verify deploy.yml post-fix state.

Checks:
  1. YAML parses.
  2. No workflow-level `concurrency:` block remains.
  3. Every remaining `${{ matrix.* }}` reference lives inside the
     `jobs.deploy.*` subtree (i.e. at a line whose indent is >= the
     `jobs.deploy:` indent), so none of them are evaluated at a
     context where `matrix` is not allowed.
  4. The Three-Env-Verification §5.2 grep check still passes.
"""
from __future__ import annotations
import re
import sys
import yaml


def main() -> int:
    path = ".github/workflows/deploy.yml"
    text = open(path, encoding="utf-8").read()

    # 1. YAML parses.
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as e:
        print(f"YAML_PARSE_FAIL: {e}")
        return 1
    print("OK | YAML parses")

    # 2. No workflow-level concurrency block.
    if doc.get("concurrency"):
        print(f"FAIL | workflow-level 'concurrency' block still present: {doc['concurrency']}")
        return 1
    print("OK | no workflow-level 'concurrency:' block")

    # 3. Every matrix.* reference must be inside jobs.deploy.*.
    lines = text.splitlines()
    job_deploy_indent = None
    for i, ln in enumerate(lines):
        m = re.match(r"^(\s*)jobs:\s*$", ln)
        if m:
            for j in range(i + 1, len(lines)):
                mm = re.match(r"^(\s*)deploy:\s*$", lines[j])
                if mm:
                    job_deploy_indent = len(mm.group(1))
                    break
            break
    if job_deploy_indent is None:
        print("FAIL | could not locate 'jobs.deploy:' indent")
        return 1

    bad = []
    for i, ln in enumerate(lines, start=1):
        if "matrix." not in ln or "${{" not in ln:
            continue
        # Strip the YAML comment portion (`#` ... end-of-line), so we don't
        # match commented-out references in the file header.
        hash_pos = ln.find("#")
        code = ln if hash_pos == -1 else ln[:hash_pos]
        if "matrix." not in code or "${{" not in code:
            continue
        indent = len(code) - len(code.lstrip(" "))
        if indent < job_deploy_indent:
            bad.append((i, ln.rstrip()))
    if bad:
        print("FAIL | matrix.* references outside jobs.deploy.* subtree:")
        for i, ln in bad:
            print(f"    line {i}: {ln}")
        return 1
    print(f"OK | all matrix.* references live inside jobs.deploy.* (indent>={job_deploy_indent})")

    # 4. Three-Env §5.2 grep: INFRA_ENV_(DEV|PROD) must still appear in deploy.yml.
    matches = re.findall(r"INFRA_ENV_(?:DEV|PROD)", text)
    if len(matches) < 3:
        print(f"FAIL | expected >=3 INFRA_ENV_(DEV|PROD) matches, got {len(matches)}")
        return 1
    print(f"OK | {len(matches)} INFRA_ENV_(DEV|PROD) matches (>= 3 required)")

    # 5. jobs.deploy.environment still uses the matrix (allowed at job level).
    env = (doc.get("jobs") or {}).get("deploy", {}).get("environment")
    if "matrix.app_env" not in str(env):
        print(f"FAIL | jobs.deploy.environment lost its matrix reference: {env!r}")
        return 1
    print(f"OK | jobs.deploy.environment uses matrix.app_env: {env!r}")

    # 6. jobs.deploy.strategy.matrix.app_env still [dev, prod].
    strat = (doc.get("jobs") or {}).get("deploy", {}).get("strategy") or {}
    matrix = strat.get("matrix", {})
    if matrix.get("app_env") != ["dev", "prod"]:
        print(f"FAIL | jobs.deploy.strategy.matrix.app_env is not [dev, prod]: {matrix}")
        return 1
    print("OK | jobs.deploy.strategy.matrix.app_env == [dev, prod]")

    print()
    print("All post-fix verifications passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())