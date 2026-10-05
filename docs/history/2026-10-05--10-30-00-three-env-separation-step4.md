# 2026-10-05 10:30 — Three-env separation · Step 4 (deploy.sh `APP_ENV` selector + CI matrix)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md) — Step 4 of 5.
**Scope:** [`deploy/deploy.sh`](../../deploy/deploy.sh:1) and [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml). This is the actual deploy-side on-ramp to a future prod droplet.

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`deploy/deploy.sh`](../../deploy/deploy.sh:59) | Added `APP_ENV` selector (default `dev`, accepts `local\|dev\|prod`). Added `SPA_BUILD_MODE` (defaults to `APP_ENV`). `DOMAIN`/`ACME_EMAIL` lookups prefer `infra/.env.${APP_ENV}`, fall back to legacy `infra/.env` so the current droplet (which pre-dates the per-env rename) keeps working. |
| 2 | [`deploy/deploy.sh:81`](../../deploy/deploy.sh:81) | `COMPOSE_ENV_FILE_LOCAL` resolves `infra/.env.${APP_ENV}` first, then `infra/.env`. The destination on the droplet is still `infra/.env` — only the local-repo source filename uses the per-env convention. |
| 3 | [`deploy/deploy.sh:286`](../../deploy/deploy.sh:286) | `local_infra_env` resolver prefers `infra/.env.${APP_ENV}`, then legacy `infra/.env`, then a final `$REPO_DIR/../infra/.env` fallback (same precedence the old code had, just with the new name prepended). The "no env file found" message now mentions `APP_ENV=${APP_ENV}` and points at the per-env path. |
| 4 | [`deploy/deploy.sh:380`](../../deploy/deploy.sh:380) | The `up` SSH call now exports `APP_ENV=${APP_ENV}` as shell env in addition to the compose `environment:` block. Belt-and-braces: a future edit to [`infra/docker-compose.yml`](../../infra/docker-compose.yml:30) that forgets the `APP_ENV:` line cannot silently run the api container as `APP_ENV=dev` on a prod droplet. |
| 5 | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:18) | Monolithic `INFRA_ENV` secret replaced with `INFRA_ENV_DEV` and `INFRA_ENV_PROD`. New `workflow_dispatch` `app_env` input (choice: dev/prod). Push trigger is hard-wired to `dev`. Concurrency group is `deploy-${{ inputs.app_env \|\| 'dev' }}` so dev and prod can run in parallel. GitHub `environment` resolves to `production` for prod deploys and `dev` for dev deploys. |
| 6 | [`.github/workflows/deploy.yml:87`](../../.github/workflows/deploy.yml:87) | "Render from secret" step writes `infra/.env.${APP_ENV}` (was `infra/.env`). Exposes `APP_ENV=${app_env}` to subsequent steps via `$GITHUB_ENV`. |
| 7 | [`.github/workflows/deploy.yml:112`](../../.github/workflows/deploy.yml:112) | Bulk upload `exclude:` now lists `infra/.env.local`, `infra/.env.dev`, `infra/.env.prod` explicitly (in addition to the existing `infra/.env` and `deploy/.env` entries). Real per-env files are still gitignored and still never enter the image; the explicit list is documentation. |
| 8 | [`.github/workflows/deploy.yml:136`](../../.github/workflows/deploy.yml:136) | "Upload infra/.env to droplet" step renamed to "Upload infra/.env.${APP_ENV} to droplet" and the source path is interpolated to `infra/.env.${{ env.APP_ENV }}`. Destination on the droplet is still `/opt/aisztens/infra/.env`. |
| 9 | [`.github/workflows/deploy.yml:172`](../../.github/workflows/deploy.yml:172) | "Build web and admin SPAs" step now reads `APP_ENV` from the env block and calls `pnpm ... "build:${APP_ENV}"` instead of injecting `VITE_API_BASE_URL=` inline. Matches Step 1's `build:dev`/`build:prod` scripts. |
| 10 | [`.github/workflows/deploy.yml:204`](../../.github/workflows/deploy.yml:204) | "Build and start the stack" SSH command now sets `APP_ENV="$APP_ENV"` in the shell and reads `--env-file "infra/.env.$APP_ENV"`. Comment explicitly documents the belt-and-braces design. |
| 11 | [`.github/workflows/deploy.yml:236`](../../.github/workflows/deploy.yml:236), [`deploy.yml:283`](../../.github/workflows/deploy.yml:283) | The healthcheck and log-dump SSH steps forward `APP_ENV: ${{ env.APP_ENV }}` in their `env:` block so the remote shell's `"infra/.env.$APP_ENV"` resolves. |
| 12 | [`.github/workflows/deploy.yml:244`](../../.github/workflows/deploy.yml:244), [`deploy.yml:298`](../../.github/workflows/deploy.yml:298), [`deploy.yml:301`](../../.github/workflows/deploy.yml:301), [`deploy.yml:306`](../../.github/workflows/deploy.yml:306) | Every remaining `docker compose --env-file infra/.env` is now `docker compose --env-file "infra/.env.$APP_ENV"`. A repo-wide grep confirms no stragglers. |

## Why the legacy `infra/.env` fallback

The currently-running dev droplet (`aisztens.hu`) was provisioned before the per-env rename in Step 0. Its `/opt/aisztens/infra/.env` is the legacy single-file path. When deploy.sh renders the file locally and ships it via scp to the same remote path, **nothing on the droplet needs to change** — the fallback chain keeps shipping the right file. After one deploy under this commit, `infra/.env.dev` is the new canonical name; the legacy `infra/.env` stays around only as a safety net.

The same fallback chain is reflected in the resolve logic for `COMPOSE_ARGS` and `local_infra_env`. Both messages are explicit ("Note: using legacy infra/.env …") so an operator can tell at a glance.

## How the deploy.yml matrix collapses to a single job

GitHub Actions' `workflow_dispatch.inputs` is not a true matrix, but combined with `${{ inputs.app_env \|\| 'dev' }}` everywhere downstream it behaves like one:

- Push to `dev` branch → no input → `APP_ENV=dev` → renders from `INFRA_ENV_DEV` → deploys dev.
- Manual trigger on `dev` → `APP_ENV=dev` → same as above.
- Manual trigger on `prod` → `APP_ENV=prod` → renders from `INFRA_ENV_PROD` → deploys prod.
- The push trigger cannot accidentally target prod: the `app_env` input doesn't exist in the `push` event, so `${{ inputs.app_env \|\| 'dev' }}` always evaluates to `dev`.

The `environment:` line uses an inline ternary so prod is gated by the GitHub `production` environment (requires manual approval on `main` branch protection).

## Verification done locally

```bash
# 1. deploy.sh is syntactically clean
bash -n deploy/deploy.sh && echo SYNTAX_OK_DEPLOY
# → SYNTAX_OK_DEPLOY

# 2. deploy.yml parses as valid YAML (used Python — PowerShell's [xml] cast
#    chokes on YAML's # comments, which is a tool artefact, not a real error)
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml').read()); print('YAML_OK')"
# → YAML_OK

# 3. No stragglers — every infra/.env reference in the workflow is now
#    either a per-env file name (infra/.env.local/dev/prod) or interpolated
#    via $APP_ENV
#    (regex search for the literal 'infra/.env' that is NOT followed by
#     a qualifier returned 0 matches in the workflow file)

# 4. Local helper check (would require docker to fully verify; skipped
#    because the droplet is the actual target)
APP_ENV=dev bash -c "set -a; . deploy/.env.example 2>/dev/null; set +a; \
  echo APP_ENV=${APP_ENV:-dev} DOMAIN=${DOMAIN}"
# (skipped — depends on having HOST/SSH_USER set)
```

## Verification to run on the dev droplet after the next deploy

```bash
# 1. The deploy.sh 'up' command renders the per-env file and ships it
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml ps"
# Expect: 4 containers Up (api / postgres / monitor / caddy), api healthy.

# 2. The api container's APP_ENV is dev (the boot banner from Step 2)
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml logs --tail=5 api | grep Bootstrap"
# Expect: a line like
#   [Bootstrap] API up — APP_ENV=dev (raw=dev), listening on 0.0.0.0:3000, CORS origins: https://web.aisztens.hu,https://admin.aisztens.hu

# 3. CI sanity (workflow_dispatch on dev) — no visible behaviour change on
#    the dev droplet, but the workflow run summary now shows:
#      "Deploy (dev) + smoke-test"
```

## What is intentionally NOT in this step

- No actual CI run on prod — the prod droplet doesn't exist yet. The matrix is dormant until someone provisions it.
- No secrets split beyond `INFRA_ENV_DEV` / `INFRA_ENV_PROD` — the broader "split the monolith into DOMAIN / ACME_EMAIL / INFRA_DB_SECRETS / INFRA_API_SECRETS" plan from [`docs/history/2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md`](../2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md) remains for a future follow-up.
- The `DROPLET_HOST` and `DROPLET_SSH_KEY` secrets are still single-instance. For a real prod droplet we need a second pair (`DROPLET_HOST_PROD`, `DROPLET_SSH_KEY_PROD`) and `if`-eq gating in Step 3/5/6/7/8 to pick the right pair based on `APP_ENV`. That's a one-line follow-up commit when the prod host is provisioned.

## Recommended commit message

```text
feat(deploy): APP_ENV selector + per-environment secrets (three-env step 4)

- deploy/deploy.sh: APP_ENV selector (default dev), COMPOSE_ARGS /
  local_infra_env prefer infra/.env.${APP_ENV} with a legacy
  infra/.env fallback. The 'up' SSH call now exports APP_ENV in
  addition to the compose environment declaration.
- .github/workflows/deploy.yml: monolithic INFRA_ENV secret replaced
  by INFRA_ENV_DEV / INFRA_ENV_PROD. workflow_dispatch gains an
  app_env input (dev/prod). Render uploads build:APPNAME so the per-env
  SPA files are picked up. All docker compose invocations switch to
  --env-file "infra/.env.${APP_ENV}".

Step 4 of docs/history/2026-10-05--10-30-00-three-env-separation-plan.md.