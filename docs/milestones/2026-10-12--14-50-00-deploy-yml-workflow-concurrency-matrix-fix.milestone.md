# Milestone — deploy.yml workflow-level `concurrency.group` `matrix.app_env` parse failure (2026-10-12)

## 1. Problem

The [2026-10-12 14:15 history entry](../history/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md) replaced the workflow-level `env.APP_ENV` helper with a matrix entry to dodge the `Unrecognized named-value: 'env'` parse error at the `concurrency.group` / `jobs.<id>.name` / `jobs.<id>.environment` keys. The next push to `main` failed the workflow-file parse with a new error at the **workflow-level** `concurrency.group`:

```
(Line: 76, Col: 10): Unrecognized named-value: 'matrix'. Located at position 1 within expression: matrix.app_env
```

## 2. Evidence

GitHub Actions error on the failed `main` push (verbatim):

```
GitHub Actions
/ .github/workflows/deploy.yml
Invalid workflow file

(Line: 76, Col: 10): Unrecognized named-value: 'matrix'. Located at position 1 within expression: matrix.app_env
```

Line 76 of the file at the time:

```yaml
75 concurrency:
 76   group: deploy-${{ matrix.app_env }}
 77   cancel-in-progress: false
```

GitHub Actions docs ([expressions → contexts allowed for expressions](https://docs.github.com/en/actions/learn-github-actions/expressions#contexts-allowed-for-expressions)) are explicit: the allowed contexts for `concurrency.group` are `github | inputs | vars | needs`. `matrix` is **not** in that list at the workflow level (it **is** allowed at `jobs.<id>.concurrency.group` because that key is evaluated inside the job body). The previous fix had treated the two as identical.

## 3. Root cause / design rationale

The 2026-10-12 00:58 deep-audit listed six sites that read the workflow-level `env.APP_ENV`: `concurrency.group`, `jobs.<id>.name`, `environment`, and the two `INFRA_ENV:` env-block reads. Five are evaluated inside a job body where `matrix` is allowed. The sixth — the **workflow-level** `concurrency.group` — is evaluated before any job runs and does not have `matrix` in its allowed-context list.

Two safe fixes were considered:

- **Option A (chosen):** delete the workflow-level `concurrency:` block entirely. Per-env separation is already enforced by (1) the job-level `if:` filter (exactly one matrix entry runs per trigger; the other is a no-op skip) and (2) `jobs.deploy.environment`, which binds each entry to its GitHub Environment (`dev` / `production`) — giving the per-env secret-scope + manual-approval story that `concurrency.group` was meant to give. There is no concurrency to serialize at the workflow level: the matrix entries cannot run in parallel because there is only one trigger and the `if:` collapses them.
- **Option B (rejected):** replace `matrix.app_env` at line 76 with the same fallback chain used by the `if:` (`inputs.app_env || github.ref_name || 'dev'`). Works, but duplicates the trigger-resolution expression in two places — a recipe for drift.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1) | Deleted the 6-line workflow-level `concurrency:` block; replaced with a 5-line `# NOTE:` comment; extended the file-header rationale block with a new "Why no workflow-level `concurrency:` block" section that cites the GitHub Actions expression-context restriction and the two replacement mechanisms. No other code change. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1) | `Utolsó frissítés` bullet for the workflow-level concurrency removal; §9.1 prose now states the deletion and the replacement mechanisms. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1) | Same header bullet; §7.1 prose updated. |
| [`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py:1) | New offline test. Six invariants (YAML parses; no workflow-level `concurrency:`; every remaining `matrix.*` lives inside `jobs.deploy.*`; the Three-Env §5.2 INFRA_ENV grep still ≥ 3; `jobs.deploy.environment` still uses `matrix.app_env`; `jobs.deploy.strategy.matrix.app_env` still `[dev, prod]`). |
| [`docs/history/2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.md`](../history/2026-10-12--14-50-00-deploy-yml-workflow-concurrency-matrix-fix.md:1) | Day-to-day narrative. |

## 5. Outcome and how to verify

- YAML parse: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8').read()); print('YAML_OK')"` → exits 0.
- Six post-fix invariants: `python scripts/test/_deploy-yml-concurrency-audit.py` → "All post-fix verifications passed." (exit 0).
- Matrix-pick test (job-level `if:`): `python scripts/test/_deploy-yml-matrix-pick-test.py` → "All 14 scenarios match expectations." (exit 0).
- Three-Env §5.2 grep still matches ≥ 3 lines.
- Push to `dev` (or `workflow_dispatch` with `app_env=dev`): exactly one job runs, named `Deploy (dev) + smoke-test`, under the `dev` GitHub Environment. No second `deploy-prod` job — the matrix `if:` skips it.

## 6. Follow-ups (deferred)

- `actionlint` in pre-PR CI (already on the follow-up list from earlier milestones) would have caught this at PR time.
- The future-prod end-to-end check now exercises the `production` GitHub Environment binding instead of a `deploy-prod` concurrency group. Same dependency on the prod droplet existing; same `Three-Env-Verification.md` §4 prod-track.
- The new `_deploy-yml-concurrency-audit.py` is the second Python test in an otherwise bash-only `scripts/test/` directory; same relocation-or-document follow-up as `_deploy-yml-matrix-pick-test.py`.