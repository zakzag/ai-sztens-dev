# 2026-10-12 15:09 — deploy.yml: `matrix` → `plan` job, push trigger removed, smoke script shipped

## TL;DR

`.github/workflows/deploy.yml` failed its workflow-file parse with
`Unrecognized named-value: 'matrix'` in the job-level `if:` — the
`matrix` context is not allowed there. The 14:15 fix moved `APP_ENV`
from a workflow-level `env:` helper to a 2-elem `matrix.app_env`, and
the 14:50 fix removed the workflow-level `concurrency:` block, but the
**job-level** `if:` still referenced `matrix.app_env`, which is also a
parse error. Beyond the parse error, four latent runtime bugs would
have hit the next push.

Resolution: the `matrix` is gone entirely. A new `plan` job runs
`.github/scripts/deploy-plan.sh` (unit-tested in
`scripts/test/_deploy-plan-test.sh`, 15 scenarios) and exposes the
decision as `needs.plan.outputs.{should_deploy,app_env,image_tag,ref}`.
The `deploy` job reads those via `needs.*` (allowed everywhere
`matrix.*` was). The workflow-szintű `push` trigger is removed —
`images.yml` reacts to push, `deploy.yml` follows via `workflow_run`.
The scp step also ships `scripts/test/stack-smoke.sh` + `scripts/test/lib`
to the droplet so the smoke step has its inputs.

## 1. Symptom

After commit 14:50's `concurrency:` deletion was pushed, the next push
to `main` was rejected with:

```
Invalid workflow file: .github/workflows/deploy.yml#L1
(Line: 116, Col: 9): Unrecognized named-value: 'matrix'. Located at
position 1 within expression: matrix.app_env == (
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

## 2. Root cause

`jobs.<id>.if` is evaluated **before** the matrix is expanded. The
allowed-context list for `if:` is the same as for workflow-level
`concurrency.group`: `github | inputs | vars | needs`. `matrix` is
allowed at `jobs.<id>.concurrency.group` and at `jobs.<id>.strategy.*`
siblings, but **not** at `jobs.<id>.if`. The 14:15 fix moved
`APP_ENV` into the matrix for sites that allow it, but the existing
`if:` (a 2-line block from the 14:15 rewrite) still referenced
`matrix.app_env`. The 14:50 fix deleted the workflow-level
`concurrency:` block (where the same `matrix.app_env` was) but didn't
audit the remaining `if:` for the same mistake.

This is the third `Unrecognized named-value` failure on this file in two
days (`env` on 14:15, `matrix` on 14:50, `matrix` on 15:09). The pattern
is the same each time: the expression parser allowed in some places
and forbidden in others, and we kept shifting the same expression into
ever-narrower slots. The only context that is allowed in **all** the
places we need to read `APP_ENV` is `needs.*`, and `needs.*` only exists
after a `plan` job has run.

## 3. Latent bugs the parse error was hiding

Even if the parse had succeeded, the previous deploy.yml had four
runtime bugs that would have hit the next push:

1. **Race with `images.yml`.** The workflow had both a `push` and a
   `workflow_run` trigger. On a push to `dev`, both fire: the push
   itself starts a `deploy.yml` run that races `images.yml` and tries
   to `docker compose pull` an `IMAGE_TAG=sha-<short of github.sha>`
   that hasn't been published yet → `manifest unknown` and the stack
   goes stale. This is the original "stale sha" failure mode that
   the 2026-10-11 23:59 and 2026-10-12 00:58 milestones were about.
2. **Wrong SHA on `workflow_run`.** `GITHUB_SHA` (and therefore
   `github.sha`) is **the default-branch HEAD** during a `workflow_run`
   trigger, not the commit `images.yml` actually built. The
   `IMAGE_TAG=sha-${GITHUB_SHA::7}` derived from it does not match any
   GHCR tag. The correct field is
   `github.event.workflow_run.head_sha`. (Neither the 14:15 nor the
   14:50 fix noticed this — the `if:`-driven `GITHUB_SHA` read looked
   innocuous next to the parse error.)
3. **Confused env-on-`workflow_run` decision.** The
   `github.event.workflow_run.inputs.app_env` expression always
   evaluates to empty (the `workflow_run` payload does not contain an
   `inputs` field for a push-triggered upstream), so the `workflow_run`
   branch of the fallback chain always fell through to
   `github.event.workflow_run.head_branch`. Fine for `dev` today
   (since the only branch in `push.branches` is `dev`), but the
   expression couples "which env to deploy" to "which branch the build
   ran on" — a future `push.branches: [dev, prod]` plus a push to prod
   would silently deploy the prod-built image to the dev droplet
   (the original BUG-5 from the 00:58 deep-audit, never fully
   eliminated).
4. **Smoke step can't find its script.** Step 9 runs
   `bash scripts/test/stack-smoke.sh` on the droplet, but the scp step
   (step 5) only ships `infra/docker-compose.yml, infra/.env,
   infra/caddy/Caddyfile.rendered`. The smoke script is in
   `scripts/test/stack-smoke.sh` and is not in the `sparse-checkout`
   list — the step would fail with `bash: scripts/test/stack-smoke.sh:
   No such file or directory` on the first deploy.

## 4. Fix

- **New `plan` job** ([`.github/workflows/deploy.yml:99-141`](../../.github/workflows/deploy.yml)).
  Runs `.github/scripts/deploy-plan.sh` and exposes
  `should_deploy | app_env | image_tag | ref` as
  `needs.plan.outputs.*`. No secrets, no SSH, no docker — pure
  decision function.
- **New `deploy-plan.sh`**
  ([`.github/scripts/deploy-plan.sh:1`](../../.github/scripts/deploy-plan.sh)).
  ~80 lines of pure shell. Skips with `should_deploy=false` when the
  `workflow_run` upstream was a `workflow_dispatch` (operator has to
  dispatch `deploy.yml` themselves) or was on a branch other than
  `dev` (prod auto-deploy will be wired when the prod droplet exists)
  or didn't conclude `success`. Validates `app_env` ∈ {dev,prod} and
  the optional `image_tag` override; on a `dispatch` without an
  override defaults `image_tag` to `sha-<7 chars of github.sha>`.
  Writes outputs to `$GITHUB_OUTPUT` (or stdout in tests).
- **`deploy` job** rewired
  ([`.github/workflows/deploy.yml:142+`](../../.github/workflows/deploy.yml)).
  - `needs: plan`, `if: needs.plan.outputs.should_deploy == 'true'`.
  - `environment: ${{ needs.plan.outputs.app_env == 'prod' && 'production' || 'dev' }}`.
  - `concurrency: { group: deploy-${{ needs.plan.outputs.app_env }}, cancel-in-progress: false }`
    (per-env serialize; `needs.*` IS allowed in
    `jobs.<id>.concurrency.group`).
  - Every previous `matrix.app_env` reference is now
    `needs.plan.outputs.app_env` / `.image_tag` / `.ref`. The
    `strategy.matrix` block is gone. The two `INFRA_ENV:` env-block
    reads use `needs.plan.outputs.app_env == 'prod' && secrets.INFRA_ENV_PROD || secrets.INFRA_ENV_DEV`.
  - `actions/checkout` now takes `ref: ${{ needs.plan.outputs.ref }}`
    so the compose file, the Caddyfile template, and the smoke
    scripts shipped to the droplet are all from the same commit that
    produced the images.
  - The scp step (step 5) now also ships
    `scripts/test/stack-smoke.sh, scripts/test/lib` so the smoke step
    has its inputs.
  - The `Render infra/.env` step's `ghcr.io`-overwriting guard
    is unchanged but still applies; same for the `Caddyfile`
    rendering.
- **Triggers**: `push` removed; `workflow_dispatch` (now also accepts
  an optional `image_tag` override) and `workflow_run` (only fires
  the `plan` step now) remain.
- **New unit test**
  ([`scripts/test/_deploy-plan-test.sh:1`](../../scripts/test/_deploy-plan-test.sh)).
  15 scenarios: dispatch (default / override / invalid tag / invalid
  env / bad SHA / empty), workflow_run (push on dev / failure /
  cancelled / from dispatch / other branch / missing head_sha),
  unsupported event, and the `$GITHUB_OUTPUT` file mode. All 15
  pass.
- **Structural audit rewritten**
  ([`scripts/test/_deploy-yml-concurrency-audit.py:1`](../../scripts/test/_deploy-yml-concurrency-audit.py)).
  Now enforces: YAML parses; no workflow-level `concurrency:` block;
  no `matrix.` reference anywhere in non-comment code; every
  job-level `if:` expression uses only `{github,inputs,vars,needs}`;
  no `push` trigger; `workflow_dispatch` and `workflow_run` present;
  `jobs.deploy.needs == "plan"` and its `if:` reads
  `needs.plan.outputs.should_deploy`; the Three-Env §5.2 grep still
  matches ≥ 3 `INFRA_ENV_(DEV|PROD)` lines. Future regressions of
  any of these will fail the test before they hit a runner.
- **Old matrix-pick test deleted**
  ([`scripts/test/_deploy-yml-matrix-pick-test.py:1`](../../scripts/test/_deploy-yml-matrix-pick-test.py)).
  Subsumed by `_deploy-plan-test.sh`.

## 5. Outcome and how to verify

```bash
# 1. YAML parse.
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml', encoding='utf-8'))"

# 2. Structural audit (catches the same parse class of bug at PR time).
python scripts/test/_deploy-yml-concurrency-audit.py
# Expect: "All post-fix verifications passed." (exit 0)

# 3. Plan-script unit test (15 cases).
bash scripts/test/_deploy-plan-test.sh
# Expect: "passed=15 failed=0"

# 4. actionlint (catches shell-quoting and expression-context issues).
actionlint -no-color .github/workflows/deploy.yml .github/workflows/images.yml
# Expect: exit 0

# 5. Push to dev, OR workflow_dispatch with app_env=dev:
#    - plan job emits should_deploy=true app_env=dev image_tag=sha-<7> ref=<sha>
#    - deploy job runs under the "dev" GitHub Environment
#    - the verify-tag step reports "All 4 application services are running sha-<7>"
#    - the smoke step runs against the live deployment
```

The audit script also serves as a regression gate: any future change
that reintroduces a `matrix.` reference or a `push` trigger fails
locally, before the runner.

## 6. Follow-ups (deferred)

- **Prod auto-deploy** when the prod droplet exists. The plan script
  already returns `app_env=prod` for a manual dispatch with
  `app_env=prod`; the auto-deploy from `workflow_run` is intentionally
  limited to `dev` (the `WR_HEAD_BRANCH == 'dev'` check). The prod
  auto-deploy will add a similar check (probably keying off a
  `inputs.app_env` we have to write into the `workflow_run.payload`,
  which GitHub does not currently provide — most likely a separate
  workflow file or a `repository_dispatch` plumbing will be needed
  before prod auto-deploys from pushes work).
- **`actionlint` in pre-PR CI** (deferred since the 2026-10-11
  incident). Would have caught all three `Unrecognized named-value`
  failures at PR time. Same recommendation as the 14:50 milestone.
- **The matrix-pick test that was deleted** could be revived as a
  pure-Python port of the plan script, but the bash test in §5.3
  already covers the same decision matrix (and is end-to-end closer
  to what the runner actually executes).
- **Prod droplet secrets**: when the prod droplet is created, add
  `INFRA_ENV_PROD` to the `production` GitHub Environment (not the
  `dev` one). The current `secrets.INFRA_ENV_PROD` reference in
  `deploy.yml` will then resolve automatically under the prod
  GitHub Environment binding.
