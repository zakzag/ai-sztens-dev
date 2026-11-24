# AIS-177 — `activity` + `audit` schemas and the `AuditWriter`

**Date:** 2026-11-22 17:32 (Europe/Budapest)
**Ticket:** AIS-177 `Admin - impl: tevékenység és audit napló táblák + AuditWriter` (subtask of AIS-14)
**Plan:** [`2026-11-22--17-05-00-ais-177-activity-audit-tables-and-audit-writer-plan.md`](../plans/2026-11-22--17-05-00-ais-177-activity-audit-tables-and-audit-writer-plan.md)
**Commit title:** `AIS-177: feat(db): add activity and audit schemas and AuditWriter`

## What was built

| Layer             | Deliverable                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB                | `activity.activities`, `audit.audit_logs`, 4 enums, `activity_author_reference_check`, partial feed index, 3 ledger indexes, `0006` generated migration                                      |
| DB (hand-written) | `0007_audit_immutability.sql`: `audit.reject_audit_mutation()`, `BEFORE UPDATE OR DELETE` + `BEFORE TRUNCATE` triggers, `GRANT SELECT, INSERT … TO CURRENT_USER`, `REVOKE ALL … FROM PUBLIC` |
| API               | `apps/api/src/audit/`: `AuditWriter` (single entry point), `DatabaseTransaction` (derived type), `diffAuditPayload`, `SystemAuditActorProvider`, `toAuditRequestFacts`, repository, module   |
| Infra             | `02-schemas.sh` grows to 6 schemas / 18 USAGE / 5 CREATE; smoke-script expectations updated                                                                                                  |
| Docs              | `Database-Local.md` §4.2 (+ grant matrix, verification block), `Infrastructure-Docker.md` §6.2, this entry, a milestone                                                                      |

## Findings that moved the ticket

| #   | Finding                                                                                                                     | Handling                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | The ticket asked for "only `INSERT`" on the ledger, but the _Napló_ tab reads it (`GET /:id/audit-logs`, AIS-178)           | `GRANT SELECT, INSERT`; the invariant that matters is "no rewrite, no erasure"                                                         |
| F2  | Migrations run as the **owner** of the table, so grants cannot forbid `UPDATE`/`DELETE`                                     | the trigger is the enforcement; grants stay documented intent                                                                          |
| F3  | Shared `activitySchema.updatedAt` is nullable; the existing `updatedAt()` factory is `NOT NULL DEFAULT now()`               | new `nullableUpdatedAt()` factory                                                                                                      |
| F4  | The ticket lists three `author_type` values; the frozen AIS-16 contract has four (`api_key`)                                | the `CHECK` has four branches — otherwise an API-key activity is unrepresentable                                                       |
| F5  | `ON DELETE SET NULL` on the author FKs is impossible (the `CHECK` demands the column), and `RESTRICT` is checked row-by-row | both author FKs use the default `NO ACTION`, checked at end-of-statement, which is what the `customers → customer_users` cascade needs |
| F6  | `drizzle-kit` cannot emit functions, triggers or grants                                                                     | second, `--custom` migration with a "never regenerate" header                                                                          |
| F7  | A hand-edited `0006` was needed again: the generator emitted plain `CREATE SCHEMA`                                          | both guarded with `IF NOT EXISTS`, same correction as AIS-18                                                                           |
| F8  | The audit ledger has no uuid identity for join rows (`customer_tags`)                                                       | `record_id` stays nullable; join audits carry the pair in `after_data`                                                                 |

## Decisions worth keeping

- **`audit.audit_logs.actor_type` reuses `activity.author_type`** — one Postgres type carries the "who" vocabulary for the feed and the ledger, so the two cannot drift.
- **The writer requires a transaction handle.** `DatabaseTransaction` is derived from `Database['transaction']`, so passing the pooled handle is a type error rather than a convention. A failed audit insert therefore rolls the business write back; a rolled-back business write leaves no audit row.
- **`before_data` / `after_data` hold only the changed keys**, and `updated_at` is excluded from the diff (it changes on every write and would bury the field that moved).
- **An update with an empty diff writes nothing** — a "save" that changed nothing is not an audit fact.
- **The actor is `system` today**, behind `AuditActorProvider` (AIS-14 `D-A`). The auth story (AIS-73/74) replaces the provider only.
- **No `DatabaseModule` import in `AuditModule`** — the repository never injects the pool, only the caller's transaction. With a pooled handle in reach, "write the audit row on its own connection" would stop being a compile error.

## Verification

```text
pnpm --filter @callback/api test        -> 45 suites / 635 tests passed
pnpm --filter @callback/api test:e2e    -> 12 suites / 67 tests passed (real Postgres)
```

Database gate (throwaway `postgres:16-alpine`, host port 5433, `infra/postgres/init` mounted, container removed afterwards):

| Check                            | Result                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| schemas / USAGE / CREATE         | `platform,email,customer,iam,activity,audit` / **18** / **5**                          |
| tables / enums / migrations      | `activity` **1**, `audit` **1**, **4** enums, **8** migrations (0000–0007)             |
| triggers on `audit.audit_logs`   | `audit_logs_append_only_row`, `audit_logs_append_only_statement`                       |
| `UPDATE` / `DELETE` / `TRUNCATE` | each rejected with `audit.audit_logs is append-only: …`                                |
| `CHECK` branches                 | 4 valid author combinations accepted, 3 contradictory ones rejected by constraint name |
| soft delete                      | the row survives, the partial feed index hides it                                      |
| transaction semantics            | business row + audit row commit together; a thrown error rolls back both               |
| leftovers in the test database   | `audit_logs` **0**, `activities` **0**, `customers` **0** — every e2e test rolls back  |

## Files

| File                                                                      | Change                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                                               | + `activity`/`audit` schemas, `nullableUpdatedAt()`, 4 enum tuples + enums, 2 tables, row types, header notes |
| `apps/api/drizzle/0006_magenta_chameleon.sql`                             | generated migration; `CREATE SCHEMA` guarded by hand                                                          |
| `apps/api/drizzle/0007_audit_immutability.sql`                            | **new** — append-only function, two triggers, grants                                                          |
| `apps/api/drizzle/meta/0006_snapshot.json`, `meta/_journal.json`          | generated snapshot + journal entry                                                                            |
| `apps/api/src/db/schema.spec.ts`                                          | enum-drift rows, column mappings, constraint/index assertions, `0006`/`0007` SQL assertions                   |
| `apps/api/src/audit/audit.const.ts`                                       | **new** — DI tokens, table allow-list, diff ignore-list, source, ip pattern                                   |
| `apps/api/src/audit/audit.interface.ts`                                   | **new** — `AuditWriteInput`, `AuditActor`, `AuditRequestFacts`, `AuditDiff`                                   |
| `apps/api/src/audit/audit-transaction.interface.ts`                       | **new** — `DatabaseTransaction` derived from `Database`                                                       |
| `apps/api/src/audit/audit-diff.logic.ts`                                  | **new** — pure diff + JSON-safe normalisation                                                                 |
| `apps/api/src/audit/audit-actor.interface.ts`, `audit-actor.provider.ts`  | **new** — the actor seam and the `system` implementation                                                      |
| `apps/api/src/audit/audit-request.logic.ts`                               | **new** — ip/user-agent/request-id extraction, validated against the storage                                  |
| `apps/api/src/audit/audit.errors.ts`                                      | **new** — `AuditPayloadIncompleteError`                                                                       |
| `apps/api/src/audit/audit.repository.interface.ts`, `audit.repository.ts` | **new** — append on the caller's transaction                                                                  |
| `apps/api/src/audit/audit-writer.interface.ts`, `audit-writer.service.ts` | **new** — the single entry point                                                                              |
| `apps/api/src/audit/audit.module.ts`                                      | **new** — binds `AUDIT_WRITER`, exports only that token                                                       |
| `apps/api/src/audit/*.spec.ts`, `test/mocks/audit.mock.ts`                | **new** — 6 spec files, fixtures and doubles                                                                  |
| `apps/api/test/audit-immutability.e2e-spec.ts`                            | **new** — real-Postgres invariants, every test rolls back                                                     |
| `infra/postgres/init/02-schemas.sh`                                       | 2 schemas, grant matrix, `\echo`                                                                              |
| `scripts/test/_postgres-init-schemas-test.sh`                             | expectations 6 / 18 / 5                                                                                       |
| `scripts/test/lib/20-cross-service.sh`                                    | schema count 6                                                                                                |
| `docs/Specs/Database-Local.md`                                            | header, grant matrix, §4.2, verification block                                                                |
| `docs/Specs/Infrastructure-Docker.md`                                     | header, grant matrix, AIS-177 note                                                                            |

## Follow-ups

- **AIS-178** wires the writer into every `customers` write (row write → `AuditWriter.write`, one transaction) and exposes `GET /:id/audit-logs` (needs the `SELECT` granted here).
- **AIS-184/185** should reuse this writer for worker-driven changes instead of inserting ledger rows themselves.
- **Anonymisation** must not "fix" the trigger: if `audit_logs.customer_id` ever has to be cleared, that needs a reviewable `SECURITY DEFINER` path, not a relaxed trigger.
- `0007` must never be regenerated; its header says so and the e2e fails if the triggers disappear.
