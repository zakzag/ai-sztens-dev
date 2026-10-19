# callback_requests schema and the first migration runner (AIS-36)

**Date:** 2026-10-19
**Story:** AIS-29 — schema-as-code migration workflow and Postgres-backed callback storage
**Subtask:** AIS-36 — Drizzle schema and the first migration for `callback_requests`

## 1. Problem / feature

The database had schemas and grants (AIS-35) but no tables: `apps/api/src/db/schema.ts`
was a placeholder and `apps/api/drizzle/` held only an empty journal. `db:migrate`
printed "placeholder" and exited 0. The task: define the `callback_requests` table as
code, generate a reviewable SQL migration, and make `db:migrate` actually apply it.

## 2. Measured data / evidence

| Observation | How |
|---|---|
| Postgres was up, `platform` / `callback` / `email` existed | `\dn` on `infra-postgres-1` |
| USAGE matrix correct (9 rows), `callback` CREATE = `t` | `has_schema_privilege` queries |
| **`platform` CREATE = `f`** | same — the bookkeeping table could not have been created |
| `apps/api/.env.local` contained only `PORT`, no `DATABASE_URL` | file inspection |
| `drizzle-kit` generated `CREATE SCHEMA "callback";` (not `IF NOT EXISTS`) | first `db:generate` output |

## 3. Root cause / design rationale

- **Where does the bookkeeping table live?** Drizzle defaults to a `drizzle` schema,
  which would be a fourth schema outside the documented `platform` / `callback` /
  `email` boundary. `platform` is the operations context, so
  `platform.__drizzle_migrations` was chosen — at the cost of granting the app role
  `CREATE` on `platform` (the AIS-35 delta). `callback` was rejected to keep the domain
  schema free of tool bookkeeping.
- **`db:migrate` as a thin runner, not `drizzle-kit migrate`.** The script keeps the
  same name and invocation (`node dist/migrate.js`) permanently; Story 3 adds the
  advisory lock and timeouts to the same file instead of swapping the script twice.
- **`CREATE SCHEMA` had to be patched by hand.** Drizzle emits a plain `CREATE SCHEMA`,
  which fails on a database where AIS-35 already created it. Migrations are reviewed
  code, so the generated file was changed to `IF NOT EXISTS` and the change is visible
  in the diff.
- **No dotenv dependency.** `drizzle.config.ts` and the runner resolve `DATABASE_URL`
  through one helper that uses Node's built-in `process.loadEnvFile()` and falls back to
  composing the local URL from `infra/.env.local` (the credentials the container was
  bootstrapped with). Offline commands (`db:generate`, `db:check`) must not require a
  database, so the config never throws — it substitutes an unusable sentinel so that
  anything connecting fails loudly.
- **Enum vs text.** `callback.call_status` is a real Postgres enum kept in sync with the
  shared `CallStatus` union via `satisfies readonly CallStatus[]`. The trade-off —
  `ALTER TYPE … ADD VALUE` needs its own migration — is documented in the schema file.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) | `callbackSchema`, `CALL_STATUS_VALUES`, `callStatusEnum`, `callbackRequests(id uuid pk default gen_random_uuid, name 120, email 254, phone 20, reason 1000, status enum default 'queued', created_at timestamptz default now())`, row types |
| [`apps/api/src/db/database-url.ts`](../../apps/api/src/db/database-url.ts) | `tryResolveDatabaseUrl()` (offline-safe) and `resolveDatabaseUrl()` (throws, actionable) |
| [`apps/api/drizzle.config.ts`](../../apps/api/drizzle.config.ts) | uses the resolver, pins `migrations.schema = platform`, `strict`, `verbose` |
| `apps/api/drizzle/0000_pretty_bromley.sql` | generated migration, `CREATE SCHEMA` patched to `IF NOT EXISTS` |
| [`apps/api/src/migrate.ts`](../../apps/api/src/migrate.ts) | real runner: single postgres.js connection, `migrate()` from drizzle, `onnotice` silenced, `finally` close, exit 1 on failure |
| [`apps/api/src/db/schema.spec.ts`](../../apps/api/src/db/schema.spec.ts) | 13 metadata assertions (no DB needed) |
| init scripts + shell/smoke tests | `GRANT CREATE ON SCHEMA platform` for the app role; expectations 1 → 2 |

## 5. Outcome and how to verify

```bash
pnpm db:up                                   # Postgres on localhost:5432
docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres bash /docker-entrypoint-initdb.d/02-schemas.sh   # only if the volume predates AIS-36
pnpm --filter @callback/api build
pnpm --filter @callback/api db:migrate       # idempotent; second run is a no-op

DC="docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml"
$DC exec -T postgres psql -U postgres -d aisztens_db -c '\d callback.callback_requests'
$DC exec -T postgres psql -U postgres -d aisztens_db -At -c "SELECT count(*) FROM platform.__drizzle_migrations"   # 1
$DC exec -T postgres psql -U postgres -d aisztens_db -At -c "SELECT count(*) FROM callback.callback_requests"      # 0

pnpm --filter @callback/api test             # 10 suites / 75 tests
bash scripts/test/_postgres-init-schemas-test.sh   # PASS: 29
```

## 6. Follow-ups

- `pnpm --filter @callback/api lint` reports 28 **pre-existing** errors, all in the two
  VAPI spec files (`jest` global type unresolved); the AIS-36 files lint clean.
- `db:migrate` is not concurrency-safe yet: advisory lock, `lock_timeout`,
  `statement_timeout` and pipeline wiring are Story 3.
- No indexes on `callback_requests`; the real query patterns arrive with AIS-38.
- `apps/api/.env.local` has no `DATABASE_URL` yet, and `APP_ENV` defaults to `dev`,
  which loads `.env.dev` first — must be resolved before AIS-38 so the local API cannot
  target the dev droplet's database.
