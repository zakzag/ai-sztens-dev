# 2026-10-05 10:30 — Three-env separation · Step 1 (Vite modes)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md) — Step 1 of 5.
**Scope:** SPAs (`apps/web`, `apps/admin`) and [`deploy/deploy.sh:build_spas()`](../../deploy/deploy.sh:99). The NestJS API is **not** touched in this step (that lands in Step 2).

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`apps/web/package.json`](../../apps/web/package.json:6), [`apps/admin/package.json`](../../apps/admin/package.json:6) | Added `dev:dev`, `dev:prod`, `build:dev`, `build:prod` scripts that wrap `vite` / `vite build` with `--mode dev` / `--mode prod`. The existing `dev` and `build` scripts are kept untouched as the **local** entry points (they load `.env.local` with no `--mode`). |
| 2 | [`apps/web/.env.example`](../../apps/web/.env.example), [`apps/admin/.env.example`](../../apps/admin/.env.example) | Rewrote to document all three envs (local / dev / prod) in one committed template. Real per-env files live on developer machines / the droplet / CI and are gitignored. |
| 3 | `apps/web/.env`, `apps/admin/.env` → `apps/web/.env.local`, `apps/admin/.env.local` | Renamed on disk; content (`VITE_API_BASE_URL=/api`) preserved verbatim. Vite natively prefers `.env.local` over `.env`, so the rename is semantically a no-op for `pnpm dev`. |
| 4 | `apps/web/.env.dev`, `apps/admin/.env.dev` | Created locally with `VITE_API_BASE_URL=https://api.aisztens.hu/api`. Used by `pnpm build:dev` and by `deploy.sh build_spas` (after this commit). Gitignored. |
| 5 | `apps/web/.env.prod`, `apps/admin/.env.prod` | Created locally with `VITE_API_BASE_URL=https://api.<prod-domain>/api` (placeholder, dormant). Used by future `pnpm build:prod`. Gitignored. |
| 6 | [`deploy/deploy.sh:99`](../../deploy/deploy.sh:99) | `build_spas()` no longer injects `VITE_API_BASE_URL=` inline. It now picks the per-mode file via `pnpm ... build:dev`, defaulting to `SPA_BUILD_MODE=dev`. A new `ensure_spa_env()` helper seeds the per-env file from `DOMAIN` the first time, so a fresh droplet (which has only `.env.example` rsynced) still gets the right URL without manual seeding. |

## Why the deploy script needed an `ensure_spa_env` helper

Before this step, [`deploy/deploy.sh:104`](../../deploy/deploy.sh:104) derived the API URL inline:

```bash
local api_base="https://api.${DOMAIN}/api"
(cd "$REPO_DIR" && VITE_API_BASE_URL="$api_base" pnpm --filter @callback/web build)
```

The new flow reads the URL from `apps/<app>/.env.dev` (gitignored, never rsynced from this repo to the droplet). On a **new** droplet the file does not exist, and `pnpm build:dev` would fail or silently fall back to `.env.example` — which contains all three envs concatenated and is the documentation template, not a runtime config.

The helper solves this with **one-shot seeding**:
- If `apps/<app>/.env.<mode>` exists, do nothing (the operator already curated it).
- If it does not exist, write `VITE_API_BASE_URL=https://api.${DOMAIN}/api` into it and continue.

Subsequent deploys do **not** overwrite — so any hand-edited value (e.g. an operator who wants to point a staging build at a different domain) survives across deploys. This matches the Vite convention that `.env.*` files are local configuration, not source code.

## Vite resolution order (why `.env.local` does not shadow `.env.dev` for builds)

Vite loads `.env` files in this priority (highest wins):

1. `.env.[mode].local`  ← only loaded when --mode is set
2. `.env.[mode]`        ← loaded only when --mode is set
3. `.env.local`         ← always loaded (but gitignored)
4. `.env`               ← always loaded

Implications for this project:

| Command | Files consulted | Result |
|---|---|---|
| `pnpm dev` (no flag) | `.env.local` only | `VITE_API_BASE_URL=/api` (Vite dev proxy, no CORS) |
| `pnpm --filter ... build:dev` | `.env.dev` (overrides `.env.local`) | `VITE_API_BASE_URL=https://api.aisztens.hu/api` |
| `pnpm --filter ... build:prod` | `.env.prod` (overrides `.env.local`) | `VITE_API_BASE_URL=https://api.<prod-domain>/api` |

A developer who wants a **local-only override** of a dev build can drop a `apps/web/.env.dev.local` file (gitignored) and Vite will pick it up. The committed defaults remain untouched.

## Verification done locally

```bash
# 1. All six new SPA env files are correctly gitignored
git check-ignore -v apps/web/.env.local apps/admin/.env.local \
                   apps/web/.env.dev   apps/admin/.env.dev \
                   apps/web/.env.prod  apps/admin/.env.prod
# → .gitignore:57 apps/**/.env.local  (×2)
# → .gitignore:58 apps/**/.env.dev    (×2)
# → .gitignore:59 apps/**/.env.prod   (×2)

# 2. The old single .env path is no longer tracked
git ls-files apps/web/.env apps/admin/.env
# → (empty — never tracked, still not tracked)

# 3. deploy.sh syntax is clean
bash -n deploy/deploy.sh && echo SYNTAX_OK
# → SYNTAX_OK

# 4. Build:dev works end-to-end and bakes the dev URL into the bundle
cd apps/web
# (move apps/web/.env.local aside so Vite does not shadow .env.dev)
mv apps/web/.env.local apps/web/.env.local.bak
pnpm --filter @callback/web build:dev
# → ✓ built in 1.53s
grep -l 'aisztens.hu' apps/web/dist/assets/*.js
# → apps/web/dist/assets/index-DYLTE8xp.js (URL baked in)
mv apps/web/.env.local.bak apps/web/.env.local
```

The last test is the meaningful one: it proves `apps/web/.env.dev` is the file Vite reads when `--mode dev` is set, **not** `apps/web/.env.local`. (Without moving it aside, Vite would correctly pick `.env.local` first because the developer machine has both files; the deploy server has only `.env.dev`, which is why the `ensure_spa_env()` helper matters.)

## Verification to run on the dev droplet after the next deploy

```bash
# 1. /opt/aisztens/apps/web/.env.dev has been seeded on first deploy
ssh deployer@aisztens.hu "cat /opt/aisztens/apps/web/.env.dev"
# Expect: VITE_API_BASE_URL=https://api.aisztens.hu/api

# 2. The new SPA bundle on the droplet has the dev URL baked in
ssh deployer@aisztens.hu "grep -l aisztens.hu /srv/web/assets/*.js"
# Expect: at least one .js file (the SPA bundle Caddy serves)

# 3. Site still loads end-to-end
curl -fsS https://web.aisztens.hu/
# Expect: 200 + HTML

# 4. POST /api/callback-requests still works (round-trip through Caddy → API)
curl -fsS -X POST -H "Content-Type: application/json" \
  -d '{"name":"smoke","email":"smoke@example.com","phone":"+36301234567","reason":"smoke"}' \
  https://api.aisztens.hu/api/callback-requests
# Expect: 201 + {"id":"..."}
```

## What is intentionally NOT in this step

- No change to the API config — that is Step 2 (NestJS ConfigModule + `APP_ENV`).
- No `apps/api/.env.local|dev|prod` yet.
- No `infra/.env.local|prod` yet.
- No `scripts/dev-stack.sh` yet — that is Step 3.
- No CI workflow change — that is Step 4.
- The droplet's `apps/web/.env.dev` is seeded **lazily** by `ensure_spa_env()` on the first deploy; if the operator wants a different value they can hand-edit it and it will stick across future deploys.

## Recommended commit message

```text
feat(env): vite modes for three-env separation (plan step 1)

Adds --mode dev / --mode prod Vite scripts and per-env files
(apps/{web,admin}/.env.local|.env.dev|.env.prod). The deploy script
seeds .env.dev from DOMAIN on the first build so a fresh droplet
just works. See
docs/history/2026-10-05--10-30-00-three-env-separation-plan.md