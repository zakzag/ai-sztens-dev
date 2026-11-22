# AIS-177 — the append-only audit ledger and the activity feed

**Date:** 2026-11-22 · **Ticket:** AIS-177 (subtask of AIS-14) · **Type:** feature (data model + audit infrastructure)

## Problem / feature

The `customers` contract (AIS-16) and its tables (AIS-18) had no way to answer two
questions the admin screens need: _what happened with this company?_ (the activity
feed) and _who changed this row, and from what to what?_ (the audit ledger). Without
them AIS-178 could not audit a single write, the _Tevékenység_ / _Napló_ tabs
(AIS-181) had nothing to read, and the list column "last activity" had no source.

## Measured data / evidence

Run against a throwaway `postgres:16-alpine` with `infra/postgres/init` mounted:

| Check                            | Result                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| schemas / USAGE / CREATE         | `platform,email,customer,iam,activity,audit` / **18** / **5**                          |
| tables / enums / migrations      | `activity` **1**, `audit` **1**, **4** enums, **8** migrations (0000–0007)             |
| triggers on `audit.audit_logs`   | `audit_logs_append_only_row`, `audit_logs_append_only_statement`                       |
| `UPDATE` / `DELETE` / `TRUNCATE` | each rejected: `audit.audit_logs is append-only: … is not allowed (AIS-177)`           |
| `activities` `CHECK`             | 4 valid author combinations accepted, 3 contradictory ones rejected by constraint name |
| transaction                      | business row + audit row roll back together; a rejected audit insert aborts the write  |
| test database after the suite    | `audit_logs` 0, `activities` 0, `customers` 0 (every e2e test rolls back)              |

Offline gates: `pnpm --filter @callback/api test` → 45 suites / 635 tests;
`test:e2e` → 12 suites / 67 tests.

## Root cause / design rationale

1. **Grants cannot make a table append-only for its owner.** Migrations run as the
   app role, which _owns_ `audit.audit_logs`; an owner keeps `UPDATE`/`DELETE`
   regardless of `GRANT`/`REVOKE`. The real enforcement is a `BEFORE UPDATE OR DELETE`
   row trigger plus a separate `BEFORE TRUNCATE` statement trigger (a row trigger
   never fires for `TRUNCATE`). The grants remain as documented intent:
   `SELECT` is required (the _Napló_ tab reads the ledger), `INSERT` for the writer,
   and `PUBLIC` is revoked.
2. **`NO ACTION` on the author foreign keys, deliberately.** `ON DELETE SET NULL`
   would immediately violate `activities_author_reference_check` (the check demands
   `operator_id` exactly when `author_type = 'operator'`), and `RESTRICT` is checked
   row-by-row — it would abort the `customers → customer_users` cascade that a hard
   customer delete relies on. `NO ACTION` is checked at end-of-statement, which lets
   the multi-path cascade settle first. Both FKs are declared without an action for
   that reason; "adding a proper `RESTRICT`" is a regression, not a fix.
3. **The writer requires the caller's transaction handle.** `DatabaseTransaction` is
   derived from `Database['transaction']` and is a required argument, so "audit row on
   its own connection" is a compile error, not a review note. `AuditModule` therefore
   does **not** import `DatabaseModule` — a pooled handle must not even be reachable.
4. **Only changed keys are stored**, and `updated_at` is excluded from the diff: it
   moves on every write and would make every row look changed. A no-op `update`
   writes nothing.
5. **The ledger has no foreign keys at all** (`customer_id`, `record_id`, `actor_id`
   are values, not references) so the log survives anonymisation, record deletion and
   staff departure — the whole point of a ledger. `record_id` is nullable because
   `customer_tags` has a composite key.
6. **`api_key` is a fourth author type.** The Jira ticket listed three; the frozen
   AIS-16 contract has four, and a machine caller has no operator row, so the `CHECK`
   has a branch for it.

## Solution / implementation

| File                                                                                  | Change                                                                                                                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                                                           | `activity` + `audit` schemas, `nullableUpdatedAt()`, 4 enums, `activities`, `audit_logs`, row types, header notes                             |
| `apps/api/drizzle/0006_magenta_chameleon.sql`                                         | generated migration (schemas guarded with `IF NOT EXISTS` by hand)                                                                            |
| `apps/api/drizzle/0007_audit_immutability.sql`                                        | hand-written: rejecting function, two triggers, `GRANT`/`REVOKE`; "never regenerate" header                                                   |
| `apps/api/src/audit/`                                                                 | `AuditWriter`, `DatabaseTransaction`, `diffAuditPayload`, `SystemAuditActorProvider`, `toAuditRequestFacts`, repository, module, 6 spec files |
| `apps/api/test/audit-immutability.e2e-spec.ts`                                        | real-Postgres invariants; every test rolls back via a sentinel error                                                                          |
| `infra/postgres/init/02-schemas.sh`                                                   | 2 schemas, grant matrix, echo line                                                                                                            |
| `scripts/test/_postgres-init-schemas-test.sh`, `scripts/test/lib/20-cross-service.sh` | expectations 6 / 18 / 5                                                                                                                       |
| `docs/Specs/Database-Local.md`                                                        | §4.2 (both schemas, constraint rationale, trigger, anonymisation), grant matrix, verification                                                 |
| `docs/Specs/Infrastructure-Docker.md`                                                 | §6.2 grant matrix and smoke counts                                                                                                            |

## Outcome and how to verify

```bash
# offline
pnpm --filter @callback/api test
pnpm --filter @callback/api db:check

# database (throwaway container, host port 5433)
docker run -d --name ais177-gate -p 5433:5432 -e POSTGRES_DB=aisztens_db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres_test_only \
  -e AISZTENS_DB_USER=aisztens -e AISZTENS_DB_PASSWORD=aisztens_test_only \
  -e TKOVARI_DB_PASSWORD=x -e KRAK_DB_PASSWORD=y \
  -v "$PWD/infra/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine
set DATABASE_URL=postgres://aisztens:aisztens_test_only@localhost:5433/aisztens_db
pnpm --filter @callback/api build && pnpm --filter @callback/api db:migrate
pnpm --filter @callback/api test:e2e

# the ledger really is immutable
docker exec ais177-gate psql -U postgres -d aisztens_db -At \
  -c "UPDATE audit.audit_logs SET actor_name = 'x' WHERE id = -1"
# -> ERROR: audit.audit_logs is append-only: UPDATE is not allowed (AIS-177)
docker rm -f ais177-gate
```

## Follow-ups

- **AIS-178** must call `AuditWriter.write` inside the same transaction as every
  `customers` write, and expose `GET /:id/audit-logs` (the `SELECT` is already granted).
- **AIS-184/185** should reuse this writer for worker-driven changes.
- **Anonymisation** must not relax the trigger: clearing `audit_logs.customer_id`
  needs a reviewable `SECURITY DEFINER` path if it is ever required.
- `0007` is hand-maintained; regenerating it deletes the only enforcement.
