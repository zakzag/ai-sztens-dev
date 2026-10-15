# Plan — deploy.yml `matrix` → `plan` job refactor (2026-10-12)

## 1. Problem

The CI deploy workflow (`.github/workflows/deploy.yml`) fails its
workflow-file parse with `Unrecognized named-value: 'matrix'`, in the
job-level `if:` block:

```yaml
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
```

Two earlier 2026-10-12 fix attempts moved `APP_ENV` from a workflow-level
`env:` helper to a `matrix.app_env` entry to dodge the
`Unrecognized named-value: 'env'` parse error in `jobs.<id>.environment`.
That move put `matrix.app_env` in the **job-level** `if:` instead, where
`matrix` is still not an allowed context (allowed: `github | inputs |
vars | needs`). The same bug applies to the workflow-level
`concurrency.group` and the `if:` on the `deploy` job.

Beyond the parse error, the existing workflow has **four latent runtime
bugs** that would hit the next push even if the parse succeeded:

1. The workflow has a **direct `push` trigger AND a `workflow_run`**
   trigger. On `push to dev`, both fire: the push itself starts a
   `deploy.yml` run that races `images.yml` and tries to
   `docker compose pull` an `IMAGE_TAG=sha-<short of github.sha>` that
   hasn't been published yet → `manifest unknown` and the stack goes
   stale.
2. On `workflow_run`, `GITHUB_SHA` (and therefore `github.sha`) is
   **the default-branch HEAD**, not the commit `images.yml` actually
   built. The `IMAGE_TAG` derived from it does not match any GHCR tag.
   The correct field is `github.event.workflow_run.head_sha`.
3. `github.event.workflow_run.inputs.app_env` does not exist; the
   `workflow_run` branch of the `if:` therefore always falls through to
   `github.event.workflow_run.head_branch` — fine for `dev` today, but
   the expression couples "which env to deploy" to "which branch the
   build ran on", which a future prod `push.branches` would silently
   break.
4. The `Ship compose + env + Caddyfile` scp step ships only three files;
   step 9 then runs `bash scripts/test/stack-smoke.sh` on the droplet,
   but that file is **not** in the droplet and is **not** in the
   `sparse-checkout` list — the step fails on the very first deploy.

## 2. Goal

Make `deploy.yml` parse without errors, and make every trigger shape
(push to dev, manual dispatch, `workflow_run` from images.yml) deploy the
right image of the right env to the right droplet, with the smoke test
suite available on the host. Make the failure mode of "wrong env" or
"wrong tag" impossible, and make the parse-time vs runtime invariants
unit-testable so future changes can't reintroduce the same class of
bug silently.

## 3. Approach

Replace the matrix with a **dedicated `plan` job** that runs a small
shell script and exposes the decision as `needs.plan.outputs.*`. The
`deploy` job reads that via `needs.*` (allowed in `if:`, `name:`,
`environment:`, `concurrency.group`).

### 3.1 Triggers

- Remove the workflow-level `push` trigger entirely. `images.yml` still
  reacts to `push to dev`; the deploy follows via `workflow_run`.
- Keep `workflow_dispatch` with two inputs:
  - `app_env` (dev|prod, required) — env to deploy to.
  - `image_tag` (string, optional) — override the default
    `sha-<7 of head_sha>`. Useful for rolling back to a previously
    built tag without re-running images.yml.
- Keep `workflow_run` on `images.yml` `completed`. The `plan` job
  inspects the upstream event and skips when it was a dispatch (we
  don't want a manual `images.yml` dispatch to silently deploy), or
  when the upstream branch was not `dev`.

### 3.2 Plan job + script

New file: [`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh).

Pure shell, `set -euo pipefail`. Reads the trigger shape from env vars
that the workflow sets on its `env:` block. Writes
`should_deploy | app_env | image_tag | ref` to `$GITHUB_OUTPUT` (or to
stdout when unset, for the offline unit test). Skips with
`should_deploy=false` and a human-readable `reason` when:

- `workflow_run` is from a `workflow_dispatch` upstream (operator has to
  run a manual deploy instead).
- `workflow_run` was on a branch other than `dev` (prod auto-deploys
  will be wired separately when the prod droplet exists).
- `workflow_run` did not conclude `success`.

Validates `app_env` ∈ {dev,prod} and the override `image_tag` matches
the docker tag character class; on a `dispatch` without an override it
defaults `image_tag` to `sha-<7 chars of github.sha>`. The `ref` it
emits is `github.event.workflow_run.head_sha` (workflow_run) or
`github.sha` (dispatch) so the checkout step pulls the exact commit
that the image was built from.

Unit test: [`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh)
is exercised by
[`scripts/test/_deploy-plan-test.sh`](../../scripts/test/_deploy-plan-test.sh)
(15 scenarios, including every skip and every error path).

### 3.3 Deploy job

`jobs.deploy` gets:

- `needs: plan`
- `if: needs.plan.outputs.should_deploy == 'true'`
- `environment: ${{ needs.plan.outputs.app_env == 'prod' && 'production' || 'dev' }}`
- `concurrency: { group: deploy-${{ needs.plan.outputs.app_env }}, cancel-in-progress: false }`

Every previous `matrix.app_env` / `matrix.*` reference becomes
`needs.plan.outputs.app_env` / `.image_tag` / `.ref`. No `matrix.*` or
`env.*` remains in any job-level key (the audit script enforces this).

`actions/checkout@v4` now uses `ref: ${{ needs.plan.outputs.ref }}`,
so the compose file, the Caddyfile template, and the smoke-test files
shipped to the droplet all come from the same commit that produced the
images.

The scp step now ships `scripts/test/stack-smoke.sh` and `scripts/test/lib`
alongside the three runtime files, so the smoke step has its inputs.

### 3.4 Offline test

[`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py)
was renamed in spirit to "deploy.yml structural audit" and extended:

- YAML parses.
- No workflow-level `concurrency:` block.
- No `matrix.` reference anywhere in non-comment code.
- Every job-level `if:` expression uses only `{github, inputs, vars, needs}`.
- Every job-level `name | environment | concurrency | runs-on`
  expression uses only those plus `strategy | matrix` (the previous
  2-elem matrix shape is fine; we just don't depend on it).
- Triggers: no `push`; `workflow_dispatch` and `workflow_run` present.
- `jobs.deploy.needs == "plan"` and its `if:` reads `needs.plan.outputs.should_deploy`.
- Three-Env §5.2 grep: ≥ 3 `INFRA_ENV_(DEV|PROD)` matches.

Removed the now-obsolete
[`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py)
(its job is subsumed by `_deploy-plan-test.sh`).

### 3.5 Why not a workflow-level env helper (the previous design)?

A workflow-level `env.APP_ENV` would still need to be evaluated by the
expression parser in `jobs.<id>.if` — and `env.*` is also not in the
allowed-context list there (see the 2026-10-12 14:15 history entry).
The only contexts allowed in `if:` are `github | inputs | vars | needs`,
so the decision has to come from one of those four. `github` and `vars`
don't carry the trigger-derived `app_env`; `inputs` is empty on a
`push` or `workflow_run` trigger; `needs` is the only one left, which is
why we need a `plan` job to publish its decision.

## 4. Files changed

| File | Change |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Removed `push` trigger and the `strategy.matrix` block; added `permissions: contents: read`; added a `plan` job that runs `.github/scripts/deploy-plan.sh`; rewrote `jobs.deploy` to use `needs: plan`, `if:` on `needs.plan.outputs.should_deploy`, and `matrix.app_env` replaced by `needs.plan.outputs.app_env` / `.image_tag` / `.ref`; added a job-level `concurrency: deploy-${{ needs.plan.outputs.app_env }}`; checkout now uses `ref:` from plan; scp step now also ships `scripts/test/stack-smoke.sh` + `scripts/test/lib` so the smoke step has its inputs; file header rewritten to document the new design. |
| [`.github/scripts/deploy-plan.sh`](../../.github/scripts/deploy-plan.sh) | **New.** Decision function described in §3.2. |
| [`scripts/test/_deploy-plan-test.sh`](../../scripts/test/_deploy-plan-test.sh) | **New.** 15 bash scenarios covering dispatch (default / override / invalid tag / invalid env / bad SHA), workflow_run (push on dev / failure / cancelled / from dispatch / other branch / missing head_sha) and the GITHUB_OUTPUT file mode. |
| [`scripts/test/_deploy-yml-concurrency-audit.py`](../../scripts/test/_deploy-yml-concurrency-audit.py) | Rewritten to assert: no workflow-level `concurrency`; no `matrix.` anywhere; `jobs.<id>.if` uses only `{github,inputs,vars,needs}`; no `push` trigger; `jobs.deploy` properly wired through `needs.plan`. |
| [`scripts/test/_deploy-yml-matrix-pick-test.py`](../../scripts/test/_deploy-yml-matrix-pick-test.py) | **Deleted.** Subsumed by `_deploy-plan-test.sh`. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | `Utolsó frissítés` bullet for the plan-job refactor; §9.1 deploy.yml bullet rewritten. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | `Utolsó frissítés` bullet; §7.1 deploy.yml bullet rewritten. |
| [`docs/history/2026-10-12--15-09-00-deploy-yml-plan-job.md`](../../docs/history/2026-10-12--15-09-00-deploy-yml-plan-job.md) | **New.** Day-to-day narrative. |
| [`docs/milestones/2026-10-12--15-09-00-deploy-yml-plan-job.milestone.md`](../../docs/milestones/2026-10-12--15-09-00-deploy-yml-plan-job.milestone.md) | **New.** Decision-grade summary. |
| [`plans/2026-10-12--15-09-00-deploy-yml-plan-job.md`](../../plans/2026-10-12--15-09-00-deploy-yml-plan-job.md) | **New.** This plan. |

## 5. Verification

1. YAML parse:
   `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8'))"`
2. Structural audit (catches the same parse class of bug at PR time):
   `python scripts/test/_deploy-yml-concurrency-audit.py` → "All post-fix verifications passed."
3. Plan-script unit test (15 cases):
   `bash scripts/test/_deploy-plan-test.sh` → "passed=15 failed=0"
4. actionlint (catches shell-quoting and expression-context issues):
   `actionlint -no-color .github/workflows/deploy.yml .github/workflows/images.yml` → exit 0
5. Push to `dev` (or `workflow_dispatch` with `app_env=dev`): the `plan`
   job emits `should_deploy=true app_env=dev image_tag=sha-<7> ref=<sha>`,
   the `deploy` job runs under the `dev` GitHub Environment, the
   `verify-tag` step reports "All 4 application services are running
   sha-<7>", and the smoke step runs against the live deployment.
