# 2026-10-12 14:15 — deploy.yml `env.APP_ENV` → `matrix.app_env` refactor

**Status:** fix
**Scope:** [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1)
plus the two specs that document the deploy workflow shape
([`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1),
[`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1)),
plus a new offline test at
[`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py:1).

---

## 1. The bug

After the [2026-10-12 00:58 deep-audit milestone](2026-10-12--00-58-12-deploy-yml-deep-audit-and-hardening.milestone.md)
introduced a workflow-level `env.APP_ENV` helper to consolidate the four
inline `inputs.app_env || …` expressions, the next push to `main` failed
the workflow-file parse with:

```
(Line: 62, Col: 10): Unrecognized named-value: 'env'. Located at position 1 within expression: env.APP_ENV
(Line: 82, Col: 11): Unrecognized named-value: 'env'. Located at position 1 within expression: env.APP_ENV
(Line: 90, Col: 18): Unrecognized named-value: 'env'. Located at position 1 within expression: env.APP_ENV == 'prod' && 'production' || 'dev'
```

Three sites referenced `${{ env.APP_ENV }}` from positions where the
`env` context is **not** in the allowed-context list:

| Line | Key | Allowed contexts (per [GitHub docs](https://docs.github.com/en/actions/learn-github-actions/expressions)) |
|---|---|---|
| 62 | `concurrency.group` | `github`, `inputs`, `vars`, `needs`, `strategy`, `matrix` |
| 82 | `jobs.<id>.name` | `github`, `inputs`, `vars`, `matrix`, `secrets`, `runner`, `env` ← (the `env` here is the **runner env**, not the workflow `env` block) |
| 90 | `jobs.<id>.environment` | (not documented as expression-eligible; was accepted by accident in earlier runs and broken in newer ones) |

The official GitHub Actions docs are explicit: "You can use the `env`
context in the value of any key in a **step** except for the `id` and
`uses` keys." The `concurrency.group`, `jobs.<id>.name` and
`jobs.<id>.environment` keys are evaluated before any step runs, so
`env.APP_ENV` is out of scope.

## 2. The fix

Promote `APP_ENV` from a workflow-level `env:` entry to a **matrix
entry**. The matrix is in the allowed-context list for all three
problematic keys. The behaviour is otherwise identical to the previous
helper.

The new workflow shape:

```yaml
concurrency:
  group: deploy-${{ matrix.app_env }}     # matrix is allowed here
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy (${{ matrix.app_env }}) + smoke-test   # matrix is allowed here
    environment: ${{ matrix.app_env == 'prod' && 'production' || 'dev' }}  # matrix is allowed here
    if: >-
      matrix.app_env == (
        inputs.app_env
        || github.event.workflow_run.inputs.app_env
        || (github.event_name == 'push' && github.ref_name)
        || (github.event_name == 'workflow_run' && github.event.workflow_run.head_branch)
        || 'dev'
      ) && (
        github.event_name != 'workflow_run' ||
        github.event.workflow_run.conclusion == 'success'
      )
    strategy:
      fail-fast: false
      matrix:
        app_env: [dev, prod]
    # … 12 steps, every `env.APP_ENV` now `matrix.app_env` …
```

The matrix is **static** (`[dev, prod]`). The job-level `if:` evaluates
the trigger-derived env (`triggered_env`) using the same fallback chain
the previous `env.APP_ENV` helper used, and **skips** the matrix entry
whose `app_env` does not match. For every realistic trigger shape
exactly one of the two entries survives the `if:` and runs; the other
is a no-op skip.

The two steps that previously had `env.APP_ENV` inside their step-level
`env:` blocks (steps 2 and 3 — the secret-selection logic) now use
`${{ matrix.app_env }}` directly. The step-level `env:` block in
GitHub Actions **does** allow `env.*` references, but since the
workflow-level `env.APP_ENV` is gone, those reads had to be repointed
to `matrix.app_env`. No other behaviour change.

## 3. Why a matrix, and not a different shape

Other options considered and rejected:

- **Inline the expression at each of the 3 sites.** Works, but
  duplicates the same 5-line `inputs.app_env || …` chain in three
  places — a recipe for drift the next time the trigger list changes
  (e.g. when `prod` gets added to `push.branches`).
- **Drop per-env concurrency and use a single fixed group.** Loses the
  dev/prod separation; a slow dev deploy could block a fast prod
  deploy, and vice versa.
- **Use a `vars.APP_ENV` repo variable.** Requires an out-of-band step
  to set the variable (a pre-deploy `actions/github-script` or a
  dedicated "Set APP_ENV variable" workflow). Operationally heavier
  than the matrix; same correctness; less local-readable.

The matrix also gives a future "matrix-extra" knob for free (e.g.
`DROPLET_HOST` and `DROPLET_SSH_KEY` per env when the prod droplet
appears) — the current `DROPLET_HOST` / `DROPLET_SSH_KEY` secrets are
shared between dev and prod today, and the `Three-Env-Verification.md`
§4 already plans to split them once the prod droplet exists.

## 4. How to verify

```bash
# 1. The workflow parses as valid YAML (same check the verification
#    spec §1g runs).
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8').read()); print('YAML_OK')"
# Expect: YAML_OK

# 2. The new offline test exercises the matrix `if:` logic against
#    14 trigger shapes (push to dev/prod, dispatch dev/prod,
#    workflow_run from a dev push / prod dispatch, failure outcomes,
#    etc.) and asserts that exactly one matrix entry survives the
#    `if:` for each.
python scripts/test/_deploy-yml-matrix-pick-test.py
# Expect: "All 14 scenarios match expectations." (exit 0)

# 3. The Three-Env-Verification.md §5.2 grep check still passes:
grep -E 'INFRA_ENV_(DEV|PROD)' .github/workflows/deploy.yml | wc -l
# Expect: ≥ 3 (the two `INFRA_ENV:` env-block references + comment lines)

# 4. The deep-audit-milestone's "How to verify" future-prod check:
#    add `prod` to images.yml's push.branches, push to prod, and
#    confirm that deploy.yml's `concurrency.group` reports `deploy-prod`
#    (not `deploy-dev`). This is still a manual exercise — needs the
#    future push-to-prod plumbing in images.yml.
```

## 5. Files touched

| File | Why |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1) | Removed the workflow-level `env.APP_ENV`; added `strategy.matrix.app_env: [dev, prod]`; rewrote the `concurrency.group`, `jobs.<id>.name`, `jobs.<id>.environment` and the two `INFRA_ENV:` env-block reads to use `matrix.app_env`; added a job-level `if:` that picks the matching matrix entry. The file header now documents the rationale. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:1) | "Utolsó frissítés" bullet added; the §9.1 deploy.yml bullet now describes the matrix shape and links to this history entry. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1) | "Utolsó frissítés" bullet added; the §7.1 deploy.yml bullet rewrites the stale `secrets[format(...)]` reference to the new `matrix.app_env` form. |
| [`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py:1) | New offline test (Python 3, no dependencies). Mirrors the `if:` expression in pure Python and exercises it against 14 trigger shapes. Run with `python scripts/test/_deploy-yml-matrix-pick-test.py`. |
| [`docs/history/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md`](2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.md) | This file. |
| [`docs/milestones/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.milestone.md`](../milestones/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.milestone.md) | Decision-grade summary. |

## 6. Follow-ups (optional, tracked separately)

- The deep-audit-milestone's "How to verify §" future-prod check
  (push to a `prod` branch with `images.yml` and `deploy.yml` both
  wired) still requires the prod droplet to exist. Same dependency
  as the existing `Three-Env-Verification.md` §4 prod-track.
- The new `scripts/test/_deploy-yml-matrix-pick-test.py` is the only
  Python test under `scripts/test/`. The directory is otherwise
  bash-test-only; consider a follow-up to either (a) document the
  "Python test in a bash-test directory" exception in
  `scripts/test/README.md`, or (b) move the file to a new
  `scripts/test/py/` subdir and have the bash runner invoke
  `python3 scripts/test/py/_deploy-yml-matrix-pick-test.py`.
- A static `actionlint` pre-PR check would have caught the original
  `env.APP_ENV` parse failure at PR time and is already on the
  follow-up list from the 2026-10-11 deep-audit milestone. Out of
  scope here.
