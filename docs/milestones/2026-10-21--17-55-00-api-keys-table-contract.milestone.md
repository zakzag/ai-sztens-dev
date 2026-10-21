# Milestone — `platform.api_keys` table contract (AIS-39)

**Date:** 2026-10-21
**Jira:** AIS-39 (Subtask of AIS-30)
**Related:** [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md), [`history/2026-10-21--17-55-00-ais-39-platform-api-keys-table.md`](../history/2026-10-21--17-55-00-ais-39-platform-api-keys-table.md)

## 1. Problem / feature

AIS-64 removed the whole callback context, leaving `apps/api/src/db/schema.ts` with
zero tables. The API therefore had no persisted domain data at all. AIS-39 had to
create the first real table, `platform.api_keys`, through the normal schema-as-code
flow (`schema.ts` → `db:generate` → committed SQL → `db:migrate`), and to prove its
mapping and its `identifier` uniqueness with tests.

## 2. Evidence

* `db:generate` on the empty schema: `1 tables / api_keys 8 columns`, migration `0002_minor_domino.sql`.
* `db:generate` a second time: `No schema changes, nothing to migrate` (no drift).
* `db:migrate` twice: `platform.__drizzle_migrations` = **3** rows both times (idempotent).
* Duplicate insert rejected:

  ```text
  ERROR: duplicate key value violates unique constraint "api_keys_identifier_key"
  DETAIL: Key (identifier)=(dup-check) already exists.
  ```

* `\d platform.api_keys` shows `id uuid … gen_random_uuid()` as PK, `api_keys_identifier_key
  UNIQUE CONSTRAINT, btree (identifier)`, and three `timestamp with time zone` columns.
* `pnpm --filter @callback/api test` → **12 suites / 125 tests** green (new spec: 25 tests).

## 3. Design rationale

| Decision | Why |
|---|---|
| `pgSchema('platform')` | `platform` is the operations schema already created and granted by `02-schemas.sh`; the app role holds `CREATE` there, so the migration can create the table. |
| Every column name spelled out (`api_key`, `expires_at`, …) | `drizzle.config.ts` sets no `casing`, so Drizzle would emit `apiKey`. An implicit camelCase column would silently break the AIS-40 repository and the AIS-41 table. |
| Named unique constraint `api_keys_identifier_key` | AIS-40 can treat a Postgres `23505` as `409 Conflict` without matching error text, and the DoD check is readable. |
| `expires_at` = `timestamptz` (nullable), not the ticket's `date` | Expiry is a moment, not a calendar day; a `date` loses the time and makes comparisons timezone-dependent. Approved before implementation. |
| `updated_at` via `$onUpdate`, no DB trigger | The only writer is the API through Drizzle; a trigger would be invisible state. Deferred, not forgotten, if a second writer appears. |
| `text` without length limits; `description` nullable | Length/format validation belongs to the DTO and the shared Zod schema (AIS-40/58), not to the DB. |
| `api_key` stores the token value as-is | Ticket scope. Hashing/rotation is a separate follow-up and is stated explicitly rather than silently dropped. |
| Tests use `getTableConfig()` + the committed migration file, never a database | Coding standard: unit tests must not hit real dependencies. The real constraint behaviour is proven by the psql check and will be covered by AIS-40 e2e. |

## 4. Implementation

| File | Change |
|---|---|
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) | `platformSchema`, `apiKeys` (8 columns, PK, named unique), `ApiKeyRow` / `NewApiKeyRow`; header documents the contract. |
| [`apps/api/drizzle/0002_minor_domino.sql`](../../apps/api/drizzle/0002_minor_domino.sql) | Generated `CREATE TABLE "platform"."api_keys"`; only hand-change `CREATE SCHEMA` → `IF NOT EXISTS` (the schema already exists on live volumes). |
| `apps/api/drizzle/meta/0002_snapshot.json`, `meta/_journal.json` | Generated and committed. |
| [`apps/api/src/db/schema.spec.ts`](../../apps/api/src/db/schema.spec.ts) | Mapping, defaults, PK, unique constraint, and four assertions on the committed SQL. |
| [`apps/api/src/db/test/helpers/sql-expression.ts`](../../apps/api/src/db/test/helpers/sql-expression.ts) | Pure helper rendering a Drizzle default back to SQL text. |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) | §6 verification numbers, §9 exists/not-yet rows, header date. |

## 5. Outcome and how to verify

`platform.api_keys` exists after `pnpm --filter @callback/api db:migrate`; nothing uses
it yet — the repository and endpoints are AIS-40.

```bash
pnpm --filter @callback/api db:generate   # must print "No schema changes"
pnpm --filter @callback/api db:check
pnpm --filter @callback/api test
pnpm --filter @callback/api db:migrate    # cwd must be apps/api

docker exec infra-postgres-1 psql -U aisztens -d aisztens_db -c '\d platform.api_keys'
docker exec infra-postgres-1 psql -U aisztens -d aisztens_db -At \
  -c "SELECT count(*) FROM platform.__drizzle_migrations"   # 3
```

Duplicate check (must fail, and leave no row behind):

```bash
docker exec infra-postgres-1 psql -U aisztens -d aisztens_db -c \
  "BEGIN; INSERT INTO platform.api_keys (name, identifier, api_key) VALUES ('a','dup-check','k1');
   INSERT INTO platform.api_keys (name, identifier, api_key) VALUES ('b','dup-check','k2'); COMMIT;"
```

## 6. Follow-ups

* **AIS-40:** repository + endpoints; map `23505` on `api_keys_identifier_key` to `409`.
* Token hashing/rotation for `api_key`; DB trigger for `updated_at` if a second writer appears.
* Table-level grants for `tkovari` / `krak` remain schema-level `USAGE` only (known limitation).
* Migration lock / `statement_timeout` in the runner is still Story 3.
