# Stack Smoke Tests

Container-level integration tests for the docker-compose runtime stack
declared in [`infra/docker-compose.yml`](../../infra/docker-compose.yml).

These tests verify, end-to-end on a **running stack**, that every service is
healthy and that they can reach each other through the `internal` Docker
network. They complement (do NOT replace) the in-process unit and e2e tests
that live in [`apps/api/src/**/*.spec.ts`](../../apps/api/src/) and
[`apps/api/test/`](../../apps/api/test/).

## Quick start

```bash
# 1. One-time: copy the env file and fill it in.
cp infra/.env.example infra/.env

# 2. Bring the stack up.
pnpm test:stack:up

# 3. Run the smoke suite.
pnpm test:stack

# 4. (Optional) Tear the stack down when you're done.
pnpm test:stack:down
```

If the stack is already up (e.g. started via `deploy/deploy.sh up`), step 2
is not needed — just run `pnpm test:stack`.

## What it checks

Two layers of checks, all executed from the host via `docker compose exec`:

### Per-service liveness (4 checks)

| Service  | Check                                                       |
|----------|-------------------------------------------------------------|
| api      | `GET /api` returns 200 with the `Hello World!` body         |
| postgres | `pg_isready -U postgres -d callback` exits 0                |
| caddy    | `GET http://127.0.0.1:2019/config/` returns a non-empty body|
| monitor  | At least one `API check`/`API is reachable` line in the log  |

### Cross-service — do they see each other? (6 checks)

| Check                         | Command (from inside the source container)                       |
|-------------------------------|------------------------------------------------------------------|
| `caddy` resolves `api`        | `getent hosts api`                                               |
| `api` resolves `postgres`     | `getent hosts postgres`                                          |
| `caddy → api` HTTP request    | `wget http://api:3000/api` → expects `Hello World`               |
| `api → postgres` TCP connect  | `bash -c "exec 3<>/dev/tcp/postgres/5432"`                        |
| Postgres roles exist          | `psql -tAc "... WHERE rolname IN ('aisztens','tkovari','krak')"` |
| `monitor` ticked              | log scan inside the monitor container                             |

## Exit codes

| Code | Meaning                                                       |
|------|---------------------------------------------------------------|
| 0    | every check passed                                            |
| 1    | at least one check failed (stack was up but something broke)  |
| 2    | the stack was not running and `--up` was not supplied         |

## Flags

```text
stack-smoke.sh [--up] [--down] [--yes]
               [--compose-file <path>] [--env-file <path>]
```

- `--up` — also run `docker compose up -d --build` before testing.
- `--down` — run `docker compose down` after a successful run
  (asks for confirmation unless `--yes` is also given).
- `--yes` / `-y` — skip the teardown confirmation prompt.
- `--compose-file <path>` — override `infra/docker-compose.yml`.
- `--env-file <path>` — override `infra/.env`.

## Layout

```text
scripts/test/
├── README.md           # this file
├── stack-smoke.sh      # entrypoint — runs all checks
├── stack-up.sh         # convenience wrapper for `docker compose up -d --build`
├── stack-down.sh       # convenience wrapper for `docker compose down`
└── lib/
    ├── 00-prelude.sh   # shared helpers (logging, assertion, dc wrappers)
    ├── 10-services.sh  # per-service liveness checks
    ├── 20-cross-service.sh # cross-service "see each other" checks
    └── 99-teardown.sh  # optional teardown helper
```

## Design notes

- **Read-only with respect to the stack.** No container, image, or volume is
  modified by `pnpm test:stack` on its own. The suite only observes.
- **CI-friendly.** Output is colored only on a TTY, and exit codes map to
  pass/fail/stack-down, so a CI job can gate on them directly.
- **Service contracts match compose healthchecks.** The `api` check uses the
  exact same `node -e "fetch(...)"` command that `infra/docker-compose.yml`
  defines as the api healthcheck, so the suite cannot drift from what
  compose considers healthy.
- **Network proof, not just liveness.** Every cross-service check uses the
  *service name* (e.g. `http://api:3000/api`) and runs inside the source
  container, proving that docker compose's embedded DNS resolves names and
  that the `internal` network actually routes traffic.

## Limitations / Out of scope

- The script does not validate VAPI webhook payloads. Webhook integration
  tests require a stubbed VAPI server and belong in a separate plan.
- `apps/web` and `apps/admin` are not part of the droplet compose stack yet
  (see commented blocks in `infra/caddy/Caddyfile`), so they are not
  exercised here.
- No load, soak, or chaos tests. This is a smoke suite, not a benchmarking
  suite.
