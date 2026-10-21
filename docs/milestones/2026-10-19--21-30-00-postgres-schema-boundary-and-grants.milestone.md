# Postgres schema boundary and init-script grants (AIS-35)

**Date:** 2026-10-19
**Story:** AIS-29 — schema-as-code migration workflow and Postgres-backed callback storage
**Subtask:** AIS-35 — per-context Postgres schemas and privileges in the init scripts

## 1. Problem / feature

The callback requests were persisted in an in-memory `Map`, and AIS-29 moves them to
Postgres with Drizzle. That requires a `callback.callback_requests` table in a
`callback` schema — but the container init scripts only created roles
([`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh)). No schema
and no schema-level privilege existed, so the migration runner would fail with
`permission denied for schema callback`.

The subtask had to create three per-context schemas and a privilege matrix, idempotently,
inside the init scripts that the official Postgres image runs.

## 2. Measured data / evidence

| Observation | How it was established |
|---|---|
| Only roles were created; `\dn` showed no `platform` / `callback` / `email` | read of `01-roles.sh` before the change |
| init runs **only** on an empty `pgdata` volume (`Skipping initialization` afterwards) | documented in `docs/Specs/Infrastructure-Docker.md` §6.2 and confirmed in container logs |
| the whole init directory is bind-mounted, so a new file is picked up automatically | `./postgres/init:/docker-entrypoint-initdb.d:ro` in both compose files |
| `pg_isready` returns success during the **temporary** init server | first test run: `FATAL: the database system is shutting down` on the first assertion |

## 3. Root cause / design rationale

- **Two scripts, one responsibility each.** `01-roles.sh` owns roles and database
  ownership; the new `02-schemas.sh` owns schema DDL and grants. Scripts run in
  lexicographic order, so `02` always sees the roles from `01`. `02` is also
  re-runnable on its own against an existing volume, which is the only way to fix a
  database that was initialized before this change.
- **Grants duplicated (guarded) in `01`.** The ticket asked for the grant in
  `01-roles.sh`. Because schemas do not exist at that point on a fresh init, the block
  is filtered through `pg_namespace`; it is a no-op on first init and effective when
  `01` is re-applied later. This keeps the file order-independent and idempotent.
- **`CREATE` only for the app role, only in `callback` and `platform`.** Drizzle creates
  its tables as the connection role: the domain tables in `callback` and its own
  bookkeeping table `platform.__drizzle_migrations` (the AIS-36 delta). That role is
  `aisztens`, which also owns the database, so it may create schemas as well. Operators
  get `USAGE` for inspection only — deliberately no write capability. `email` gets
  `USAGE` only, because no migration runner writes there yet.
- **No ownership transfer.** Schemas stay owned by the bootstrap superuser
  (`POSTGRES_USER`); privileges are granted instead of transferred, which keeps the
  bootstrap script the only place that decides ownership.

Grant matrix:

| Schema | `aisztens` (app) | `tkovari` (owner) | `krak` (operator) |
|---|---|---|---|
| `platform` | USAGE + **CREATE** | USAGE | USAGE |
| `callback` | USAGE + **CREATE** | USAGE | USAGE |
| `email` | USAGE | USAGE | USAGE |

(`platform` carries the `CREATE` grant since AIS-36: the Drizzle bookkeeping table lives
there. See `docs/Specs/Infrastructure-Docker.md` §6.2 for the authoritative matrix.)

## 4. Solution / implementation

| File | Change |
|---|---|
| [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh) | new idempotent script: `CREATE SCHEMA IF NOT EXISTS` for `platform`, `callback`, `email`, then `\gexec`-driven `GRANT USAGE` (3 schemas × 3 roles) and `GRANT CREATE ON SCHEMA callback` for `aisztens` |
| [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) | same grants as a `pg_namespace`-guarded `\gexec` block, plus a header explaining why it is a no-op on first init |
| [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh) | throwaway `postgres:16-alpine` container with the init dir bind-mounted: asserts the fresh-init matrix, then re-runs both scripts twice and re-asserts. Updated in AIS-36 with the `platform` CREATE assertions |
| [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh) | three new smoke checks: `postgres-schemas` (3), `postgres-schema-usage` (9), `postgres-schema-create` (2, updated in AIS-36 when `platform` gained CREATE) |
| [`docs/Specs/Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md) | §6.2 documents both scripts, the schema→context mapping, the grant matrix and the manual re-apply command |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md) | §2b documents the fresh-volume requirement and the re-apply / `down -v` recipes |

## 5. Outcome and how to verify

The init now produces the three schemas with the matrix above, on a fresh volume and on
re-run. Verification:

```bash
bash scripts/test/_postgres-init-schemas-test.sh     # expect PASS: 32  FAIL: 0
                                                     # (32 since AIS-36 added the
                                                     # platform CREATE assertions:
                                                     #  13 fresh + 8 re-run rounds
                                                     #  + 11 post-re-run assertions)

# against the local DB stack
pnpm db:up
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres psql -U postgres -d aisztens_db -c '\dn'
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres psql -U postgres -d aisztens_db -At \
  -c "SELECT has_schema_privilege('aisztens','callback','CREATE')"
pnpm test:stack                                       # includes the new checks
```

Expected: `platform`, `callback`, `email` listed, and `t` from the privilege query.

## 6. Follow-ups

- Existing `pgdata` (droplet) and `pgdata_local` volumes were initialized **before** this
  change: they need `02-schemas.sh` re-applied by hand or a `down -v` before AIS-36/38
  can run `db:migrate`. Not automated here on purpose — the deploy-time migration path
  belongs to Story 3.
- `tkovari` / `krak` are literal role names in two scripts; renaming an operator role
  means editing both.
- No table-level (`SELECT`/`INSERT`) grants yet; operators can only inspect schemas until
  a future read-only access story decides the table grants.
