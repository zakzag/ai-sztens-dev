# AIS-18 — customer and IAM schemas: seven tables, two contexts, one migration

**Date:** 2026-11-22 · **Ticket:** AIS-18 (subtask of AIS-14) · **Type:** feature (data model)

## Problem / feature

The `customers` HTTP contract was fully specified by AIS-16 — field set, enums, unique
keys, "one primary contact", "one active owner", soft delete — but nothing stored it.
The admin screens (AIS-17 contract) and the API (AIS-178) cannot be built on a contract
that no table can satisfy, so the database layer had to come first: eight Postgres enum
types and seven tables, plus the bootstrap grants that let the migration create them.

## Evidence that shaped the design

| Observation | Consequence |
| --- | --- |
| `drizzle-kit` is a CommonJS bundle; `@callback/shared` is ESM-only (`exports` has no `require`) | importing the enum tuples into `schema.ts` broke `db:generate` with `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| the ticket asks for a `CHECK` that `contact_roles.customer_id` equals the parent contact's | a table `CHECK` cannot read another table — the constraint is unexpressible as a check |
| `contacts.customer_user_id` is nullable | a plain single-column FK cannot keep the user in the *same* customer |
| `02-schemas.sh` granted `CREATE` only on `platform` | a table in a new schema would fail `db:migrate` with `permission denied for schema customer` |
| generated `0002` had `CREATE SCHEMA "platform"` corrected to `IF NOT EXISTS` by hand | the same correction is needed for the two new schemas on any existing volume |

## Design rationale

1. **Enum values are mirrored and test-pinned.** Because the shared import cannot work
   at generation time, `schema.ts` declares `CUSTOMER_TYPE_DB_VALUES`, … and
   `schema.spec.ts` asserts each one against the shared tuple. The drift guard survives
   without a runtime dependency on a built `dist/`.
2. **Composite foreign keys replace the impossible `CHECK`s.** `(customer_id,
   customer_user_id) → iam.customer_users (customer_id, id)` and `(contact_id,
   customer_id) → customer.contacts (id, customer_id)` enforce both invariants in the
   database; each needs a `UNIQUE` pair on the referenced table
   (`customer_users_customer_id_id_key`, `contacts_id_customer_id_key`). `MATCH SIMPLE`
   makes the first one skip itself when `customer_user_id IS NULL` — exactly the "not a
   login user" case.
3. **Partial unique indexes carry the business rules** — one live tax number
   (`… WHERE tax_number IS NOT NULL AND deleted_at IS NULL`), one `primary` contact per
   customer, one active `owner` per customer. The denormalised `contact_roles.customer_id`
   exists solely so the `primary` index needs no trigger.
4. **Two schemas, because the lifecycles differ.** `customer` is the aggregate,
   `iam` holds both our staff (`operators`) and the customers' login users
   (`customer_users`), which are owned by a customer (`ON DELETE CASCADE`).
5. **No `note`, no billing column, no subscription table.** Every remark is an
   `activities` row (AIS-177); billing belongs to the deferred `service` schema (AIS-176).

## Implementation

| File | Change |
| --- | --- |
| `apps/api/src/db/schema.ts` | + 8 `pgEnum`s, + 7 tables with explicit `snake_case` column names, `timestamptz(3)`, named uniques, partial indexes, one `CHECK`, two composite FKs, + row types |
| `apps/api/drizzle/0005_colossal_hobgoblin.sql` | generated migration; the two `CREATE SCHEMA` lines guarded by hand |
| `apps/api/drizzle/meta/0005_snapshot.json`, `meta/_journal.json` | generated snapshot + journal entry |
| `apps/api/src/db/schema.spec.ts` | per-table contract tests (columns, defaults, constraints, indexes, FKs) + SQL assertions on `0005` |
| `infra/postgres/init/02-schemas.sh` | `customer` + `iam` created; `USAGE` for three roles, `CREATE` for the app role on `platform`, `customer`, `iam` |
| `scripts/test/_postgres-init-schemas-test.sh` | expectations 4 schemas / 12 USAGE / 3 CREATE; `email` asserted USAGE-only |
| `scripts/test/lib/20-cross-service.sh` | the three smoke SQL literals and counts |
| `docs/Specs/Database-Local.md` | new §4.1 (tables + every constraint and why), grant matrix, verification queries, existing-volume procedure |
| `docs/Specs/Infrastructure-Docker.md` | §6.2 schema list + grant matrix, `4 / 12 / 3` smoke note |

## Outcome and how to verify

Offline gates all green: `db:check`, `typecheck`, `test` (39 suites / 532 tests), `lint`,
`bash -n` on the three scripts, `quality:docs` (0 violations).

The database gate was executed against a throwaway `postgres:16-alpine` with
`infra/postgres/init` mounted (host port 5433, container removed afterwards):

| Check | Result |
| --- | --- |
| init script, fresh volume | new `\echo` line printed, no error |
| schemas / USAGE / CREATE | `customer,email,iam,platform` / **12** / **3** (`email` stays USAGE-only) |
| script re-run twice | only `NOTICE … already exists, skipping`, counts unchanged |
| `db:migrate` as the app role, twice | applied, then a no-op |
| tables / enums / migrations | `customer` **5**, `iam` **2**, **8** enums, **6** migrations (0000–0005) |
| timestamps | **12** at precision 3, **0** at any other precision |
| invariants under real writes | malformed tax number, duplicate number, duplicate live tax number, second `primary`, cross-customer login link and case-variant e-mail each **rejected with the named constraint** |

Reproduce with:

```bash
docker run -d --name ais18-gate -p 5433:5432 -e POSTGRES_DB=aisztens_db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres_test_only \
  -e AISZTENS_DB_USER=aisztens -e AISZTENS_DB_PASSWORD=aisztens_test_only \
  -e TKOVARI_DB_PASSWORD=x -e KRAK_DB_PASSWORD=y \
  -v "$PWD/infra/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine
set DATABASE_URL=postgres://aisztens:aisztens_test_only@localhost:5433/aisztens_db
pnpm --filter @callback/api build && pnpm --filter @callback/api db:migrate
```

The shell wrapper [`_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh)
needs a shell whose `docker` is the Windows CLI (Git Bash / PowerShell); WSL's bash has a
Linux client without an integrated socket, so the same assertions were run directly.

## Follow-ups

- **AIS-178** generates `customer_number` (`max()` per month + one retry on `23505`) and
  must delete a contact's `contact_roles` rows on soft delete, or the `primary` slot
  stays occupied.
- **AIS-177** adds `activity` / `audit` schemas *and their grants* — untouched here.
- `iam.operators` intentionally has no timestamps; add them with the first operator
  screen that displays them.
