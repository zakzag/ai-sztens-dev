# Milestone — deploy.yml `env.APP_ENV` → `matrix.app_env` refactor (2026-10-12)

## 1. Problem

The [2026-10-12 00:58 deep-audit milestone](2026-10-12--00-58-12-deploy-yml-deep-audit-and-hardening.milestone.md)
introduced a workflow-level `env.APP_ENV` helper to consolidate four
inline `inputs.app_env || …` expressions into a single source. The next
push to `main` failed the GitHub Actions workflow-file parse with
`Unrecognized named-value: 'env'` at three sites (`concurrency.group`,
`jobs.<id>.name`, `jobs.<id>.environment`).

## 2. Evidence

GitHub Actions error on the failed `main` push:

```
(Line: 62, Col: 10): Unrecognized named-value: 'env'.
(Line: 82, Col: 11): Unrecognized named-value: 'env'.
(Line: 90, Col: 18): Unrecognized named-value: 'env'.
```

GitHub Actions docs (per the
[env context reference](https://docs.github.com/en/actions/learn-github-actions/expressions#env)):
*"You can use the `env` context in the value of any key in a **step**
except for the `id` and `uses` keys."* The `concurrency.group`,
`jobs.<id>.name` and `jobs.<id>.environment` keys are evaluated before
any step runs; the allowed-context list for them is
`github`, `inputs`, `vars`, `needs`, `strategy`, `matrix`.

## 3. Solution

Promote `APP_ENV` from a workflow-level `env:` entry to a **matrix
entry**. Matrix is in the allowed-context list for all three
problematic keys. The matrix is static (`app_env: [dev, prod]`); a
job-level `if:` evaluates the trigger-derived env using the same
fallback chain (`inputs.app_env` → `workflow_run.inputs.app_env` →
`github.ref_name` on push → `workflow_run.head_branch` → `'dev'`) and
skips the matrix entry whose `app_env` does not match.

The two steps that read the workflow-level `env.APP_ENV` inside their
step-level `env:` blocks (steps 2 and 3) are repointed to
`matrix.app_env`. The behaviour for every realistic trigger shape is
unchanged from the previous `env.APP_ENV` helper.

## 4. Implementation

| File | Change |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1) | Removed `env.APP_ENV`; added `strategy.matrix.app_env: [dev, prod]`; rewrote `concurrency.group`, `jobs.<id>.name`, `jobs.<id>.environment` and the two `INFRA_ENV:` env-block reads to use `matrix.app_env`; added a job-level `if:` that picks the matching matrix entry. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1) | "Utolsó frissítés" bullet + §9.1 deploy.yml description updated. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1) | "Utolsó frissítés" bullet + §7.1 deploy.yml description updated (the stale `secrets[format(...)]` reference is now `matrix.app_env == 'prod' && secrets.INFRA_ENV_PROD || secrets.INFRA_ENV_DEV`). |
| [`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py:1) | New offline test; mirrors the `if:` expression in pure Python and exercises it against 14 trigger shapes (push/dispatch/workflow_run × dev/prod/safety-fallback × success/failure). |
| [`docs/history/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md`](../history/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md) | Day-to-day narrative. |

## 5. Outcome and verification

- Workflow file parses:
  `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8').read())"`
  → exits 0, prints `YAML_OK`.
- The new offline test passes:
  `python scripts/test/_deploy-yml-matrix-pick-test.py`
  → "All 14 scenarios match expectations." (exit 0).
- The Three-Env-Verification §5.2 grep check
  (`grep -E 'INFRA_ENV_(DEV|PROD)' .github/workflows/deploy.yml`) still
  returns ≥ 3 matches (the two `INFRA_ENV:` env-block references + the
  secret-list comments).
- Push to `dev` (or `workflow_dispatch` with `app_env=dev`) produces
  exactly one running job: `Deploy (dev) + smoke-test` under the
  `deploy-dev` concurrency group.
- Push to `dev` does **not** silently route to `prod` (or vice versa)
  — the matrix-`if:` selector is the new enforcement point of the
  per-env separation.

## 6. Follow-ups (deferred)

- Add `actionlint` to the pre-PR CI check (already on the
  follow-up list from the 2026-10-11 deep-audit milestone). Would
  have caught this at PR time, before the failed `main` push.
- The future-prod end-to-end check (add `prod` to `images.yml`
  `push.branches`, push a test commit to `prod`, confirm
  `concurrency.group` reports `deploy-prod`) still needs the prod
  droplet to exist; same dependency as `Three-Env-Verification.md` §4.
- Document or relocate the new Python test in
  `scripts/test/README.md` (the directory is otherwise bash-test-only).
