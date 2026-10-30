# 2026-10-13 — Postgres init shipping + role bootstrap fix

## Context

Follow-up question on the deploy-process work: "how is the postgres image
created, built and deployed — or is it not deployed, just created once?"

Answering it required checking the live droplet, which surfaced three real
defects (D1, D2, D4) plus two open items (D3, D5).

## How Postgres actually works (for the record)

- **Not built by us.** [`.github/workflows/images.yml`](../../.github/workflows/images.yml)
  builds only `aisztens-api` / `-web` / `-admin` / `-monitor`. There is no
  Postgres Dockerfile.
- **Official upstream image.** [`infra/docker-compose.yml`](../../infra/docker-compose.yml)
  pins `postgres:16-alpine` → pulled from **Docker Hub**, and it is **exempt
  from `IMAGE_TAG` pinning** (the `deploy.yml` verification step only checks
  `api`/`web`/`admin`/`monitor`).
- **Container is re-created every deploy; data is not.**

  Live evidence: `volume aisztens_pgdata -> /var/lib/postgresql/data (rw=true)`.

- **The role/schema bootstrap is one-time.** compose bind-mounts
  `./postgres/init:/docker-entrypoint-initdb.d:ro`; the official entrypoint
  runs those scripts only on the **first initialization of an empty `pgdata`
  volume** and otherwise logs
  `PostgreSQL Database directory appears to contain a database; Skipping initialization`.

So: image/container = redeployed each deploy; init = once per volume lifetime.

## Defects found (live host evidence)

| ID              | Defect                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**          | `infra/postgres/init/**` is **not shipped by any deploy path**, although compose bind-mounts it. It existed on the droplet only as a leftover of the pre-2026-10-08 rsync (the whole old tree is still there: `app/`, `monitor/`, `.env.dev`, `.env.example`, `docker-compose.local.yml`, `docker-compose.yml.prev-build`). | `deploy.yml` scp source list and `deploy.sh upload()` contained only compose/.env/Caddyfile (+smoke tests).                                                           |
| **D2**          | The role bootstrap had **never taken effect** on the dev droplet.                                                                                                                                                                                                                                                           | `SELECT rolname FROM pg_roles` → only `postgres` + built-in `pg_*` roles; `aisztens`, `tkovari`, `krak` absent. Log: `Skipping initialization`.                       |
| **D4**          | [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) was **itself broken**: it wrapped the `CREATE ROLE` logic in `DO $$ … $$` and used `:'var'` inside. psql does not interpolate inside dollar-quoted strings.                                                                                      | Running it: `ERROR: syntax error at or near ":"  LINE 3: …rolname = :'aisztens…` (exit 3).                                                                            |
| **D3** _(open)_ | DB-name drift: droplet `infra/.env` has `POSTGRES_DB=aisztens_db`; the repo default/example and several docs/scripts use `callback`.                                                                                                                                                                                        | Live DBs: `aisztens_db`, `postgres`, `template0/1`. Probes using `-d callback` fail with `database "callback" does not exist`.                                        |
| **D5** _(open)_ | The smoke suite's Postgres check invocation is malformed: `psql -tAc -U <user> "SQL"` makes `-c` swallow `-U`, so the SQL text is used as the username.                                                                                                                                                                     | `psql: FATAL: role "SELECT count(*) FROM pg_roles WHERE rolname IN ('aisztens','tko" does not exist` (exit 2). Correct form is `psql -U <user> -d <db> -At -c "SQL"`. |

## Fixes applied

| File                                  | Change                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`        | Added `infra/postgres/init` to the deploy job's `sparse-checkout` **and** to the `appleboy/scp-action` `source` list (with a comment explaining why it is required).                                                                                    |
| `deploy/deploy.sh`                    | `upload()` now `scp -r`s `infra/postgres/init` into `$REMOTE_DIR/infra/postgres/` (creates `infra/postgres` first, warns if the source dir is missing); header/usage/wording updated from "3 files" to "the deploy files".                              |
| `infra/postgres/init/01-roles.sh`     | Rewritten without `DO $$ … $$`: idempotent `SELECT format('CREATE ROLE …') WHERE NOT EXISTS … \gexec` + `ALTER ROLE … WITH LOGIN PASSWORD …`, then the `ALTER DATABASE … OWNER TO …` and `GRANT CONNECT`. Header documents the psql interpolation trap. |
| `docs/Specs/Infrastructure-Docker.md` | New **§6.2** documenting that Postgres is not our image, is Docker Hub–sourced, is exempt from `IMAGE_TAG`, and that the init script runs once per volume — plus the manual re-apply command and the `DO $$` prohibition.                               |

## Verification performed

- `bash -n deploy/deploy.sh` → `SYNTAX_OK_DEPLOY_SH`
- `python -c "yaml.safe_load(open('.github/workflows/deploy.yml').read())"` → `YAML_OK_DEPLOY_YML`
- Shipped the corrected script to `/opt/aisztens/infra/postgres/init/01-roles.sh`
  (this exercises the D1 path: the file lands exactly where the read-only bind
  mount expects it).
- Ran it via the container's init path:
  `docker compose exec -T postgres bash /docker-entrypoint-initdb.d/01-roles.sh`
  → `CREATE ROLE / ALTER ROLE` ×3, `ALTER DATABASE`, `GRANT`, **exit 0**.
- Post-state:
  - `aisztens login=true`, `krak login=true`, `tkovari login=true`
  - `aisztens_db owner=aisztens`

## Why D4 mattered for D1

Shipping the init directory _without_ fixing the script would have turned a
silent problem into a hard one: on a fresh droplet the entrypoint would execute
the broken script during first init, fail, and leave Postgres in a restart
loop. D1 and D4 had to be fixed together.

## Second round (approved): D5 + D3 fixed

### D5 — smoke-suite invocation

The check used `psql -tAc -U <user> "SQL"`. `-c` consumes the next argv, so
`-c`'s argument became `-U` and the SQL text was sent as the **username**
(`FATAL: role "SELECT count(*) …" does not exist`). Fixed to
`psql -U <user> -d <db> -At -c "SQL"`, with the trap documented in a comment.

Both Postgres checks now read their user/DB from `$ENV_FILE` (infra/.env)
through a new `resolve_env_value()` helper added to
[`scripts/test/lib/00-prelude.sh`](../../scripts/test/lib/00-prelude.sh) —
hard-coding is what caused the D3 drift in the first place.

### D3 — DB-name drift reconciled to `aisztens_db`

| File                                   | Change                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `infra/.env.example`                   | `POSTGRES_DB=callback` → `aisztens_db` (+ comment naming the owner role)                                           |
| `infra/docker-compose.yml`             | three `${POSTGRES_DB:-callback}` defaults (api `DATABASE_URL`, postgres env, postgres healthcheck) → `aisztens_db` |
| `scripts/test/lib/10-services.sh`      | `pg_isready` check resolves user/DB from `infra/.env`; label no longer hard-codes `-d callback`                    |
| `scripts/test/lib/20-cross-service.sh` | roles check resolves user/DB from `infra/.env`                                                                     |
| `scripts/env-test/check-env-live.sh`   | fallback default → `aisztens_db`                                                                                   |
| `scripts/dev-stack.sh`                 | the printed `psql` hint → `-d aisztens_db`                                                                         |
| `scripts/test/README.md`               | the `postgres` row no longer names `-d callback`                                                                   |
| `docs/Specs/Production-Runbook.md`     | §4.4 `pg_isready` default and §5 `pg_isready -U aisztens -d callback` → `aisztens_db`                              |
| `docs/Specs/Three-Env-Verification.md` | §2.2/§2.7 local `psql -d callback` snippets → `aisztens_db`                                                        |
| `docs/docker-debug-playbook.md`        | 3 `psql`/`pg_isready` snippets → `aisztens_db`                                                                     |
| `docs/docker-cheatsheet.md`            | 6 `psql`/`pg_isready` snippets → `aisztens_db`                                                                     |

### Verification (suite re-run on the droplet)

The three changed suite libs were pushed to `/opt/aisztens/scripts/test/lib/`
(the local `bash` is WSL, so the drvfs key had to be copied to `~/.ssh` with
`chmod 600` before `scp` would accept it) and the suite was executed:

```
[ OK ]postgres: pg_isready (postgres is accepting connections)
[ OK ]postgres-roles: roles aisztens, tkovari, krak exist
```

**Check #5 is green** — D2's fix is now observable end-to-end.

### D7 — Caddy healthz assertion (third round)

The check asserted that the **body** of `wget -qO- https://api.<DOMAIN>/healthz`
contains `200`. `-qO-` prints only the body, and that body is JSON
(`{"status":"oks",…}`) — the HTTP status is never in it, so the check failed on
a perfectly healthy stack. It now asserts on the stable liveness field
`"status":"oks"` ([`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh)).

### Final verification

Suite re-run on the droplet after pushing the fixed `10-services.sh`:

```
2/12 checks failed (10 passed)
[ OK ]postgres: pg_isready (postgres is accepting connections)
[ OK ]caddy: HTTPS healthz through api.<DOMAIN> returns the liveness JSON   <- was FAIL
[ OK ]postgres-roles: roles aisztens, tkovari, krak exist                   <- was FAIL
```

Only the two greeting checks remain red, both due to **D6** (stale image):

- `api: GET /api … (expected substring: Hello World)`
- `caddy->api: … (expected substring: Hello World)` — actual
  `Hello Beautiful World!`, served by image `sha-da33609`, while `HEAD`
  (`cc5a692`, after `52fefc8 change hello beautiful world to hello world`)
  returns `Hello World!`. Both pass after the next `images.yml` build +
  `deploy.yml` run.

## Still open

- **D6** — droplet runs a stale image; resolves on the next
  `images.yml` build + `deploy.yml` run. Until then deploy step 9 is red.
- **`deploy/deploy.sh` does not ship `scripts/test/`** while
  `.github/workflows/deploy.yml` does. The runbook's §3.7 hint ("if
  stack-smoke.sh is missing on the droplet, deploy.sh did not ship
  scripts/test/ — re-run deploy.sh") is therefore incorrect.
- The droplet still carries the pre-image-based leftovers
  (`infra/app`, `infra/monitor`, `infra/.env.dev`, `infra/.env.local`,
  `infra/.env.example`, `infra/docker-compose.yml.prev-build`). Harmless but
  confusing; they are evidence that the old rsync-era tree was never cleaned.
