# Milestone — Postgres init shipping + role-bootstrap regression (D1/D2/D4)

**Date:** 2026-10-13

## 1. Problem / feature

Answering "how is the Postgres image created, built and deployed?" required
checking the live droplet. Three defects surfaced:

- **D1** — `infra/postgres/init/**` was **not shipped by any deploy path**,
  even though [`infra/docker-compose.yml`](../../infra/docker-compose.yml)
  bind-mounts `./postgres/init:/docker-entrypoint-initdb.d:ro`.
- **D2** — the role bootstrap had **never taken effect** on the dev droplet.
- **D4** — the init script itself was **broken** and could never have worked.

## 2. Measured data / evidence

| Observation | Command / source | Result |
|---|---|---|
| Roles present | `SELECT rolname FROM pg_roles` | only `postgres` + built-in `pg_*`; `aisztens`, `tkovari`, `krak` **absent** |
| Why no init ran | `docker logs aisztens-postgres-1` | `PostgreSQL Database directory appears to contain a database; Skipping initialization` |
| Bind mount target | `docker inspect -f '{{range .Mounts}}…' aisztens-postgres-1` | `bind /opt/aisztens/infra/postgres/init -> /docker-entrypoint-initdb.d (rw=false)` |
| Data volume | same | `volume aisztens_pgdata -> /var/lib/postgresql/data (rw=true)` |
| Init script behaviour | `docker compose exec -T postgres bash /docker-entrypoint-initdb.d/01-roles.sh` | `ERROR: syntax error at or near ":"` (exit 3) |
| Postgres source | [`deploy/.env.example`](../../deploy/.env.example) + compose | `postgres:16-alpine` from Docker Hub, exempt from `IMAGE_TAG` |

## 3. Root cause / design rationale

- **D1** is a regression of the image-based migration (2026-10-08): the old
  rsync uploaded the whole repo, so the init dir arrived for free. When the
  deploy switched to scp'ing a fixed file list, `infra/postgres/init` was
  forgotten in both `deploy.yml` and `deploy.sh`. It kept working on the
  existing droplet **only** because the old rsynced tree was never deleted.
- **D2** is the direct consequence of D1 + D4 on this droplet: the volume was
  initialized before the script was in place, and `pgdata` is never
  re-initialized, so the (broken) script never had a chance to run — and would
  have failed anyway.
- **D4**: `psql` performs `:'var'` / `:"var"` substitution **lexically** and does
  **not** interpolate inside dollar-quoted strings. `DO $$ … $$` therefore
  received the literal text `:'aisztens_db_user'`, which the server rejects.

## 4. Solution / implementation

| File | Change |
|---|---|
| `.github/workflows/deploy.yml` | `infra/postgres/init` added to the deploy job's `sparse-checkout` **and** to the `appleboy/scp-action` `source` list, with a comment explaining that the bind mount depends on it |
| `deploy/deploy.sh` | `upload()` now `scp -r`s `infra/postgres/init` into `$REMOTE_DIR/infra/postgres/` (mkdir first, warn if absent); header/usage wording updated from "3 files" to "the deploy files" |
| `infra/postgres/init/01-roles.sh` | Rewritten without `DO $$ … $$`: idempotent `SELECT format('CREATE ROLE …') WHERE NOT EXISTS … \gexec`, then `ALTER ROLE … WITH LOGIN PASSWORD …`, then `ALTER DATABASE … OWNER TO …` / `GRANT CONNECT`. The psql interpolation trap is documented in the header |
| `docs/Specs/Infrastructure-Docker.md` | New **§6.2**: Postgres is not our image, is Docker Hub–sourced, is exempt from `IMAGE_TAG`, the container is re-created per deploy while `pgdata` persists, the init runs once per volume, plus the manual re-apply command and the `DO $$` prohibition |

D1 and D4 had to land together: shipping the init dir without fixing the script
would make a **fresh** droplet execute the broken script at first init, fail,
and leave Postgres in a restart loop.

## 5. Outcome and how to verify

- `bash -n deploy/deploy.sh` → `SYNTAX_OK_DEPLOY_SH`; `yaml.safe_load(deploy.yml)` → `YAML_OK_DEPLOY_YML`.
- Post-state on the dev droplet:
  `aisztens login=true`, `krak login=true`, `tkovari login=true`, and
  `aisztens_db owner=aisztens`.
- Re-verify at any time:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml \
  exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT rolname FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak') ORDER BY 1"
# expect 3 rows

# idempotent re-apply (safe):
docker compose --env-file infra/.env -f infra/docker-compose.yml \
  exec -T postgres bash /docker-entrypoint-initdb.d/01-roles.sh
```

- Fresh-droplet proof: after a deploy, `/opt/aisztens/infra/postgres/init/01-roles.sh`
  must exist **before** the first `docker compose up`.

## 6. Follow-ups

### Resolved in the same session (D3, D5, D7)

- **D5 — fixed.** Both Postgres checks now use a working invocation
  (`psql -U <user> -d <db> -At -c "SQL"`); `-c` no longer swallows `-U`.
  User/DB are read from `$ENV_FILE` (infra/.env) through a new
  `resolve_env_value()` helper in
  [`scripts/test/lib/00-prelude.sh`](../../scripts/test/lib/00-prelude.sh),
  so the checks cannot drift from the compose config again.
  **Verified** by re-running the suite on the droplet:
  `[ OK ]postgres-roles: roles aisztens, tkovari, krak exist`.
- **D3 — reconciled to `aisztens_db`** in `infra/.env.example`,
  `infra/docker-compose.yml` (3 defaults), `scripts/env-test/check-env-live.sh`,
  `scripts/dev-stack.sh`, `scripts/test/README.md`, and the snippets in
  `docs/Specs/Production-Runbook.md`, `docs/Specs/Three-Env-Verification.md`,
  `docs/docker-debug-playbook.md`, `docs/docker-cheatsheet.md`.
- **D7 — fixed.** [`scripts/test/lib/10-services.sh`](../../scripts/test/lib/10-services.sh)
  asserted that the response **body** of `wget -qO- https://api.<DOMAIN>/healthz`
  contains `200`, but `-qO-` prints only the body, which is JSON
  (`{"status":"oks",…}`) — the HTTP status is never in it, so the check failed
  on a healthy stack. It now asserts on the stable liveness field
  `"status":"oks"`. Suite after the fix: **10/12 passed**.

### Still open

- **D6 — the droplet runs a stale image.** The suite's two greeting checks fail
  because the running image (`sha-da33609`) still returns
  `Hello Beautiful World!`, while `HEAD` (`cc5a692`, after
  `52fefc8 change hello beautiful world to hello world`) returns
  `Hello World!`. Not a defect — it clears on the next `images.yml` build +
  deploy. **Deploy step 9 stays red until then.**
- **`deploy/deploy.sh` does not ship `scripts/test/`** while
  `deploy.yml` does; the runbook's §3.7 hint ("if stack-smoke.sh is missing on
  the droplet … re-run deploy.sh") is therefore wrong.
- **Droplet leftovers.** `infra/app`, `infra/monitor`, `infra/.env.dev`,
  `infra/.env.local`, `infra/.env.example`, `infra/docker-compose.yml.prev-build`
  are remnants of the rsync era. Harmless, but misleading.
- **No automated guard** exists for "the compose bind mounts must all be in the
  deploy `source` list" — a cheap grep check would have caught D1 at PR time.
