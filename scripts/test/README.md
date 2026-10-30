# Stack Smoke Tests

Container-level integration tests for the docker-compose runtime stack
declared in [`infra/docker-compose.yml`](../../infra/docker-compose.yml).

These tests verify, end-to-end on a **running stack**, that every service is
healthy and that they can reach each other through the `internal` Docker
network. They complement (do NOT replace) the in-process unit and e2e tests
that live in [`apps/api/src/**/*.spec.ts`](../../apps/api/src/) and
[`apps/api/test/`](../../apps/api/test/).

> To validate the `.env` files themselves (offline syntax + explicit live
> access), use the sibling suite [`scripts/env-test/`](../env-test/README.md).

## Quick start

```bash
# 1. One-time: copy the local per-env file and fill it in.
cp infra/.env.example infra/.env.local

# 2. Bring the stack up.
pnpm test:stack:up

# 3. Run the smoke suite. The default is infra/.env.local (set in
#    scripts/test/lib/00-prelude.sh), so no --env-file is needed locally.
bash scripts/test/stack-smoke.sh
#    For a different environment (droplet / CI), point it at the matching file:
#      bash scripts/test/stack-smoke.sh --env-file infra/.env.dev

# 4. (Optional) Tear the stack down when you're done.
pnpm test:stack:down
```

If the stack is already up (e.g. started via `deploy/deploy.sh up`), step 2
is not needed — just run the suite, adding `--env-file infra/.env.dev` when
the stack was started against the dev droplet's env file.

## What it checks

Two layers of checks, all executed from the host via `docker compose exec`:

### Per-service liveness (6 checks, one per application container)

The image-based deploy (2026-10-08) introduced two more application
containers (`web`, `admin`) that the smoke suite must also probe. The
list below reflects the current `infra/docker-compose.yml` (image-based
build, no `build:` blocks):

| Service   | Check                                                              |
| --------- | ------------------------------------------------------------------ |
| api       | `GET /api` returns 200 with the `Hello Beautiful World!` body      |
| web       | `GET /` returns 200 + `text/html` (nginx serves the SPA)           |
| web-admin | `GET /` returns 200 + `text/html` (nginx serves the dashboard SPA) |
| postgres  | `pg_isready` exits 0 (user/DB resolved from `infra/.env`)          |
| caddy     | `GET https://api.<DOMAIN>/healthz` returns the prod-shaped         |
| monitor   | At least one `API check`/`API is reachable` line in the log        |

The suite **does NOT** probe the Caddy admin API (`:2019/config/`).
That endpoint is intentionally disabled (`admin off` in
[`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile)) and the admin UI
itself is not exposed on the local stack (the `local` override sets
`caddy: profiles: [never]`), so the canonical liveness check is the
HTTPS `/healthz` endpoint that the docker healthcheck and the monitor
watchdog both call.

### Cross-service — do they see each other? (6 checks)

| Check                        | Command (from inside the source container)                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `caddy` resolves `api`       | `getent hosts api`                                               |
| `api` resolves `postgres`    | `getent hosts postgres`                                          |
| `caddy → api` HTTP request   | `wget http://api:3000/healthz` → expects `{"status":"ok",...}`   |
| `api → postgres` TCP connect | `bash -c "exec 3<>/dev/tcp/postgres/5432"`                       |
| Postgres roles exist         | `psql -tAc "... WHERE rolname IN ('aisztens','tkovari','krak')"` |
| `monitor` ticked             | log scan inside the monitor container                            |

The 6th and 7th checks (VAPI webhook pre-filter and HMAC accept) live
in the **live** stack smoke suite ([`scripts/test/stack-smoke.sh`](scripts/test/stack-smoke.sh))
— they require a running `caddy` container and derive their target/secret
from `infra/.env`, which the local suite does not always have.

## Exit codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 0    | every check passed                                           |
| 1    | at least one check failed (stack was up but something broke) |
| 2    | the stack was not running and `--up` was not supplied        |

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
- `--env-file <path>` — override the default `infra/.env.local` (use
  `infra/.env.dev` for the dev-droplet layout).

## Layout

```text
scripts/test/
├── README.md           # this file
├── stack-smoke.sh      # entrypoint — runs all checks
├── stack-up.sh         # convenience wrapper for `docker compose up -d --build`
├── stack-down.sh       # convenience wrapper for `docker compose down`
├── lib/
│   ├── 00-prelude.sh   # shared helpers (logging, assertion, dc wrappers)
│   ├── 10-services.sh  # per-service liveness checks
│   ├── 20-cross-service.sh # cross-service "see each other" checks
│   └── 99-teardown.sh  # optional teardown helper
├── _deploy-sh-*.sh     # offline deploy/deploy.sh suites (no droplet needed)
├── _postgres-init-schemas-test.sh  # throwaway-container test for the Postgres init scripts
└── _stack-env-default-test.sh  # three-env leftover defaults: per-env local + deploy.sh hard-reject
```

## Offline `deploy.sh` suites (`_deploy-sh-*.sh`)

These are plain bash test scripts — no test framework, no network, no droplet. Each one
copies `deploy/deploy.sh` into a throwaway "repo" together with `deploy/lib/`, and runs it
against fixtures, so they are safe to run anywhere (including CI) and are a cheap guard
after touching the deploy script:

| Script                                   | What it locks down                                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_deploy-sh-env-selection-test.sh`       | the `[dev\|prod]` target argument: selection precedence, usage errors (exit 2), the legacy `deploy/.env` migration hint                                                                                          |
| `_deploy-sh-m1-test.sh`                  | the guard breadcrumbs (stage tags, exit codes, the logged `HOST` check)                                                                                                                                          |
| `_deploy-sh-m3-test.sh`                  | the local `infra/.env` path-resolution chain (self-contained copy of the old logic)                                                                                                                              |
| `_deploy-sh-logger-test.sh`              | `deploy/lib/logger.sh`: header/footer, level tagging, subprocess capture, retention, `latest.log`                                                                                                                |
| `_deploy-sh-remote-compose-path-test.sh` | the **remote identity** (`deployer`, never `root`) and the **remote env-file path** (`infra/.env`, never the local per-env name) plus the writability preflight, using stub `ssh`/`scp`/`rsync`/`pnpm` on `PATH` |

```bash
# Run them all from the repo root.
for t in scripts/test/_deploy-sh-*.sh; do bash "$t" || echo "FAILED: $t"; done
```

## Postgres init-script suite (`_postgres-init-schemas-test.sh`)

The compose init scripts ([`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh)
and [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh)) run **only on an empty
`pgdata` volume**, so their only honest test is a throwaway container. This suite starts
`postgres:16-alpine` with the init directory bind-mounted (exactly like the compose
files), asserts the fresh-init state — roles, the `platform` / `callback` / `email`
schemas and the grant matrix — then re-runs both scripts twice to prove idempotency and
re-asserts.

```bash
bash scripts/test/_postgres-init-schemas-test.sh
```

## Three-env leftover defaults suite (`_stack-env-default-test.sh`)

The 2026-10-05 cutover renamed `infra/.env` and `deploy/.env` into per-env files
(`infra/.env.{local,dev,prod}`, `deploy/.env.{dev,prod}`). A handful of default values
and soft fallbacks were left intact by mistake and now point at a file that does not
exist. This suite locks down the per-env default in
[`scripts/test/stack-up.sh`](../../scripts/test/stack-up.sh:23),
[`scripts/test/stack-down.sh`](../../scripts/test/stack-down.sh:21),
[`scripts/test/lib/00-prelude.sh`](../../scripts/test/lib/00-prelude.sh:60) and the
hard-reject of the legacy `infra/.env` in
[`deploy/deploy.sh:upload()`](../../deploy/deploy.sh:441). Static grep checks plus a
sandboxed `deploy.sh upload dev` run (ssh/scp/rsync/pnpm stubbed on `PATH`) prove that
a pre-cutover laptop with only the legacy `infra/.env` no longer ships that file to the
droplet silently.

```bash
bash scripts/test/_stack-env-default-test.sh
```

It needs Docker, publishes no host port and removes its container on exit. The live
counterpart lives in [`lib/20-cross-service.sh`](lib/20-cross-service.sh)
(`postgres-schemas`, `postgres-schema-usage`, `postgres-schema-create`).

## CI-deploy (`deploy.yml`) suites

The deploy workflow itself has one non-bash unit test, because the
expression-language semantics of the `if:` chain (the matrix
`matrix.app_env == …` selector) is easier to mirror in pure Python than
in bash:

| Script                            | What it locks down                                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_deploy-yml-matrix-pick-test.py` | the deploy.yml job-level `if:` that picks the right matrix entry (`dev` or `prod`) for each trigger shape (push to dev, workflow_dispatch dev/prod, workflow_run from a dev push / prod dispatch, upstream-failure, …) — 14 scenarios in total |

```bash
# Run the CI-deploy matrix-pick test (Python 3, no third-party deps).
python scripts/test/_deploy-yml-matrix-pick-test.py
```

This test was added in 2026-10-12 as part of the
[deploy.yml `env.APP_ENV` → `matrix.app_env` refactor](../../docs/milestones/2026-10-12--14-15-00-deploy-yml-env-context-matrix-fix.milestone.md).
The reason it lives in `scripts/test/` (a directory otherwise populated
by bash tests) is that the existing `for t in scripts/test/_deploy-sh-*.sh`
loop in §"Offline `deploy.sh` suites" above is only a documentation
convention — there is no machine-runner that picks up everything in
this directory, so a Python test does not break the loop. A future
hardening pass could move Python tests to `scripts/test/py/` and have
the runner invoke `python3 scripts/test/py/_deploy-yml-matrix-pick-test.py`
explicitly.

Each suite prints `N passed, M failed` and exits non-zero on any failure. For the live,
droplet-side access checks see [`../env-test/README.md`](../env-test/README.md).

The sibling [`scripts/env-test/`](../env-test/README.md) suite validates the
`.env` files themselves: offline syntax/consistency checks plus explicit
live-access checks.

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
  _service name_ (e.g. `http://api:3000/api`) and runs inside the source
  container, proving that docker compose's embedded DNS resolves names and
  that the `internal` network actually routes traffic.

## Limitations / Out of scope

- The script does not validate VAPI webhook payloads. Webhook integration
  tests require a stubbed VAPI server and belong in a separate plan.
  The **live** stack smoke suite ([`stack-smoke.sh`](stack-smoke.sh))
  has two VAPI webhook checks (Caddy 405 pre-filter + NestJS HMAC
  accept); the local suite deliberately skips them because it requires
  a running `caddy` container and a real `infra/.env` `VAPI_WEBHOOK_SECRET`.
- `apps/web` and `apps/admin` are part of the droplet compose stack since
  the 2026-10-08 image-based deploy (they live as their own `nginx`-served
  SPA containers; the SPA bundles are baked into the image). The local
  override ([`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml))
  also builds them from source. The liveness table above covers the new
  containers. The commented blocks in
  [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) that the old
  copy referenced were removed on 2026-10-12 (`caddyfile-apex-block-removed`
  history).
- No load, soak, or chaos tests. This is a smoke suite, not a benchmarking
  suite.
