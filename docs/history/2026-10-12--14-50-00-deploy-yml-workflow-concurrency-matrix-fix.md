# 2026-10-12 14:50 — deploy.yml workflow-level `concurrency.group` `matrix.app_env` parse failure

**Status:** fix
**Scope:** [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1) (the workflow file itself), the two specs that document the deploy shape ([`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1), [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1)), and the offline test suite under [`scripts/test/`](../../scripts/test/).

---

## 1. The bug

The [2026-10-12 14:15 history entry](2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md) replaced the workflow-level `env.APP_ENV` helper with a matrix entry to dodge the `Unrecognized named-value: 'env'` error at the `concurrency.group` / `jobs.<id>.name` / `jobs.<id>.environment` keys (where the `env.*` context is not allowed).

The next push to `main` failed the workflow-file parse with a different error at the same workflow-level `concurrency.group` slot, this time about `matrix`:

```
GitHub Actions
/ .github/workflows/deploy.yml
Invalid workflow file

(Line: 76, Col: 10): Unrecognized named-value: 'matrix'. Located at position 1 within expression: matrix.app_env
```

Line 76 of the file as it sat on disk was:

```yaml
75 concurrency:
  76   group: deploy-${{ matrix.app_env }}
  77   cancel-in-progress: false
```

## 2. Root cause

The previous fix moved `env.APP_ENV` to `matrix.app_env` for six sites (the [2026-10-12 00:58 deep-audit](2026-10-12--00-58-12-deploy-yml-deep-audit-and-hardening.md) had listed them: `concurrency.group`, `jobs.<id>.name`, `environment`, and the two `INFRA_ENV:` env-block reads). Five of those six are evaluated inside a job body where `matrix` is an allowed context. The sixth — **the workflow-level `concurrency.group`** — is evaluated before any job runs, and its allowed-context list is `github | inputs | vars | needs`. The `matrix` context is not in that list, because `matrix` is per-job, not per-workflow.

Per the [GitHub Actions expressions docs](https://docs.github.com/en/actions/learn-github-actions/expressions#contexts-allowed-for-expressions):

| Key                                  | Allowed contexts                                          |
| ------------------------------------ | --------------------------------------------------------- |
| `concurrency.group` (workflow-level) | `github`, `inputs`, `vars`, `needs`                       |
| `jobs.<id>.concurrency.group`        | `github`, `inputs`, `vars`, `needs`, `matrix`             |
| `jobs.<id>.name`                     | `github`, `inputs`, `vars`, `matrix`, `secrets`, `runner` |
| `jobs.<id>.environment`              | `github`, `inputs`, `vars`, `matrix`, `secrets`, `runner` |

Note the asymmetry: `concurrency.group` at the **job** level IS allowed to read `matrix`, but at the **workflow** level it is not. The previous history entry treated the two as identical and shipped a workflow-level reference that was always going to fail.

This is also why a self-imposed prior test (the `_deploy-yml-matrix-pick-test.py`) was green: it mirrors the `jobs.deploy.if:` expression, not the workflow-level `concurrency.group` expression that was actually broken.

## 3. Why Option A (delete the block) and not Option B (replace with `inputs.app_env || …`)

Two safe fixes were considered:

- **Option A (chosen):** delete the workflow-level `concurrency:` block entirely. Per-env separation is already enforced by (1) the job-level `if:` filter — exactly one of the two matrix entries survives per trigger, the other is a no-op skip — and by (2) `jobs.deploy.environment`, which binds each entry to its GitHub Environment (`dev` / `production`). The latter gives the same "two workflows can never race each other on the same droplet" guarantee that `concurrency.group` would have given, plus the per-env secret-scope and manual-approval gate. There is no concurrency to serialize at the workflow level: the matrix entries cannot run in parallel because there is only one trigger and the `if:` collapses them.
- **Option B (rejected):** replace `matrix.app_env` at line 76 with the same fallback chain used by the `if:` (`inputs.app_env || github.ref_name || 'dev'`). Works, but duplicates the trigger-resolution expression in two places — a recipe for drift the next time the trigger list changes.

Option A is the minimal-diff fix and removes the offending line.

## 4. The fix

The 6-line workflow-level `concurrency:` block (lines 72–77 of the previous file) was deleted; a 5-line `# NOTE:` comment replaced it explaining why there is intentionally no workflow-level block, and the file-header rationale block was extended with a new section "Why no workflow-level `concurrency:` block" that cites the GitHub Actions docs and the two replacement mechanisms. No other code or behaviour change.

The rest of the workflow is unchanged: the job-level `if:`, the `strategy.matrix.app_env: [dev, prod]`, the `jobs.<id>.environment`, and every `matrix.app_env` reference inside a step's `env:` block are still in place and still parse.

## 5. Files touched

| File                                                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1)                                                                                                                         | Deleted the 6-line workflow-level `concurrency:` block (previous lines 72–77); replaced with a 5-line `# NOTE:` comment; extended the file-header rationale block (previous lines 36–50) with a new "Why no workflow-level `concurrency:` block" section that documents the GitHub Actions expression-context restriction and the two replacement mechanisms.                                                      |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1)                                                                                                                 | Prepended a new `Utolsó frissítés` bullet for the workflow-level concurrency removal; §9.1 `deploy.yml` prose now says the workflow-level `concurrency:` block has been deleted and that per-env separation comes from the job-level `if:` + `jobs.deploy.environment` only.                                                                                                                                       |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1)                                                                                                               | Same `Utolsó frissítés` bullet prepended; §7.1 prose updated.                                                                                                                                                                                                                                                                                                                                                      |
| [`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py:1)                                                                                       | **New.** Six offline checks: YAML parses; no workflow-level `concurrency:` block; every remaining `matrix.*` reference lives inside the `jobs.deploy.*` subtree; the Three-Env §5.2 INFRA_ENV grep still matches ≥ 3 lines; `jobs.deploy.environment` still uses `matrix.app_env`; `jobs.deploy.strategy.matrix.app_env` is still `[dev, prod]`. Fails loud if any future edit reintroduces the same shape of bug. |
| [`docs/history/2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.md`](2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.md:1)                                      | This file.                                                                                                                                                                                                                                                                                                                                                                                                         |
| [`docs/milestones/2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.milestone.md`](../milestones/2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.milestone.md:1) | Decision-grade summary.                                                                                                                                                                                                                                                                                                                                                                                            |

## 6. How to verify

```bash
# 1. YAML parses.
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8').read()); print('YAML_OK')"
# Expect: YAML_OK

# 2. All six post-fix invariants hold.
python scripts/test/_deploy-yml-concurrency-audit.py
# Expect: "All post-fix verifications passed." (exit 0)

# 3. The original matrix-pick test still passes (job-level if:).
python scripts/test/_deploy-yml-matrix-pick-test.py
# Expect: "All 14 scenarios match expectations." (exit 0)

# 4. Three-Env §5.2 grep still passes.
python -c "import re; t=open('.github/workflows/deploy.yml', encoding='utf-8').read(); print(len(re.findall(r'INFRA_ENV_(?:DEV|PROD)', t)))"
# Expect: >= 3

# 5. End-to-end: push to `dev` (or dispatch with app_env=dev) and
#    confirm the workflow parses and exactly one job runs:
#    "Deploy (dev) + smoke-test". (No second deploy-prod job — the
#    matrix `if:` skips it.)
```

## 7. Follow-ups (deferred)

- The deep-audit-milestone's "How to verify" future-prod check (push to `prod` branch, see `concurrency.group` report `deploy-prod`) is moot now — there is no workflow-level concurrency group to observe. The future-prod check now is "see the jobs-row `Deploy (prod) + smoke-test` running under the `production` GitHub Environment". Same dependency on the prod droplet existing; same `Three-Env-Verification.md` §4 prod-track.
- `actionlint` in pre-PR CI (already on the follow-up list from earlier milestones) would have caught the original `Unrecognized named-value: 'env'` failure; it would also catch this `Unrecognized named-value: 'matrix'` failure at PR time instead of at push time. Out of scope here.
- The new `_deploy-yml-concurrency-audit.py` is a Python test in an otherwise bash-only test directory; same relocation-or-document exception as the existing `_deploy-yml-matrix-pick-test.py` from the previous fix.
