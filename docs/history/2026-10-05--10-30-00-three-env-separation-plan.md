# Plan — Local / dev / prod environment separation

**Date:** 2026-10-05 (Europe/Budapest)
**Status:** awaiting user approval
**Author:** architect mode (Zoo)
**Related artefacts:**
- [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:11) — NestJS ConfigModule
- [`apps/api/src/main.ts`](../../apps/api/src/main.ts:30) — CORS
- [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:1) — Vite dev proxy
- [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:1) — same
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml:29) — runtime env
- [`infra/docker-compose.wsl.yml`](../../infra/docker-compose.wsl.yml:1) — local override
- [`deploy/deploy.sh`](../../deploy/deploy.sh:81) — env file shipping
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — CI env rendering
- [`docs/history/2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md`](2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md) — broader secret-storage plan (F1/F2/F3); this plan is the concrete step-1 implementation of that document

---

## 0. Why this plan exists

The user clarified the target topology:
- **local** = the developer’s own machine (localhost, no public DNS, no TLS).
- **dev** = the **droplet that already exists today** (the one currently referenced everywhere as `*.aisztens.hu`). It is the deployment target the team uses for day-to-day verification — so a Caddy + public host, but **not yet a separate production-grade environment**.
- **prod** = **does not exist yet**. When it does, it should be wired up the same way (new droplet, new `DOMAIN`, new secrets) **without code changes**.

Today the project has only two effective modes: “local WSL” and “the droplet” — and they share the same `infra/.env`, the same `apps/api/.env` template, and the same deploy script. Introducing a real prod environment now (even before the prod droplet exists) means the file layout, the code-level switching, and the deploy pipeline have to support three targets from day one.

Goal: a **quick, low-risk** refactor that
1. splits env files by target,
2. makes the code pick the right one automatically,
3. lets a future prod droplet come online with **zero code change** and only env-file + secret changes.

---

## 1. Naming and scope

| Term | Meaning | Where it runs |
|---|---|---|
| **local** | A single developer’s machine, localhost-only | Windows / WSL / Git Bash, `docker compose ... -f docker-compose.local.yml up` |
| **dev** | The currently running droplet, used as a pre-prod / verification environment | DigitalOcean droplet, `docker compose ... -f docker-compose.yml up` (the file we have today) |
| **prod** | A **future** dedicated production droplet (does not exist yet) | New DigitalOcean droplet, same compose file, **different env file and different secrets** |

Key principle: **dev ≠ prod** even though the code is the same. They differ in secrets, in `CORS_ORIGINS`, in DB passwords, in `VAPI_WEBHOOK_SECRET`, and in `MONITOR_ALERT_WEBHOOK_URL`. The code reads from an env file chosen at deploy/boot time; it does not branch on the environment name anywhere.

---

## 2. The target file layout

### 2.1 Apps (frontend + backend)

For each of `apps/api`, `apps/web`, `apps/admin`, replace the current single `.env` with three mode files. Vite has built-in support for this; for the API we mirror the convention with NestJS `ConfigModule`.

```
apps/
├── api/
│   ├── .env.example          # committed, all three envs documented, placeholders
│   ├── .env.local            # gitignored, used for local WSL stack
│   ├── .env.dev              # gitignored, used when API runs in the dev droplet
│   └── .env.prod             # gitignored, used when API runs in a future prod droplet
├── web/
│   ├── .env.example          # documents all three
│   ├── .env.local            # VITE_API_BASE_URL=/api     (dev proxy)
│   ├── .env.dev              # VITE_API_BASE_URL=https://api.aisztens.hu/api
│   └── .env.prod             # VITE_API_BASE_URL=https://api.<prod-domain>/api
└── admin/
    └── ...same pattern as web/
```

Why three and not two: Vite natively resolves `.env.[mode]` based on the `mode` passed to `vite` / `pnpm build --mode dev`. The API gets the same treatment so the two halves of the system speak the same vocabulary.

### 2.2 Infra (Docker runtime)

```
infra/
├── .env.example              # committed, single template, all vars + per-env guidance in comments
├── .env.local                # gitignored, used with -f docker-compose.local.yml
├── .env.dev                  # gitignored, ships to the existing dev droplet
├── .env.prod                 # gitignored, will ship to a future prod droplet
├── docker-compose.yml        # base compose, used by dev (and by prod when it exists)
├── docker-compose.local.yml  # WSL override: expose ports, disable Caddy
└── caddy/
    ├── Caddyfile.template    # contains <DOMAIN> and <ACME_EMAIL> placeholders
    └── Caddyfile.rendered    # gitignored, generated
```

### 2.3 .gitignore updates

Append the three new patterns to the existing block at [`.gitignore:42`](../../.gitignore:42):

```gitignore
# Per-environment overrides (real values, never commit)
.env.local
.env.dev
.env.prod
apps/**/.env.local
apps/**/.env.dev
apps/**/.env.prod
infra/.env.local
infra/.env.dev
infra/.env.prod
```

The committed `*.example` files stay in the repo (the existing `.gitignore` already allows `!.env.example` semantics by exclusion, but to be explicit we keep the `**/.env.example` whitelist pattern in the API/web/admin image’s `.dockerignore` intact).

---

## 3. How the code picks the right env

### 3.1 API — NestJS ConfigModule

Replace the implicit `.env` lookup in [`apps/api/src/app.module.ts:11`](../../apps/api/src/app.module.ts:11):

```ts
// before
ConfigModule.forRoot({ isGlobal: true }),

// after
ConfigModule.forRoot({
  isGlobal: true,
  // In dev/prod the image ships no .env file (infra/app/.dockerignore:2),
  // so the empty-fallback path is safe. The variable is set by deploy.sh
  // (or by docker compose --env-file) and by the local run helper.
  envFilePath: [
    `.env.${process.env.APP_ENV ?? 'dev'}`,   // primary
    `.env.local`,                             // developer override
  ],
  ignoreEnvFile: process.env.APP_ENV === 'prod', // prod: env comes from compose only
}),
```

Plus a tiny `AppEnv` helper in [`apps/api/src/config/app-env.ts`](../../apps/api/src/config/app-env.ts) (new, ~15 lines):

```ts
export type AppEnv = 'local' | 'dev' | 'prod';
export const APP_ENV: AppEnv = (process.env.APP_ENV as AppEnv) ?? 'dev';
export const isProd = APP_ENV === 'prod';
```

Used to:
- tighten CORS logging in prod ([`main.ts:30`](../../apps/api/src/main.ts:30)),
- decide whether the VapiSignatureGuard logs the `message.id` (it already does, no change),
- gate verbose error payloads in prod (future).

`APP_ENV` is set in:
- the local run helper as `APP_ENV=local`,
- the dev droplet via `infra/.env.dev` → compose `environment:` block,
- the future prod droplet via `infra/.env.prod` → compose `environment:` block.

### 3.2 Web / Admin — Vite modes

Vite already supports modes; we just stop fighting it. The dev script in `apps/web/package.json` and `apps/admin/package.json` becomes:

```jsonc
{
  "scripts": {
    "dev": "vite",
    "dev:dev": "vite --mode dev",    // optional: load .env.dev instead of .env.local
    "build:dev": "vite build --mode dev",
    "build:prod": "vite build --mode prod"
  }
}
```

Default `vite` (no flag) loads `.env.local` → matches **local** use.
`build:dev` loads `.env.dev` → matches **dev** droplet use.
`build:prod` loads `.env.prod` → matches **future prod** droplet use.

This replaces the build-time inline override currently in [`deploy/deploy.sh:104`](../../deploy/deploy.sh:104). The deploy script no longer needs to know the API URL — Vite reads it from the committed env files.

### 3.3 Caddy

The Caddyfile stays a template ([`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile:1)); the env file supplies `<DOMAIN>` / `<ACME_EMAIL>` through `render_caddyfile()`. The only addition is that the env-file chosen for `render_caddyfile()` must match the env-file passed to `docker compose` for that deploy — see §4.

### 3.4 Run helper for local

New thin script `scripts/dev-stack.sh` (and a Windows wrapper `scripts/dev-stack.ps1` if needed), ~20 lines, mirroring the docker-compose incantation in [`infra/docker-compose.wsl.yml:5`](../../infra/docker-compose.wsl.yml:5):

```bash
#!/usr/bin/env bash
# Local developer stack. Reads infra/.env.local, builds SPAs in --mode local,
# disables Caddy. NEVER points at a public domain.
set -euo pipefail
cd "$(dirname "$0")/.."
export APP_ENV=local
docker compose --env-file infra/.env.local \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.local.yml up -d --build
```

The repo already has `scripts/init.sh` and `scripts/test/...`; `dev-stack.sh` slots in next to them.

---

## 4. Deploy pipeline changes ([`deploy/deploy.sh`](../../deploy/deploy.sh:81))

Minimal touch: add an optional first argument that selects the env, defaulting to `dev` (current behaviour).

```bash
# before
COMPOSE_ARGS="--env-file infra/.env -f infra/docker-compose.yml"

# after
APP_ENV="${1:-dev}"   # local | dev | prod; passed by CI job or by the operator
COMPOSE_ARGS="--env-file infra/.env.${APP_ENV} -f infra/docker-compose.yml"
```

Plus the env-file copy at [`deploy/deploy.sh:202`](../../deploy/deploy.sh:202) becomes:

```bash
local local_infra_env=""
for candidate in "infra/.env.${APP_ENV}" "infra/.env"; do
  if [ -f "$REPO_DIR/$candidate" ]; then
    local_infra_env="$REPO_DIR/$candidate"; break
  fi
done
...
"${SCP[@]}" "$local_infra_env" "$SSH_USER@$HOST:$REMOTE_DIR/infra/.env"
```

Note the destination stays `infra/.env` on the droplet — the **remote** stack does not need the `APP_ENV` suffix because it always reads a single file. The `APP_ENV` value travels as a literal compose `environment:` entry, so the running API knows which env it is in (e.g. for `ConfigModule`’s `envFilePath` resolution and the `AppEnv` helper).

CI mirror: [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) gets a new matrix dimension `environment: [dev, prod]` and per-environment secrets (`INFRA_ENV_DEV`, `INFRA_ENV_PROD`). Default branch `main` deploys to **dev**; the future `prod` deploy is a manual `workflow_dispatch` against a protected environment.

---

## 5. Environment-by-environment content

### 5.1 `local` (developer machine)

| File | Key | Value |
|---|---|---|
| [`apps/api/.env.local`](../../apps/api/.env.example) | `PORT` | `3000` |
| | `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174` |
| [`apps/web/.env.local`](../../apps/web/.env.example) | `VITE_API_BASE_URL` | `/api` |
| [`apps/admin/.env.local`](../../apps/admin/.env.example) | `VITE_API_BASE_URL` | `/api` |
| [`infra/.env.local`](../../infra/.env.example) | `DOMAIN` | `localhost` (unused; Caddy disabled) |
| | `ACME_EMAIL` | `dev@localhost` (unused) |
| | `POSTGRES_PASSWORD`, `AISZTENS_DB_PASSWORD`, `TKOVARI_DB_PASSWORD`, `KRAK_DB_PASSWORD` | **dev-only weak values** committed in `infra/.env.example`, but the real `infra/.env.local` overrides with locally generated strings (e.g. `openssl rand -hex 16`) |
| | `VAPI_WEBHOOK_SECRET` | `local-vapi-secret` (or empty to disable the route locally) |
| | `MONITOR_ALERT_WEBHOOK_URL` | empty |

### 5.2 `dev` (existing droplet)

| File | Key | Value |
|---|---|---|
| [`apps/api/.env.dev`](../../apps/api/.env.example) | `PORT` | `3000` |
| | `CORS_ORIGINS` | `https://web.aisztens.hu,https://admin.aisztens.hu` (per the CORS-cleanup PR, `api.aisztens.hu` no longer belongs here) |
| [`apps/web/.env.dev`](../../apps/web/.env.example) | `VITE_API_BASE_URL` | `https://api.aisztens.hu/api` |
| [`apps/admin/.env.dev`](../../apps/admin/.env.example) | `VITE_API_BASE_URL` | `https://api.aisztens.hu/api` |
| [`infra/.env.dev`](../../infra/.env.example) | `DOMAIN` | `aisztens.hu` |
| | `ACME_EMAIL` | `ops@aisztens.hu` (current value) |
| | DB passwords | current real values (currently live in `infra/.env`) |
| | `VAPI_WEBHOOK_SECRET` | current real value |
| | `MONITOR_ALERT_WEBHOOK_URL` | current real value (if any) |

The migration of the **current** `infra/.env` → `infra/.env.dev` is mechanical: `mv infra/.env infra/.env.dev` and edit. The deploy script + compose flow already accept `--env-file`, so the live droplet needs only `cp infra/.env.dev infra/.env` (or the deploy script does it for them) + restart.

### 5.3 `prod` (future, file ready now, droplet TBD)

| File | Key | Value |
|---|---|---|
| [`apps/api/.env.prod`](../../apps/api/.env.example) | `PORT` | `3000` |
| | `CORS_ORIGINS` | `https://web.<prod-domain>,https://admin.<prod-domain>` |
| [`apps/web/.env.prod`](../../apps/web/.env.example) | `VITE_API_BASE_URL` | `https://api.<prod-domain>/api` |
| [`apps/admin/.env.prod`](../../apps/admin/.env.example) | `VITE_API_BASE_URL` | `https://api.<prod-domain>/api` |
| [`infra/.env.prod`](../../infra/.env.example) | `DOMAIN` | `<prod-domain>` (e.g. `aisztens.com`) |
| | `ACME_EMAIL` | `ops@<prod-domain>` |
| | DB passwords, `VAPI_WEBHOOK_SECRET`, `MONITOR_ALERT_WEBHOOK_URL` | unique, generated for prod, never reused from dev |

The files exist as **templates** from day one; only the secrets and the `DOMAIN` placeholder change when the prod droplet is provisioned.

---

## 6. Code changes — file-by-file

| File | Action | Notes |
|---|---|---|
| [`.gitignore`](../../.gitignore:42) | edit | add the 6 `*.local/*.dev/*.prod` patterns (see §2.3) |
| [`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts:11) | edit | add `envFilePath` array + `ignoreEnvFile` flag, see §3.1 |
| [`apps/api/src/config/app-env.ts`](../../apps/api/src/config/app-env.ts) | **create** | `APP_ENV` constant + `isProd` flag, §3.1 |
| [`apps/api/src/main.ts`](../../apps/api/src/main.ts:30) | edit | log selected env at boot; tighten verbose error payload behind `isProd` |
| [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:1) | edit (small) | nothing — default mode is `local`; just add a `mode` parameter to scripts |
| [`apps/web/package.json`](../../apps/web/package.json) | edit | add `dev:dev`, `build:dev`, `build:prod` scripts |
| [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:1) | edit (small) | same as web |
| [`apps/admin/package.json`](../../apps/admin/package.json) | edit | same as web |
| [`apps/api/.env.example`](../../apps/api/.env.example) | rewrite | document all three envs in one file with section headers |
| [`apps/web/.env.example`](../../apps/web/.env.example) | rewrite | same |
| [`apps/admin/.env.example`](../../apps/admin/.env.example) | rewrite | same |
| [`infra/.env.example`](../../infra/.env.example) | rewrite | same; explicitly note per-env guidance in header |
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml:29) | edit (small) | add `APP_ENV: ${APP_ENV:-dev}` line to the `api.environment` block |
| [`infra/docker-compose.wsl.yml`](../../infra/docker-compose.wsl.yml:1) | rename to `infra/docker-compose.local.yml` | content stays; only the filename changes (and the header comment) |
| `apps/api/.env.local` | **create** | the four localhost CORS origins, port 3000 |
| `apps/web/.env.local`, `apps/admin/.env.local` | **create** | `VITE_API_BASE_URL=/api` |
| `apps/api/.env.dev`, `apps/web/.env.dev`, `apps/admin/.env.dev` | **create** | dev values (5.2) |
| `apps/api/.env.prod`, `apps/web/.env.prod`, `apps/admin/.env.prod` | **create** | prod templates with `<prod-domain>` placeholders (5.3) |
| `infra/.env.local` | **create** | local values (5.1); DB passwords can be `dev-` prefixed weak defaults, or generated |
| `infra/.env.dev` | **create** by renaming the current `infra/.env` | `mv infra/.env infra/.env.dev` + edit if needed |
| `infra/.env.prod` | **create** | template with placeholders |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:81) | edit | add `APP_ENV` selector, §4 |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | edit | matrix on `environment`, two secrets (`INFRA_ENV_DEV`, `INFRA_ENV_PROD`) |
| `scripts/dev-stack.sh` | **create** | local run helper, §3.4 |

**Total code edits:** ~6 small files in the runtime tree (app.module.ts, main.ts, both vite.config.ts, both package.json, the compose file). The bulk of the work is creating the example/seed env files, which is mechanical.

---

## 7. Quick-win rollout (low blast radius)

The plan is structured so each step is independently shippable and reversible.

### Step 0 — prep (no behaviour change)
- Move current `infra/.env` → `infra/.env.dev`. Update `.gitignore` patterns. Nothing else changes; the deploy script still reads `infra/.env` via its fallback branch in §4, so the dev droplet keeps working.
- Result: dev droplet unchanged, repo is ready for the next step.

### Step 1 — Vite modes (frontend only)
- Add `dev:dev` / `build:dev` / `build:prod` scripts to `apps/web/package.json` and `apps/admin/package.json`.
- Create `apps/web/.env.local` / `apps/web/.env.dev` / `apps/web/.env.prod` (and the admin counterparts).
- Update [`deploy/deploy.sh:104`](../../deploy/deploy.sh:104): replace the inline `VITE_API_BASE_URL` injection with `pnpm --filter @callback/web build --mode dev` (and `prod` for the future).
- Result: SPAs now build from per-env files; dev droplet bundle still ends up identical to today.

### Step 2 — NestJS env resolution
- Create `apps/api/src/config/app-env.ts`. Update [`app.module.ts:11`](../../apps/api/src/app.module.ts:11) to use `envFilePath` + `ignoreEnvFile`.
- Add `APP_ENV` to the `api` `environment:` block in [`docker-compose.yml:29`](../../infra/docker-compose.yml:29).
- Create `apps/api/.env.local`, `apps/api/.env.dev`, `apps/api/.env.prod`.
- Result: API now reads the right file per env; behaviour identical because the dev values equal today’s.

### Step 3 — local run helper
- Create `scripts/dev-stack.sh` (and PowerShell equivalent if needed) that runs compose with `infra/.env.local` and `docker-compose.local.yml`. Document in `README.md`.
- Result: `dev-stack.sh` becomes the single command for local development; no impact on prod/deploy.

### Step 4 — CI matrix (prepares for prod)
- Add `environment: [dev, prod]` to `.github/workflows/deploy.yml`. Branch `main` deploys dev; `prod` is `workflow_dispatch` against a protected GitHub Environment.
- Add secrets `INFRA_ENV_DEV` and `INFRA_ENV_PROD`.
- The `prod` job stays dormant until the prod droplet exists, but the matrix is already in place.
- Result: turning on prod is one droplet + one secret + one click.

---

## 8. Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| CORS mis-match after the CORS-cleanup PR | The dev `CORS_ORIGINS` already removes `api.aisztens.hu` (planned in the VAPI prompt); this plan adopts the same value. |
| Existing `infra/.env` on the dev droplet is read by both old and new deploy scripts | The new `deploy.sh` tries `infra/.env.${APP_ENV}` first and falls back to `infra/.env`, so a half-migrated droplet still works. |
| Developers forget to copy `.env.local` and the API silently falls back to defaults | `apps/api/.env.example` becomes the single source of truth for what should be in each file, and `scripts/dev-stack.sh` fails fast if `infra/.env.local` is missing. |
| A future env (e.g. `staging`) added without updating the code | The convention `envFilePath: '.env.${APP_ENV}'` + the deploy script’s `APP_ENV="${1:-dev}"` accept any value; the only requirement is the env file exists. |
| Secrets leak into a committed file by mistake | `.gitignore` covers the new patterns; the existing `infra/app/.dockerignore` already excludes `**/.env` and `**/.env.*`, so no secret enters the prod image. |
| `prod` is provisioned before this plan is complete | Step 4 is the only one required to be in place before a prod droplet exists; Steps 1–3 are improvements but not prerequisites. |

---

## 9. Open questions for the user

1. **Filename convention:** `.env.local` / `.env.dev` / `.env.prod` matches Vite’s native vocabulary, but it overlaps with `.env.local`’s standard meaning in the Node ecosystem (gitignored per-developer overrides). Acceptable? An alternative is `.env.local` / `.env.dev` / `.env.production` — the cost is one extra line in the Vite scripts.
2. **`APP_ENV` value space:** the plan uses `local` / `dev` / `prod`. If a future `staging` is anticipated, we can switch the literal to `development` / `staging` / `production` now to match NestJS/Vite defaults (`@nestjs/config` reads `NODE_ENV`; we’d add `APP_ENV` alongside, not replacing it).
3. **Caddy template:** keep the current `<DOMAIN>` / `<ACME_EMAIL>` placeholder style, or migrate to Caddy’s native `{$VAR}` envsubst at startup? The current style is simpler and is what `render_caddyfile()` already supports.
4. **First env to migrate manually:** I recommend doing the `infra/.env → infra/.env.dev` rename first (Step 0) as a one-line `git mv`; everything else flows from that. OK to proceed in that order?

---

## 10. Verifikation (after Step 2 lands)

```bash
# local
scripts/dev-stack.sh
curl -s http://localhost:3000/healthz        # → 200
curl -s http://localhost:5173               # → web SPA (built with /api)

# dev droplet (unchanged behaviour)
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml ps"
# → 4 containers Up, same as today
curl -s https://api.aisztens.hu/healthz     # → 200

# future prod droplet
ssh deployer@<prod-host> "cd /opt/aisztens && \
  APP_ENV=prod docker compose --env-file infra/.env.prod -f infra/docker-compose.yml ps"
# → 4 containers Up, secrets distinct from dev
```
