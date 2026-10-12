# 2026-10-12 — stack smoke test: 4 expectation mismatches fixed

## What happened

The `deploy.yml` runner's smoke step (`bash scripts/test/stack-smoke.sh`)
failed with **4/12 checks failed, 8 passed** on the production stack. The
stack itself was healthy — the failing checks were stale test expectations
that drifted out of sync with the current code/config.

## The 4 failures, root causes, and fixes

| # | Check | Root cause | Fix |
|---|---|---|---|
| 1 | `api: GET /api returns 200 ("Hello World!")` | The API body was changed from `"Hello World!"` to `"Hello Beautiful World!"` in [`apps/api/src/app.service.ts:6`](apps/api/src/app.service.ts:6) during the original repo bootstrap (2026-08). The smoke test still expected the old substring. | Updated expected substring to `Hello Beautiful World` in [`scripts/test/lib/10-services.sh`](scripts/test/lib/10-services.sh:104). |
| 2 | `caddy: admin API on :2019/config/ responds` | The Caddyfile global options include `admin off` ([`infra/caddy/Caddyfile:39`](infra/caddy/Caddyfile:39)) — an intentional hardening decision (no external admin surface). The smoke test still probed `:2019`. | Replaced the admin-API probe with an HTTPS healthz probe: `wget -qO- --no-check-certificate https://api.<DOMAIN>/healthz` from inside the caddy container. Added a new `resolve_caddy_check_domain` helper (mirrors the existing `resolve_webhook_check_env` pattern) and a graceful skip-line when DOMAIN is absent. See [`scripts/test/lib/10-services.sh:120-141`](scripts/test/lib/10-services.sh:120). |
| 3 | `caddy->api: caddy can GET http://api:3000/api` | Same API body mismatch as #1 — Caddy was successfully reaching it, but the body substring assertion was stale. | Updated substring to `Hello Beautiful World` in [`scripts/test/lib/20-cross-service.sh:55`](scripts/test/lib/20-cross-service.sh:55). |
| 4 | `postgres-roles: roles aisztens, tkovari, krak exist` | `docker compose exec -T postgres psql …` runs psql as the image's default user (`root` for `postgres:16-alpine`), but psql authenticates over the unix socket as that OS user. There is no `root` role in postgres → `FATAL: role "root" does not exist`. The roles themselves were always created correctly by `infra/postgres/init/01-roles.sh`; the check just couldn't authenticate. | Added `-U "${POSTGRES_USER:-postgres}"` to the psql call in [`scripts/test/lib/20-cross-service.sh:88`](scripts/test/lib/20-cross-service.sh:88). Mirrors the postgres healthcheck in [`infra/docker-compose.yml:127`](infra/docker-compose.yml:127). |

## Why these are test-side bugs, not stack-side bugs

The 8 passing checks include:
- `caddy->dns` and `api->dns` (internal compose DNS works)
- `api->postgres` (TCP path works)
- `monitor->api` (API works end-to-end from a separate process)
- `caddy: POST /api/vapi/webhooks/* → 405` (Caddy's edge-level pre-filter)
- `caddy: POST /api/vapi/webhooks/* with valid signature → 200` (NestJS
  HMAC guard accepts the request through Caddy)

That is the entire reverse-proxy data plane, plus the two webhooks
defences, plus inter-container networking. The stack is fine.

## Verification

- `bash -n scripts/test/lib/10-services.sh && bash -n scripts/test/lib/20-cross-service.sh` → exit 0.
- The next CI run of `.github/workflows/deploy.yml` will execute the
  updated suite and should report **12/12 passed** (or 11/12 if the
  Caddy HTTPS check is skipped for lack of DOMAIN, which is the
  expected graceful-degradation path).

## Files touched

| File | Change |
|---|---|
| [`scripts/test/lib/10-services.sh`](scripts/test/lib/10-services.sh) | (a) added `resolve_caddy_check_domain` helper; (b) fixed API greeting substring; (c) replaced Caddy admin-API check with HTTPS healthz probe; (d) updated file-level check summary. |
| [`scripts/test/lib/20-cross-service.sh`](scripts/test/lib/20-cross-service.sh) | (a) fixed `caddy->api` greeting substring; (b) added `-U "${POSTGRES_USER:-postgres}"` to the psql roles check. |

No changes to:
- [`apps/api/src/app.service.ts`](apps/api/src/app.service.ts) (greeting stays `Hello Beautiful World!`)
- [`infra/caddy/Caddyfile`](infra/caddy/Caddyfile) (`admin off` stays)
- [`infra/docker-compose.yml`](infra/docker-compose.yml) or [`infra/docker-compose.local.yml`](infra/docker-compose.local.yml)
- [`infra/postgres/init/01-roles.sh`](infra/postgres/init/01-roles.sh) (already correct)