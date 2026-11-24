# AIS-18 — `customer` and `iam` database tables

**Date:** 2026-11-22 14:13 (Europe/Budapest)
**Ticket:** AIS-18 `Admin - impl: adatbázis táblák létrehozás` (subtask of AIS-14)
**Branch:** `AIS-14-company-admin`
**Plan:** [`docs/plans/2026-11-22--14-55-00-ais-18-customer-iam-db-schemas-plan.md`](../plans/2026-11-22--14-55-00-ais-18-customer-iam-db-schemas-plan.md)
**Milestone:** [`docs/milestones/2026-11-22--14-13-00-ais-18-customer-iam-schemas.milestone.md`](../milestones/2026-11-22--14-13-00-ais-18-customer-iam-schemas.milestone.md)

## What was asked

Create the customer aggregate's database schema and the IAM context in the Drizzle
schema-as-code, with a versioned migration and snapshot, the bootstrap grants, the
`Database-Local.md` section and an updated `schema.spec.ts` — following the
`platform.api_keys` pattern (AIS-39) and the field set AIS-16 closed.

Scope: **eight** Postgres enum types and **seven** tables in two new schemas
(`customer`, `iam`). `activity` / `audit` belong to AIS-177, `service` to AIS-176, and
no billing column and no `customers.note` exist anywhere.

## What was built

| Object | Kind | Schema |
| --- | --- | --- |
| `customer_type`, `customer_status`, `customer_source`, `headcount_range`, `contact_role` | enum | `customer` |
| `customer_user_role`, `customer_user_status`, `operator_role` | enum | `iam` |
| `operators` | table | `iam` |
| `customers` (22 columns) | table | `customer` |
| `tags`, `customer_tags` | table | `customer` |
| `customer_users` | table | `iam` |
| `contacts`, `contact_roles` | table | `customer` |

Constraints that carry a contract:

| Name | Shape | Why |
| --- | --- | --- |
| `customers_customer_number_key` | `UNIQUE (customer_number)` | the `23505` → `409` mapping matches this **name**, not the error text |
| `customers_tax_number_key` | `UNIQUE INDEX … WHERE tax_number IS NOT NULL AND deleted_at IS NULL` | one tax number among the **live** rows; `NULL` stays legal |
| `customers_tax_number_format_check` | `CHECK (… ~ '^\d{8}-[1-5]-\d{2}$')` | the shared `huTaxNumberSchema` rule, restated at the storage boundary |
| `contact_roles_primary_key` | `UNIQUE INDEX … WHERE role = 'primary'` | one primary contact per customer, without a trigger |
| `customer_users_customer_owner_key` | `UNIQUE INDEX … WHERE role = 'owner' AND status = 'active'` | one active owner per customer |
| `customer_users_email_key` | `UNIQUE INDEX (lower(email))` | login is e-mail based, so uniqueness must be case-insensitive |
| `contacts_customer_user_id_fkey` | `(customer_id, customer_user_id) → iam.customer_users (customer_id, id)` | a contact may only point at a user of **its own** customer |
| `contact_roles_contact_id_fkey` | `(contact_id, customer_id) → customer.contacts (id, customer_id)` | the role row cannot name a different customer than its parent |
| `contacts_id_customer_id_key`, `customer_users_customer_id_id_key` | `UNIQUE` pairs | the two composite FKs above are only legal against a unique target |

## Decisions and deviations from the plan

1. **The shared enum tuples are mirrored, not imported (deviation from plan `D1`).**
   `drizzle-kit` is a CommonJS bundle and cannot `require()` the ESM-only
   `@callback/shared`: the import made `db:generate` fail with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`. The tuples therefore live in `schema.ts` as
   `CUSTOMER_TYPE_DB_VALUES`, … and `schema.spec.ts` asserts every one of them against
   the shared tuple. Same drift protection, no runtime coupling, and `db:generate`
   keeps working without a built `dist/`.
2. **Composite FKs instead of the ticket's `CHECK`s.** A table `CHECK` cannot read
   another table, so "the contact's user belongs to the same customer" and "the role
   row points at its own customer" are enforced by composite foreign keys — which is
   why `contacts_id_customer_id_key` and `customer_users_customer_id_id_key` exist.
3. **`contact_roles` carries no `deleted_at`** (roles are not history). Consequence
   recorded for AIS-178: soft-deleting a contact must delete its role rows, otherwise
   the `primary` slot stays occupied forever.
4. **`CREATE SCHEMA` guarded by hand** in the generated migration
   (`IF NOT EXISTS "customer"`, `IF NOT EXISTS "iam"`), exactly as migration `0002`
   had to be — on an existing volume `02-schemas.sh` already created them.
5. `customer_number` generation stays out of this ticket (plan `D2`); the column is
   `text NOT NULL` + named `UNIQUE`, AIS-178 produces the value.

## Files

| File | Change |
| --- | --- |
| `apps/api/src/db/schema.ts` | + 8 `pgEnum`s, + 7 tables, + row types (`OperatorRow`, `CustomerRow`, `CustomerUserRow`, `ContactRow`, `ContactRoleRow`, `TagRow`, `CustomerTagRow` and the `New*Row` pair), header note for AIS-18 |
| `apps/api/drizzle/0005_colossal_hobgoblin.sql` | **new, generated** (then the two `CREATE SCHEMA` lines guarded) |
| `apps/api/drizzle/meta/0005_snapshot.json`, `meta/_journal.json` | **new, generated** |
| `apps/api/src/db/schema.spec.ts` | + per-table contract blocks (columns, defaults, unique constraints, partial indexes, `CHECK`, composite FKs) + SQL assertions on `0005`; 132 tests |
| `infra/postgres/init/02-schemas.sh` | two new schemas, `CREATE` for the app role on `platform`+`customer`+`iam`, updated matrix comment and `\echo` |
| `scripts/test/_postgres-init-schemas-test.sh` | 4 schemas / 12 USAGE / 3 CREATE, `email` asserted to stay USAGE-only |
| `scripts/test/lib/20-cross-service.sh` | the three smoke SQL literals and their expected counts |
| `docs/Specs/Database-Local.md` | header date, bootstrap row, grant matrix, new **§4.1** (tables + constraints), §6 verification queries, §8 existing-volume note, §9 "megvan" rows |
| `docs/Specs/Infrastructure-Docker.md` | §6.2 schema list, grant matrix, `4 / 12 / 3` smoke note, header date |

## Verification

```text
pnpm --filter @callback/api db:generate   -> 0005_colossal_hobgoblin.sql written
pnpm --filter @callback/api db:check      -> Everything's fine
pnpm --filter @callback/api typecheck     -> clean
pnpm --filter @callback/api test          -> 39 suites / 532 tests passed
pnpm --filter @callback/api lint          -> clean
bash -n <the three modified scripts>      -> ok
pnpm quality:docs                         -> 0 violations
```

### Database gate (executed against a throwaway container)

One `postgres:16-alpine` started with `infra/postgres/init` mounted and on host port
`5433`, exactly like the compose stacks; the container was removed afterwards.

| Check | Result |
| --- | --- |
| fresh init runs `02-schemas.sh` | `[02-schemas] platform, email, customer and iam schemas and grants are in place.`, no error, `PostgreSQL init process complete` |
| schemas present | `customer,email,iam,platform` |
| USAGE pairs (4 schemas × 3 roles) | **12** |
| CREATE pairs (platform + customer + iam × 3 roles) | **3** |
| `aisztens` CREATE on `email`, `krak` CREATE on `customer` | `f`, `f` |
| script re-run twice | only `NOTICE: schema … already exists, skipping`; counts unchanged |
| `db:migrate` as the **app role** (`aisztens`) | `[db:migrate] migrations applied`; a second run is also green |
| tables | `customer` **5**, `iam` **2** |
| migrations recorded | **6** (0000–0005) |
| enum types in the two schemas | **8** |
| partial unique indexes | **3** |
| `customer.contacts` foreign keys | `contacts_customer_id_customers_id_fk`, `contacts_customer_user_id_fkey` |
| timestamp precision | **12** columns at precision 3, **0** at any other precision |

Behavioural probes, all executed as `aisztens` (so the grant matrix is proven in
practice, not only asserted):

| Probe | Result |
| --- | --- |
| operator → customer ×2 → customer user → contact → `primary` role | all inserted |
| tax number `1234567-1-12` | `violates check constraint "customers_tax_number_format_check"` |
| duplicate `customer_number` | `customers_customer_number_key` |
| second customer with the same live `tax_number` | `customers_tax_number_key` |
| second `primary` role on the same customer | `contact_roles_primary_key` |
| contact pointing at **another** customer's user | `contacts_customer_user_id_fkey` |
| `U1@EXAMPLE.HU` beside `u1@example.hu` | `customer_users_email_key` |

`contact_roles_primary_key`, `customers_tax_number_key` and
`customer_users_customer_owner_key` fired from partial indexes, and the composite FK
rejected the cross-customer link — i.e. the two invariants the ticket described as
`CHECK`s are enforced by the database.

> The shell script [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh)
> itself could not run here: this terminal's `bash` is WSL's, whose `docker` is a Linux
> client without an integrated socket (and it cannot bind-mount `/mnt/e/...` into a
> Windows-daemon container). Its assertions were therefore executed verbatim with the
> Windows CLI; the expected `4 / 12 / 3` numbers match, so the script needs no change.
> Run it once from a shell where `docker` resolves to the Windows CLI (Git Bash or
> PowerShell) to see the suite itself pass.

## Follow-ups

- **AIS-178** owns the `customer_number` generator (recommended: `max()` per month +
  one retry on `23505`), the contact soft-delete ↔ `contact_roles` rule, and the list
  filters that may want indexes on `status` / `type` / `responsible_operator_id`.
- **AIS-177** adds the `activity` and `audit` schemas **and their own grants** — this
  ticket deliberately did not touch `02-schemas.sh` for them.
- `iam.operators` has no `created_at`/`updated_at` (ticket-strict); add them when an
  operator-facing screen needs the values.
