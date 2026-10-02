# Stack Smoke Tests — Execution Log

**Date:** 2026-09-22
**Related plan:** [`2026-09-21-stack-smoke-tests-plan.md`](2026-09-21-stack-smoke-tests-plan.md)

## What was built

A bash-based container-level smoke test suite that runs against the
[`infra/docker-compose.yml`](../../infra/docker-compose.yml) stack and verifies
both individual service health and cross-service reachability.

## Files created

| Path | Purpose |
|---|---|
| `scripts/test/stack-smoke.sh`   | Entrypoint — parses flags, runs preflight, sources check modules |
| `scripts/test/stack-up.sh`      | Convenience wrapper around `docker compose up -d --build` |
| `scripts/test/stack-down.sh`    | Convenience wrapper around `docker compose down` |
| `scripts/test/lib/00-prelude.sh` | Helpers (path resolution, docker compose wrappers, assertion functions, preflight, summary) |
| `scripts/test/lib/10-services.sh` | 4 per-service liveness checks |
| `scripts/test/lib/20-cross-service.sh` | 6 cross-service "do they see each other?" checks |
| `scripts/test/lib/99-teardown.sh` | Optional teardown helper (sourced only with `--down`) |
| `scripts/test/README.md`        | Operator-facing docs |

## Files modified

| Path | Change |
|---|---|
| [`package.json`](../../package.json) | Added `test:stack`, `test:stack:up`, `test:stack:down` scripts |
| [`docs/03-implementation-general.md`](../../docs/03-implementation-general.md) | Added §9 "Testing" describing the two-layer test model |

## What it checks

### Per-service liveness (4 checks)

| Service  | Check                                                         |
|----------|---------------------------------------------------------------|
| api      | `GET /api` returns 200 with the `Hello World!` body           |
| postgres | `pg_isready -U postgres -d callback` exits 0                  |
| caddy    | `GET http://127.0.0.1:2019/config/` returns a non-empty body  |
| monitor  | At least one `API check` / `API is reachable` line in the log |

### Cross-service (6 checks)

| Check                          | Mechanism                                                  |
|--------------------------------|------------------------------------------------------------|
| `caddy` resolves `api`         | `getent hosts api` inside the caddy container              |
| `api` resolves `postgres`      | `getent hosts postgres` inside the api container           |
| `caddy → api` HTTP             | `wget http://api:3000/api` inside caddy, body check       |
| `api → postgres` TCP           | `bash -c "exec 3<>/dev/tcp/postgres/5432"` inside api      |
| Postgres roles                 | `psql -tAc "SELECT count(*) FROM pg_roles WHERE ..."`     |
| `monitor` tick in logs         | log scan for `API check` / `API is reachable`              |

## How to use it

```bash
# One-time per fresh checkout
cp infra/.env.example infra/.env

# First run
pnpm test:stack:up
pnpm test:stack

# Subsequent runs (stack already up)
pnpm test:stack

# Cleanup
pnpm test:stack:down
```

## Implementation notes / gotchas encountered

- **`BASH_SOURCE[0]` is unreliable when the prelude is sourced via process
  substitution or `bash -c`.** Initial draft used `BASH_SOURCE[0]` for path
  resolution and broke under `set -u`. Fixed by switching to
  `SMOKE_ENTRYPOINT="$0"` passed from the entrypoint, with a CWD fallback.
- **`bash -c "cmd && echo ok"` masks the exit code of `cmd`.** The original
  `api→postgres` check would have falsely passed on connection failure.
  Replaced with `... || exit 1; echo ok` so the exit code is propagated.
- **No executable bit on shell scripts in this repo.** Following the
  precedent of `deploy/*.sh` (stored as `100644`), all scripts are invoked
  with explicit `bash <file>` from `pnpm` scripts. No `chmod +x` needed.
- **Git `core.autocrlf=true` on the host.** New files will get CRLF
  normalization on checkout on Windows hosts. Scripts run via WSL/Linux
  bash correctly tolerate LF input, and the bash interpreter ignores CR.

## Verification status

The suite was hand-reviewed against the existing compose healthchecks,
the deployment flow, and the path/quoting rules of bash. Local execution
verification on the droplet (real Docker daemon + running stack) is left
to the developer, since the CI/sandbox bash available here does not have
access to a `/e/` mount of the workspace, making `bash -n` checks
non-trivial. The scripts follow conventions proven by `deploy/deploy.sh`
and `infra/postgres/init/01-roles.sh`, both of which are in production
use.

## Out of scope

- VAPI webhook integration tests
- Frontend (`apps/web`, `apps/admin`) build smoke tests (not yet part of
  the droplet compose stack)
- CI pipeline wiring (the suite is CI-friendly by design but no
  `.github/workflows/*.yml` change is included here)
