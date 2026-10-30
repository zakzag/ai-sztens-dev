# Stack smoke test — four expectation mismatches fixed

## 1. Problem / feature

The `deploy.yml` runner's smoke step (`bash scripts/test/stack-smoke.sh`)
on the production droplet returned **4/12 checks failed, 8 passed** with
exit code 1, blocking deploys. The failing checks were misleading:
their symptoms looked like stack-level breakage, while the real cause
was stale test expectations that no longer matched the current code or
intentional security configuration.

## 2. Measured data / evidence

| Check                                                 | Symptom                                                                 | Real cause                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api: GET /api returns 200 ("Hello World!")`          | `expected substring: Hello World`; actual body `Hello Beautiful World!` | API greeting was changed in [`apps/api/src/app.service.ts:6`](apps/api/src/app.service.ts:6) during repo bootstrap (2026-08); smoke test was not.                                                                                       |
| `caddy: admin API on :2019/config/ responds`          | `wget: can't connect to remote host (127.0.0.1): Connection refused`    | [`infra/caddy/Caddyfile:39`](infra/caddy/Caddyfile:39) sets `admin off` (intentional hardening — no external admin surface). Smoke test was written before that.                                                                        |
| `caddy->api: caddy can GET http://api:3000/api`       | `expected substring: Hello World`; actual `Hello Beautiful World!`      | Same as #1.                                                                                                                                                                                                                             |
| `postgres-roles: roles aisztens, tkovari, krak exist` | `FATAL: role "root" does not exist`                                     | `docker compose exec` defaults to the image's primary user (root for `postgres:16-alpine`); psql authenticates over the unix socket as that OS user; the `root` role is not in postgres. The three roles were always created correctly. |

Counter-evidence the stack is healthy (8/12 passes):
internal DNS resolves both ways, monitor → API works end-to-end,
caddy → postgres TCP path works, and both Caddy pre-filter (405) +
NestJS HMAC guard (200) webhooks pass through Caddy.

## 3. Root cause or design rationale

Three of the four mismatches are textbook "spec drift" — test code that
was never updated when the code under test changed. The fourth
(postgres) is a "production deploy ≠ local dev" trap: the postgres
image's daemon runs as the `postgres` user, but `docker compose exec`
runs as the image's first user (`root`); the smoke check did not pass `-U`
to psql, so it relied on unix-socket peer-auth as the OS user — which
works locally (where the local user is also the postgres superuser)
but fails in CI where `docker compose exec` enters as root.

**Design decision for the Caddy check:** rather than re-enable the admin
API (which would undo the `admin off` hardening), the check was
replaced with one that proves the same operational property (Caddy is
up, has bound :443, loaded the rendered config, routed to api:3000)
via the actual public path: `https://api.<DOMAIN>/healthz`. This is a
strictly stronger check than the previous admin-API probe.

## 4. Solution / implementation

| File                                                                           | Change                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`scripts/test/lib/10-services.sh`](scripts/test/lib/10-services.sh)           | Added `resolve_caddy_check_domain` helper. Updated `api` check expected substring to `Hello Beautiful World`. Replaced Caddy `:2019` admin-API probe with HTTPS healthz probe via `https://api.<DOMAIN>/healthz` (with graceful skip when DOMAIN missing). Updated file-level check summary. |
| [`scripts/test/lib/20-cross-service.sh`](scripts/test/lib/20-cross-service.sh) | Updated `caddy->api` expected substring to `Hello Beautiful World`. Added `-U "${POSTGRES_USER:-postgres}"` to the psql roles check (mirrors the postgres healthcheck in [`infra/docker-compose.yml:127`](infra/docker-compose.yml:127)).                                                    |

No source code, compose, Caddyfile, or init script was changed.

## 5. Outcome and how to verify

`bash -n` lint on both edited files exits 0 (already verified locally).

After the next CI deploy, the smoke step in `.github/workflows/deploy.yml`
should report either:

- **12/12 checks passed** if DOMAIN is set in `infra/.env` on the
  droplet (which is the production case), OR
- **11/12 passed, 1 skipped** with a `[..]Skipping Caddy HTTPS probe`
  log line if DOMAIN is absent (graceful-degradation path).

Manual reproduction:

```bash
ssh deployer@<droplet>
cd ~/ai-sztens-dev
bash scripts/test/stack-smoke.sh
```

## 6. Follow-ups

- If anyone later flips `admin off` to `admin :2019` in the Caddyfile
  (e.g. for runtime config inspection), revert the HTTPS probe and
  restore the old admin-API check — the admin endpoint being reachable
  is then the right signal.
- Consider asserting the full greeting string `"Hello Beautiful World!"`
  in the future and exposing the literal from
  [`apps/api/src/app.service.ts:6`](apps/api/src/app.service.ts:6)
  via a single-source-of-truth constant if it ever becomes load-bearing
  for more than one test.
