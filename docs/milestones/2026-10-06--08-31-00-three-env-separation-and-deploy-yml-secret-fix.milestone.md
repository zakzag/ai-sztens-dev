# Milestone — Three-environment separation (local / dev / prod) + deploy.yml per-env secret fix

**Date:** 2026-10-06
**Branch(es):** the five-step `e97f759..83e9f71` chain landed directly on `main` (no feature branch — short-lived, fully bisected, smoke-tested against the existing dev droplet). The `07b8154` commit (Three-Env-Verification spec) and the three `7c48fc3 / 02ba18a / 32e198f` dev-stack.ps1 fixes followed. The follow-up commit on this milestone closes the per-env secret gap in the CI render step and refreshes the Caddy spec.

## 1. Problem / feature

The project had **one** runtime environment that was overloaded:

- The developer's local stack ([`scripts/dev-stack.sh`](../../scripts/dev-stack.sh)) shared its env-file names with the dev droplet (`infra/.env`), so a developer running `docker compose up` against an unmodified repo could accidentally point at `web.aisztens.hu` / `admin.aisztens.hu` (the dev URLs baked into the `.env.example`), or conversely, the droplet's `infra/.env` could be checked in by accident.
- The GitHub Actions deploy had **one** monolith secret (`INFRA_ENV`) — it could not target a future production droplet without also exposing prod values to the dev droplet.
- The Caddy reverse-proxy spec documented the droplet topology as if it were the only runtime; there was no recognition that the local stack runs Caddy-free via the `infra/docker-compose.local.yml` override.
- The deploy script's "which env file?" logic lived in two places ([`deploy/deploy.sh`](../../deploy/deploy.sh) and [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)) and disagreed about the file name (the workflow wrote `infra/.env`, the script read it preferentially but also accepted the new per-env name).

## 2. Measured data / evidence

- `git grep -n '^APP_ENV\|envFilePath' apps/api/src` (pre-change) → zero references; `ConfigModule` always loaded `.env` first, regardless of intent.
- `cat deploy.sh | grep -c 'infra/.env'` → 5 references, mixed with the legacy filename.
- `cat .github/workflows/deploy.yml | grep INFRA_ENV` → 1 secret, no matrix.
- The Caddy spec header ([`docs/Specs/Caddy-Reverse-Proxy.md:4`](../../docs/Specs/Caddy-Reverse-Proxy.md:4)) was last updated on 2026-10-02 for the VAPI pre-filter work — it never reflected the Caddy-disabled `local` override that landed in step 3 of the plan.
- The verification spec ([`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:72) §5.2) called out `INFRA_ENV_DEV` and `INFRA_ENV_PROD` "both referenced" — but post-step-4, `INFRA_ENV_PROD` was defined in [`deploy/README.md`](../../deploy/README.md:120) yet the render step's `env:` block ([`.github/workflows/deploy.yml:99`](../../.github/workflows/deploy.yml:99)) only read `secrets.INFRA_ENV_DEV`. A `workflow_dispatch` with `app_env=prod` would have rendered the **dev** secrets into `infra/.env.prod`. This was the latent gap that motivated the follow-up commit on this milestone.

## 3. Root cause / design rationale

Three orthogonal axes had to be aligned: **API config** (which env file NestJS reads), **deploy config** (which droplet is targeted, which secret is upstreamed), and **local-dev tooling** (how the stack comes up without the Caddy/ACME overhead). Each had its own source of truth, so the natural design was a **single label** ([`APP_ENV`](../../apps/api/src/config/app-env.ts:19)) propagated from the shell → compose `environment:` → NestJS process.

Alternatives considered (see [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../../history/2026-10-05--10-30-00-three-env-separation-plan.md) §5):

- **Reuse `NODE_ENV`** instead of inventing `APP_ENV`: rejected because NestJS / class-validator treat `NODE_ENV=production` as a side-effect switch (strips unknowns). The label must be orthogonal to build-vs-runtime semantics.
- **Filename convention `.env.local / .env.dev / .env.production`** (NestJS / Vite defaults) vs `.env.local / .env.dev / .env.prod` (project's own): the chosen three-letter form is shorter and matches the `APP_ENV` value space; the Vite `build:${APP_ENV}` script alias already encodes it.
- **`DROPLET_HOST` and `DROPLET_SSH_KEY` per-env from day one**: deferred — only one droplet exists today. The deploy.yml concurrency group (`deploy-${{ inputs.app_env || 'dev' }}`) and the GitHub `production` environment protection are enough until then.

Failure-mode policy:

- `APP_ENV=prod` + empty `CORS_ORIGINS` → **exit 1** (fail closed: [`main.ts:39`](../../apps/api/src/main.ts:39)). The permissive `origin: true` is only valid in dev/local.
- `APP_ENV=prod` → `ignoreEnvFile: true` ([`app.module.ts:40`](../../apps/api/src/app.module.ts:40)). `prod` does not load any `.env*` file even if one slips into the image.
- `workflow_dispatch.app_env=prod` against the dev droplet → would still target the dev droplet, but the GitHub `production` environment protection rule (recommended: require manual reviewer) gates the secret separately. The push trigger cannot accidentally target prod (no input exists for `push`).

## 4. Solution / implementation

Five-step plan landed on `main` (see [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../../history/2026-10-05--10-30-00-three-env-separation-plan.md) for the full plan):

| # | Commit | What it did |
|---|---|---|
| 1 | `e97f759` | `.gitignore` per-env patterns; SPAs' `dev:dev` / `build:dev` / `build:prod` scripts; [`apps/{web,admin}/.env.example`](../../apps/web/.env.example) splits; `deploy.sh:build_spas` switched to `--mode dev` + `ensure_spa_env()` helper. |
| 2 | `a054d0e` | [`apps/api/src/config/app-env.ts`](../../apps/api/src/config/app-env.ts:19) new module; [`app.module.ts`](../../apps/api/src/app.module.ts:25) `envFilePath` + `ignoreEnvFile`; [`main.ts`](../../apps/api/src/main.ts:39) prod+empty-CORS fail-close + boot banner; [`infra/docker-compose.yml:37`](../../infra/docker-compose.yml:37) `APP_ENV` entry; [`apps/api/.env.example`](../../apps/api/.env.example) rewrite. |
| 3 | `8dd9f8f` | [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh) (bash entry point) + [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1) (Windows wrapper) + `infra/docker-compose.wsl.yml` → `infra/docker-compose.local.yml` rename (Caddy `profiles: [never]` in local). |
| 4 | `a3f901c` | [`deploy/deploy.sh`](../../deploy/deploy.sh:76) `APP_ENV` selector + per-env fallback chain + legacy `infra/.env` compat; [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:42) `workflow_dispatch.app_env` input + `INFRA_ENV_DEV`/`INFRA_ENV_PROD` secrets + `APP_ENV` threaded through every `docker compose --env-file` call. |
| 5 | `83e9f71` | [`infra/.env.example`](../../infra/.env.example) per-env template + [`deploy/README.md`](../../deploy/README.md:111) secrets table + [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:1) (new spec). |
| 6 | `07b8154` | [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:1) end-to-end manual test plan (§2 local, §3 dev, §4 prod). |
| 7 | `7c48fc3` | [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:76) `$ScriptPath` null-tolerance under `[CmdletBinding()]`. |
| 8 | `02ba18a` | [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:111) captured `wslpath` stderr and added a `wsl --install` hint when the call returns a non-zero status. |
| 9 | `32e198f` | [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:136) replaced `wslpath` entirely with an in-process `/mnt/<drive>/` conversion — the Microsoft Store `wsl.exe` wrapper strips backslashes from argv entries regardless of how they're quoted, so the only fix is to do the conversion in PowerShell before `wsl.exe` sees the string. |
| 10 (this milestone's follow-up) | uncommitted at time of writing | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:108) render step now uses `${{ secrets[format('INFRA_ENV_{0}', upper(inputs.app_env || 'dev'))] }}` so `app_env=prod` reads `INFRA_ENV_PROD` and `app_env=dev` reads `INFRA_ENV_DEV`. File header comment block ([`.github/workflows/deploy.yml:1`](../../.github/workflows/deploy.yml:1)) rewritten to describe the per-env flow instead of the legacy `infra/.env` flow. [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:4) header refreshed; new §4.5 documents the per-env renderelés and the Caddy-disabled `local` override; §7.1 references the per-env files; §9 karbantartási szabály broadened to include the per-env workflow files. |

## 5. Outcome and how to verify

- **Push-to-dev** trigger: deploys `APP_ENV=dev` from `INFRA_ENV_DEV`. Run `ssh deployer@aisztens.hu "cd /opt/aisztens && docker compose --env-file infra/.env logs api | grep APP_ENV"` and expect `APP_ENV=dev (raw=dev)`. ([`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:72) §5.2 expected `INFRA_ENV_DEV` referenced → now also `INFRA_ENV_PROD` referenced.)
- **workflow_dispatch `app_env=dev`**: identical to push-to-dev. (Run via Actions → Deploy to droplet → Run workflow → app_env=dev.)
- **workflow_dispatch `app_env=prod`** (gated by the GitHub `production` environment): renders `infra/.env.prod` from `INFRA_ENV_PROD`. Pre-merge gate: the workflow's `env:` block is `${{ secrets[format('INFRA_ENV_{0}', upper(inputs.app_env || 'dev'))] }}`; with `app_env=prod` the expression evaluates to `secrets.INFRA_ENV_PROD`. The destination on the droplet is still `/opt/aisztens/infra/.env`; the destination's name (vs the source's `infra/.env.${APP_ENV}`) is the cutover lever for compose compatibility.
- **Local dev** (`./scripts/dev-stack.sh up`): `APP_ENV=local`, Caddy disabled. Tail the api log and expect `APP_ENV=local (raw=local)` + `CORS origins: http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174`. (`docker compose --profile never ps` should show no `caddy` container.)
- **Per-env file selection in `app.module.ts`**: `git grep envFilePath apps/api/src/app.module.ts` → `['.env.${APP_ENV}', '.env.local']` with `ignoreEnvFile: APP_ENV === 'prod'`.

## 6. Follow-ups

- The `DROPLET_HOST` / `DROPLET_SSH_KEY` secrets remain single-instance. When the prod droplet is provisioned, split into `_PROD` and add per-env gating in steps 3/5/6/7/8 of the workflow (one-line follow-up).
- The `Caddyfile` template still uses `<DOMAIN>` / `<ACME_EMAIL>` token-style substitution. If a fourth env is added (e.g. staging), the token list grows by 1; the per-env `infra/.env.${APP_ENV}` template handles the rest.
- `apps/api/src/config/app-env.ts:5` still has a stale `(see scripts/dev-stack.sh, future PR)` comment from before step 3 landed.
- The boot banner in [`main.ts:72`](../../apps/api/src/main.ts:72) labels the CORS origins with `'<open>'` for the dev/local empty list. When `APP_ENV=prod` is wired, this branch is unreachable (fail-close runs above), but a final review of the prod-day banner is a follow-up.