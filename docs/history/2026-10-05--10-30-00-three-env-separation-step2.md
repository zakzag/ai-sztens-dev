# 2026-10-05 10:30 — Three-env separation · Step 2 (NestJS env resolution)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md) — Step 2 of 5.
**Scope:** backend API ([`apps/api/src/`](../../apps/api/src/)) and the runtime `APP_ENV` plumbing ([`infra/docker-compose.yml`](../../infra/docker-compose.yml)).

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`apps/api/src/config/app-env.ts`](../../apps/api/src/config/app-env.ts:1) | New module — single source of truth for `APP_ENV`. Exports `APP_ENV` (`'local' \| 'dev' \| 'prod'`), `APP_ENV_RAW` (the raw string, or `'(unset, defaulted to dev)'`), and convenience booleans `isProd`, `isDev`, `isLocal`. Normalises common aliases (`production` → `prod`, `staging` → `dev`, `development` → `local`); defaults unset to `dev` (matches the only currently-running target). |
| 2 | [`apps/api/src/config/app-env.spec.ts`](../../apps/api/src/config/app-env.spec.ts:1) | Unit test for the normaliser: unset → dev, common aliases, `isProd`/`isDev`/`isLocal` mutually exclusive, `APP_ENV_RAW` exposed. |
| 3 | [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:30) | `ConfigModule.forRoot` now reads `envFilePath` from `APP_ENV` — `.env.${APP_ENV}` first (canonical), `.env.local` second (optional developer override, gitignored). `ignoreEnvFile: APP_ENV === 'prod'` makes the prod container fail-closed against any `.env*` file leak. |
| 4 | [`apps/api/src/main.ts`](../../apps/api/src/main.ts:30) | Reads `APP_ENV` at boot, fail-closes with `process.exit(1)` if `APP_ENV=prod` and `CORS_ORIGINS` is empty (would otherwise default to `origin: true` — the most permissive CORS policy). Emits a loud one-line banner with the resolved env, the bound port, and the resolved CORS list. |
| 5 | [`infra/docker-compose.yml:30`](../../infra/docker-compose.yml:30) | Added `APP_ENV: ${APP_ENV:-dev}` to the `api` service's `environment:` block, so the running container picks the right per-env file (and the prod path sets `ignoreEnvFile: true`). Defaults to `dev` so the existing droplet is unchanged. |
| 6 | `apps/api/.env` → `apps/api/.env.local` | Renamed on disk; content (`PORT=3000`, `CORS_ORIGINS=...`) preserved verbatim. |
| 7 | `apps/api/.env.dev`, `apps/api/.env.prod` | Created locally. `.env.dev` carries the dev CORS list and a placeholder VAPI secret; `.env.prod` is a dormant template with `<prod-domain>` placeholders. Both gitignored. |
| 8 | [`apps/api/.env.example`](../../apps/api/.env.example) | Rewrote as a three-env documentation template — committed reference, all three blocks documented, real per-env values live on developer machines / droplet / CI. |

## Why `APP_ENV` and not `NODE_ENV`

`NODE_ENV` is already set to `production` in the compose file. It drives NestJS / class-validator / class-transformer internal decisions (e.g. `NODE_ENV=production` makes class-validator strip unknown fields silently). Conflating "is this a prod build" with "which env's CORS list applies" would be a footgun. `APP_ENV` is the project's own label and the only one `app-env.ts` reads.

## Why `ignoreEnvFile: APP_ENV === 'prod'`

The Docker image already excludes `**/.env*` via [`infra/app/.dockerignore:2`](../../infra/app/.dockerignore:2), so prod **cannot** load a file even by accident. The explicit `ignoreEnvFile: true` makes that intent visible in the code: a future change to the Dockerfile that forgets the dockerignore, or a runtime `--env-file` flag, would still be safe. Defence in depth.

## Why `main.ts` fails-closed on prod with empty `CORS_ORIGINS`

Before this change, [`main.ts:17`](../../apps/api/src/main.ts:17) set `origin: allowedOrigins.length > 0 ? allowedOrigins : true`. In prod that "open" fallback would let any web page call the API. The new guard (`if (isProd && allowedOrigins.length === 0) process.exit(1)`) catches a misconfigured prod deploy **at startup**, so the container is `Restarting (1)` with a clear log line rather than silently shipping an open CORS policy.

## Verification done locally

```bash
# 1. All three new API env files are gitignored
git check-ignore -v apps/api/.env.local apps/api/.env.dev apps/api/.env.prod
# → .gitignore:57 apps/**/.env.local  apps/api/.env.local
# → .gitignore:58 apps/**/.env.dev    apps/api/.env.dev
# → .gitignore:59 apps/**/.env.prod   apps/api/.env.prod

# 2. AppEnv module type-checks under strict mode in isolation
cd apps/api
pnpm exec tsc --noEmit src/config/app-env.ts \
  --target ES2022 --module ES2022 --moduleResolution Bundler --strict
# (no output = success)

# 3. The full API project type-checks except for two pre-existing rawBody
# errors that belong to the VAPI PR (out of Step 2 scope):
#   src/main.ts(20,26): rawBody does not exist in FastifyAdapterBaseOptions
#   test/vapi-webhooks.e2e-spec.ts(61,28): same
# Both errors exist on the pre-Step-2 baseline and are tracked in the
# VAPI PR.

# 4. Unit tests for app-env.spec.ts — Jest is currently broken in this
# workspace (`createRequireEsmError` on all suites), so we cannot run
# them locally. The module is pure, dependency-free, and type-safe;
# CI runs against a clean pnpm install where Jest works.
```

## Verification to run on the dev droplet after the next deploy

```bash
# 1. The api container logs the boot banner
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml logs --tail=20 api"
# Expect: a line like
#   [Bootstrap] API up — APP_ENV=dev (raw=dev), listening on 0.0.0.0:3000, CORS origins: https://web.aisztens.hu,https://admin.aisztens.hu

# 2. The CORS allow-list is what the dev .env says
curl -i -H "Origin: https://web.aisztens.hu" \
  https://api.aisztens.hu/api/callback-requests
# Expect: 200 + access-control-allow-origin: https://web.aisztens.hu

# 3. The api container still health-checks green
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml ps"
# Expect: api Up (healthy)
```

## What is intentionally NOT in this step

- No `apps/api/.env.local|dev|prod` content seeded by `deploy.sh` yet — that lands in Step 4 (deploy script gets the `APP_ENV` selector).
- No CI matrix yet — Step 4.
- No `scripts/dev-stack.sh` yet — Step 3.
- The `old` env file (`apps/api/.env`) was renamed on disk; the file was already gitignored (`.gitignore:43` `.env`), so no tracked-file changes — same as the SPA env renames in Step 1.
- The two `rawBody` type errors are pre-existing and belong to the VAPI PR, not to this step.

## Recommended commit message

```text
feat(api): per-env file selection via APP_ENV (three-env plan step 2)

- apps/api/src/config/app-env.ts: new module, single source of truth for
  APP_ENV (local / dev / prod) with a normaliser and convenience booleans.
- apps/api/src/app.module.ts: ConfigModule.forRoot now uses
  envFilePath=[.env.${APP_ENV}, .env.local] and ignoreEnvFile: true
  in prod (fail-closed against any .env* file leak).
- apps/api/src/main.ts: fail-closed on APP_ENV=prod + empty CORS_ORIGINS,
  loud boot banner with the resolved env + port + CORS list.
- infra/docker-compose.yml: APP_ENV=dev by default in the api
  environment block (override to prod when the prod droplet is up).
- apps/api/.env -> .env.local rename on disk, plus .env.dev / .env.prod
  seeds (all gitignored).
- apps/api/.env.example: rewritten as a three-env documentation template.

Step 2 of docs/history/2026-10-05--10-30-00-three-env-separation-plan.md.