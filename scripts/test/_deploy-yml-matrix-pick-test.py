#!/usr/bin/env python3
"""Offline test for the deploy.yml matrix `if:` logic.

Reproduces the expression GitHub Actions evaluates for the job-level
`if:` on `jobs.deploy`. Confirms that for every realistic trigger shape,
exactly one of the two matrix entries (dev, prod) is selected.
"""
from __future__ import annotations
import json
import sys


def eval_if(matrix_app_env: str, event: dict) -> bool:
    """Mirror the deploy.yml `if:` expression (Python-side)."""
    wr = event.get("workflow_run") or {}
    triggered = (
        event.get("inputs", {}).get("app_env")
        or (wr.get("inputs") or {}).get("app_env")
        or (event.get("event_name") == "push" and event.get("ref_name"))
        or (
            event.get("event_name") == "workflow_run"
            and wr.get("head_branch")
        )
        or "dev"
    )
    upstream_ok = (
        event.get("event_name") != "workflow_run"
        or wr.get("conclusion") == "success"
    )
    return matrix_app_env == triggered and upstream_ok


SCENARIOS = [
    # (label, matrix_app_env, event, expected_runs)
    ("dev, push to dev",
     "dev", {"event_name": "push", "ref_name": "dev",
             "inputs": {}, "workflow_run": None}, True),
    ("prod, push to dev",
     "prod", {"event_name": "push", "ref_name": "dev",
              "inputs": {}, "workflow_run": None}, False),
    ("dev, dispatch dev",
     "dev", {"event_name": "workflow_dispatch", "ref_name": None,
             "inputs": {"app_env": "dev"}, "workflow_run": None}, True),
    ("prod, dispatch dev",
     "prod", {"event_name": "workflow_dispatch", "ref_name": None,
              "inputs": {"app_env": "dev"}, "workflow_run": None}, False),
    ("dev, dispatch prod",
     "dev", {"event_name": "workflow_dispatch", "ref_name": None,
             "inputs": {"app_env": "prod"}, "workflow_run": None}, False),
    ("prod, dispatch prod",
     "prod", {"event_name": "workflow_dispatch", "ref_name": None,
              "inputs": {"app_env": "prod"}, "workflow_run": None}, True),
    ("dev, wr from dev push success",
     "dev", {"event_name": "workflow_run", "ref_name": None,
             "inputs": {},
             "workflow_run": {"head_branch": "dev",
                              "conclusion": "success"}}, True),
    ("prod, wr from dev push success",
     "prod", {"event_name": "workflow_run", "ref_name": None,
              "inputs": {},
              "workflow_run": {"head_branch": "dev",
                               "conclusion": "success"}}, False),
    ("dev, wr from prod dispatch (head_branch=dev upstream)",
     "dev", {"event_name": "workflow_run", "ref_name": None,
             "inputs": {},
             "workflow_run": {"head_branch": "dev", "conclusion": "success",
                              "inputs": {"app_env": "prod"}}}, False),
    ("prod, wr from prod dispatch (head_branch=dev upstream)",
     "prod", {"event_name": "workflow_run", "ref_name": None,
              "inputs": {},
              "workflow_run": {"head_branch": "dev", "conclusion": "success",
                               "inputs": {"app_env": "prod"}}}, True),
    ("dev, future push to prod",
     "dev", {"event_name": "push", "ref_name": "prod",
             "inputs": {}, "workflow_run": None}, False),
    ("prod, future push to prod",
     "prod", {"event_name": "push", "ref_name": "prod",
              "inputs": {}, "workflow_run": None}, True),
    ("dev, wr from dev push FAILURE",
     "dev", {"event_name": "workflow_run", "ref_name": None,
             "inputs": {},
             "workflow_run": {"head_branch": "dev",
                              "conclusion": "failure"}}, False),
    ("prod, wr from dev push FAILURE",
     "prod", {"event_name": "workflow_run", "ref_name": None,
              "inputs": {},
              "workflow_run": {"head_branch": "dev",
                               "conclusion": "failure"}}, False),
    # Note: the trigger is filtered by `on.push.branches: [dev]`, so pushes
    # to non-dev branches never invoke the workflow at all — the `if:`
    # never runs. Therefore the "fallback to dev" behaviour from the
    # 2026-10-12 deep-audit milestone is enforced by the trigger filter,
    # not by the `if:` chain. We do not test push-to-other-branch here.
]


def main() -> int:
    failures = []
    for label, m, ev, expected in SCENARIOS:
        actual = eval_if(m, ev)
        ok = actual == expected
        flag = "OK  " if ok else "FAIL"
        print(f"{flag} | {label:55s} | matrix={m:4s} | expected={'RUNS' if expected else 'skip '} actual={'RUNS' if actual else 'skip '}")
        if not ok:
            failures.append((label, m, expected, actual, ev))
    if failures:
        print()
        print(f"FAILED: {len(failures)} scenario(s) mismatched expectations:")
        for label, m, exp, act, ev in failures:
            print(f"  - {label} (matrix={m}): expected={'RUNS' if exp else 'skip '} got={'RUNS' if act else 'skip '}")
            print(f"    event={json.dumps(ev, sort_keys=True)}")
        return 1
    print()
    print(f"All {len(SCENARIOS)} scenarios match expectations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
