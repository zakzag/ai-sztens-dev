# AIS-177 — `activity` + `audit` schemas and the `AuditWriter`: implementation plan

**Ticket:** AIS-177 `Admin - impl: tevékenység és audit napló táblák + AuditWriter` (subtask of AIS-14)
**Depends on:** AIS-18 ✅ (`customer`, `iam` schemas, migration `0005`), AIS-16 ✅ (contract: `activitySchema`, `auditLogSchema`, enums)
**Blocks:** AIS-178 (`customers` API + audit on every write), AIS-184 (`vapi` schema), AIS-185 (`createNote` action)
**Suggested branch:** `AIS-177-activity-audit`
**Reference slice:** `apps/api/src/api-keys/` (const → errors → filter → mapper → logic → repository → service → controller → module)
**Parent plan:** [`2026-11-22--00-10-00-ais-14-customers-data-layer-plan.md`](2026-11-22--00-10-00-ais-14-customers-data-layer-plan.md:114) §5

---

## 0. Scope

### In scope

| #   | Deliverable                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `activity` and `audit` Postgres schemas, four enums, two tables, all constraints and indexes in [`schema.ts`](../../apps/api/src/db/schema.ts:1) |
| 2   | Generated migration `0006` (tables + enums) and a **hand-written** `0007` (append-only trigger + grants)                                         |
| 3   | `apps/api/src/audit/` — `AuditWriter` (single entry point), `AuditActorProvider`, pure diff logic, repository, module                            |
| 4   | `infra/postgres/init/02-schemas.sh` — two new schemas `USAGE` + `CREATE`, grant matrix, smoke-test expectations                                  |
| 5   | Tests: schema contract, diff logic, writer, actor provider, append-only e2e, DB-gate shell assertions                                            |
| 6   | Living specs (`Database-Local.md`, `Infrastructure-Docker.md`) + `docs/history/` entry + milestone                                               |

### Explicitly out of scope

- **No domain wiring.** No `customers` repository, service or controller exists yet, so "the repository writes an audit row after `insert`/`update`/soft `delete`" is _proved_ here with `activities` rows and rolls forward per resource in **AIS-178**. AIS-177 ships the seam, not the call sites.
- No `activities` HTTP endpoints, no `GET /:id/audit-logs` (both AIS-178).
- No admin authentication → the actor is `system` (see `F9` / `D6`).
- No `service` schema, no billing, no `customers.note` column.

---

## 1. Pre-flight findings (verified against the code)

| #       | Finding                                                                                                                                                                                                                                                                                                                                             | Consequence                                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1**  | The ticket says "the app role gets **only** `INSERT` on `audit_logs`". But AIS-178 will expose `GET /:id/audit-logs` for the _Napló_ tab (AIS-181).                                                                                                                                                                                                 | `SELECT` is mandatory; "only INSERT" must be read as **no `UPDATE`/`DELETE`**. See `D5`.                                                                                        |
| **F2**  | Migrations run as the `aisztens` app role, which **owns** the tables. An owner has `UPDATE`/`DELETE` regardless of any `GRANT`.                                                                                                                                                                                                                     | Privileges alone cannot make the log append-only — a `BEFORE UPDATE OR DELETE` trigger is the only enforcement (`AIS-14` finding `F2`, confirmed).                              |
| **F3**  | [`activitySchema`](../../packages/shared/src/contract/customers/customers.schema.ts:212) has `updatedAt: isoDateTimeSchema.nullable()`. The existing `updatedAt()` factory in [`schema.ts`](../../apps/api/src/db/schema.ts:115) is `NOT NULL DEFAULT now()`.                                                                                       | A new `nullableUpdatedAt()` factory is required; reusing the existing one would either drop the nullability or make every row look edited.                                      |
| **F4**  | The ticket lists `author_type` as `operator` / `customer_user` / `system`, but [`AUTHOR_TYPE_VALUES`](../../packages/shared/src/contract/customers/customers.enums.ts:172) has **four** values (`api_key` included).                                                                                                                                | The `CHECK` needs a fourth branch, otherwise an `api_key`-authored activity is **unrepresentable** — and the contract already allows it.                                        |
| **F5**  | `ON DELETE SET NULL` on `activities.operator_id` / `customer_user_id` is **impossible**: the `CHECK` demands the column when the type is set, so `SET NULL` would immediately violate it. `ON DELETE RESTRICT` is **wrong too**: Postgres checks `RESTRICT` row-by-row, and deleting a customer cascades to `customer_users` in the same statement. | Both author FKs use the default **`NO ACTION`**, which is checked at end-of-statement — exactly what the cascade needs. See `D2`.                                               |
| **F6**  | `auditLogSchema.recordId` is a nullable `uuid`, but `customer.customer_tags` has a composite PK and no uuid.                                                                                                                                                                                                                                        | Join-row audits write `record_id = NULL` and carry `after_data.{customer_id, tag_id}`. Documented, not accidental.                                                              |
| **F7**  | `drizzle-kit` cannot generate a trigger, a function or `GRANT`s (it only diffs the schema-as-code).                                                                                                                                                                                                                                                 | Two migrations: `0006` generated (enums + tables) and `0007` from `db:generate --custom` (trigger, function, grants) with a "do not regenerate" header.                         |
| **F8**  | [`02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:74) grants `USAGE` on 4 schemas and `CREATE` on 3; [`_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh:1) asserts `4 / 12 / 3`.                                                                                                                          | Both lists grow: **6** schemas, **18** `USAGE`, **5** `CREATE` (`email` stays `USAGE`-only).                                                                                    |
| **F9**  | [`Database`](../../apps/api/src/db/database.interface.ts:16) is `PostgresJsDatabase<typeof schema>` and no transaction type is exported anywhere. There is also **no admin auth on this branch** (AIS-71/72/73 are _In Review_, AIS-74 is _To Do_).                                                                                                 | Derive `DatabaseTransaction` once from `Database['transaction']` instead of hand-writing generics; the actor seam returns `system` until the auth story lands (`AIS-14` `D-A`). |
| **F10** | [`schema.spec.ts`](../../apps/api/src/db/schema.spec.ts:1) tests enum drift by importing the shared tuples and comparing them to the mirrored `*_DB_VALUES`.                                                                                                                                                                                        | The four new enums join that table; a value added on one side fails the build on the other — no new mechanism needed.                                                           |

---

## 2. Decisions

| #      | Question                                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Where do the four enums live?                | `activity.activity_type` + `activity.author_type` in the `activity` schema; `audit.audit_operation` + `audit.audit_source` in the `audit` schema. `audit.audit_logs.actor_type` **reuses** `activity.author_type` (one Postgres type for "who"), so the two tables can never disagree about the author vocabulary. Migration order must create that type first.                                                                                                        |
| **D2** | Which FK actions on the author references?   | `activities.operator_id` and `activities.customer_user_id` → default `NO ACTION`. `activities.customer_id` → `ON DELETE CASCADE` (a hard-deleted customer takes its feed with it; the **audit log** survives because it has no FK). `NO ACTION` is end-of-statement, so the `customers → customer_users` cascade and the `customers → activities` cascade settle together in the same statement. `RESTRICT` would break that path, `SET NULL` would break the `CHECK`. |
| **D3** | How many `CHECK` branches?                   | Four, one per `author_type`, including `api_key` (both FK columns `NULL`) — `F4`. The `CHECK` is a single disjunction and is asserted branch-by-branch in the DB gate.                                                                                                                                                                                                                                                                                                 |
| **D4** | What goes into `before_data` / `after_data`? | Only **changed** keys. `updated_at` is dropped from both sides (it changes on every write, so keeping it makes every row "changed" and buries the real diff); `occurred_at` already records when. `Date` → ISO string, `undefined` → key omitted, `null` kept as `null`. Implemented as one pure function, `diffAuditPayload(before, after)`.                                                                                                                          |
| **D5** | Privileges on `audit_logs`                   | `GRANT SELECT, INSERT TO aisztens`; `REVOKE UPDATE, DELETE FROM PUBLIC`; **and** the `BEFORE UPDATE OR DELETE` trigger, because the owner can ignore grants (`F2`). The trigger message names the table and the blocked operation so the e2e can assert it.                                                                                                                                                                                                            |
| **D6** | Who is the actor?                            | `AuditActorProvider` returns `{ type: 'system', id: null, name: 'system' }` today and `source = 'admin_api'` is supplied by the caller. The auth story (AIS-73/74) replaces the provider only — no schema change, no writer change.                                                                                                                                                                                                                                    |
| **D7** | Where do request facts come from?            | One pure helper `toAuditRequestFacts(req, requestId)` in the audit module: `user-agent` from the headers, the client address from `req.ip`, `request_id` from the resolved correlation id. Callers pass the object; the writer never reads Fastify. Keeps the writer unit-testable without HTTP.                                                                                                                                                                       |

---

## 3. Schema design (`apps/api/src/db/schema.ts`)

### 3.1 Enums (mirrors, `F10`)

```ts
/** Mirrors `ACTIVITY_TYPE_VALUES` in customers.enums.ts. */
export const ACTIVITY_TYPE_DB_VALUES = [
  'note',
  'call',
  'email',
  'meeting',
  'status_change',
  'system',
] as const;

/** Mirrors `AUTHOR_TYPE_VALUES` — four values, `api_key` included (D3). */
export const AUTHOR_TYPE_DB_VALUES = [
  'operator',
  'customer_user',
  'system',
  'api_key',
] as const;

/** Mirrors `AUDIT_OPERATION_VALUES`. */
export const AUDIT_OPERATION_DB_VALUES = [
  'insert',
  'update',
  'delete',
  'soft_delete',
] as const;

/** Mirrors `AUDIT_SOURCE_VALUES`. */
export const AUDIT_SOURCE_DB_VALUES = [
  'admin_api',
  'web',
  'worker',
  'cron',
] as const;

export const activityTypeEnum = activitySchema.enum(
  'activity_type',
  ACTIVITY_TYPE_DB_VALUES,
);
/** One type for both tables: activities and the audit log (D1). */
export const authorTypeEnum = activitySchema.enum(
  'author_type',
  AUTHOR_TYPE_DB_VALUES,
);
export const auditOperationEnum = auditSchema.enum(
  'audit_operation',
  AUDIT_OPERATION_DB_VALUES,
);
export const auditSourceEnum = auditSchema.enum(
  'audit_source',
  AUDIT_SOURCE_DB_VALUES,
);
```

New imports: `bigint`, `inet`, `jsonb` from `drizzle-orm/pg-core`.

### 3.2 `activity.activities`

| Column             | Type                                      | Notes                                                     |
| ------------------ | ----------------------------------------- | --------------------------------------------------------- |
| `id`               | `uuid` PK `defaultRandom()`               |                                                           |
| `customer_id`      | `uuid` `NOT NULL`                         | FK → `customer.customers(id)` `ON DELETE CASCADE`         |
| `type`             | `activity_type` `NOT NULL`                |                                                           |
| `body`             | `text` `NOT NULL`                         | every remark is an activity, there is no `customers.note` |
| `author_type`      | `author_type` `NOT NULL`                  |                                                           |
| `operator_id`      | `uuid` nullable                           | FK → `iam.operators(id)` `NO ACTION`                      |
| `customer_user_id` | `uuid` nullable                           | FK → `iam.customer_users(id)` `NO ACTION`                 |
| `author_name`      | `text` `NOT NULL`                         | **snapshot** — survives deactivation of the author        |
| `metadata`         | `jsonb` nullable                          |                                                           |
| `created_at`       | `timestamptz(3)` `NOT NULL DEFAULT now()` | existing `createdAt()`                                    |
| `updated_at`       | `timestamptz(3)` nullable                 | new `nullableUpdatedAt()` (`F3`)                          |
| `deleted_at`       | `timestamptz(3)` nullable                 | existing `deletedAt()`                                    |

Constraints:

```ts
check(
  'activities_author_reference_check',
  sql`(
        (${t.authorType} = 'system'
          AND ${t.operatorId} IS NULL AND ${t.customerUserId} IS NULL)
     OR (${t.authorType} = 'operator'
          AND ${t.operatorId} IS NOT NULL AND ${t.customerUserId} IS NULL)
     OR (${t.authorType} = 'customer_user'
          AND ${t.operatorId} IS NULL AND ${t.customerUserId} IS NOT NULL)
     OR (${t.authorType} = 'api_key'
          AND ${t.operatorId} IS NULL AND ${t.customerUserId} IS NULL)
  )`,
);
// Partial index: the feed query is always "live rows of one customer, newest first".
index('activities_customer_created_idx')
  .on(t.customerId, t.createdAt.desc())
  .where(sql`${t.deletedAt} IS NULL`);
```

### 3.3 `audit.audit_logs`

| Column        | Type                                      | Notes                                                                                                                                          |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `bigint` identity PK                      | `bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity()` — first identity column in the repo (`AIS-14` `F9`), pinned by `schema.spec.ts` |
| `customer_id` | `uuid` nullable, **no FK**                | anonymisation sets it to `NULL`; the log outlives the customer                                                                                 |
| `table_name`  | `text` `NOT NULL`                         | `customers` / `contacts` / `activities` / `customer_users` / `customer_tags`                                                                   |
| `record_id`   | `uuid` nullable                           | `NULL` for join rows (`F6`)                                                                                                                    |
| `operation`   | `audit_operation` `NOT NULL`              |                                                                                                                                                |
| `before_data` | `jsonb` nullable                          | changed keys only (`D4`)                                                                                                                       |
| `after_data`  | `jsonb` nullable                          | changed keys only (`D4`)                                                                                                                       |
| `actor_type`  | `activity.author_type` `NOT NULL`         | cross-schema type reuse (`D1`)                                                                                                                 |
| `actor_id`    | `uuid` nullable, **no FK**                | generic on purpose: the log must survive the actor's deletion                                                                                  |
| `actor_name`  | `text` `NOT NULL`                         | snapshot                                                                                                                                       |
| `occurred_at` | `timestamptz(3)` `NOT NULL DEFAULT now()` |                                                                                                                                                |
| `ip_address`  | `inet` nullable                           | first `inet` column (`AIS-14` `F9`)                                                                                                            |
| `user_agent`  | `text` nullable                           |                                                                                                                                                |
| `request_id`  | `text` nullable                           | correlation with the envelope's `requestId`                                                                                                    |
| `source`      | `audit_source` nullable                   | `NULL` is legal (worker or migration may not know its edge)                                                                                    |

Indexes: `audit_logs_customer_occurred_idx (customer_id, occurred_at DESC)`, `audit_logs_table_record_idx (table_name, record_id)`, `audit_logs_request_id_idx (request_id)`.

Row types: `ActivityRow`, `NewActivityRow`, `AuditLogRow`, `NewAuditLogRow`.

### 3.4 Relationship sketch

```mermaid
erDiagram
    CUSTOMERS ||--o{ ACTIVITIES : has
    OPERATORS ||--o{ ACTIVITIES : authors
    CUSTOMER_USERS ||--o{ ACTIVITIES : authors
    CUSTOMERS ||--o{ AUDIT_LOGS : soft-reference
    ACTIVITIES {
        uuid id PK
        uuid customer_id FK
        activity_type type
        author_type author_type
        uuid operator_id FK
        uuid customer_user_id FK
        timestamptz deleted_at
    }
    AUDIT_LOGS {
        bigint id PK
        uuid customer_id "no FK"
        text table_name
        uuid record_id
        audit_operation operation
        jsonb before_data
        jsonb after_data
        inet ip_address
    }
```

---

## 4. Migrations

| File                                                                                       | How                                                                          | Content / review checklist                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/drizzle/0006_<generated>.sql` + `meta/0006_snapshot.json` + `meta/_journal.json` | `pnpm --filter @callback/api db:generate`                                    | `CREATE TYPE "activity"."activity_type"`, then `"activity"."author_type"`, then `"audit"."audit_operation"`, `"audit"."audit_source"`; `activities` before `audit_logs` (cross-schema type); verify whether the generator emits `CREATE SCHEMA` and, if it does, guard it with `IF NOT EXISTS` by hand (same correction AIS-18 needed); confirm `bigint GENERATED ALWAYS AS IDENTITY`, `inet`, and the `CHECK` text |
| `apps/api/drizzle/0007_audit_immutability.sql`                                             | `pnpm --filter @callback/api db:generate --custom --name=audit_immutability` | header "do not regenerate"; `CREATE FUNCTION audit.reject_audit_mutation()` raising `audit.audit_logs is append-only …`; `CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit.audit_logs FOR EACH ROW`; `BEFORE TRUNCATE … FOR EACH STATEMENT`; `REVOKE UPDATE, DELETE ON audit.audit_logs FROM PUBLIC`; comment stating explicitly that the trigger — not the grant — is the enforcement (`D5`) |

`apps/api/drizzle.config.ts` needs no change (schema list is imported from `schema.ts`).

---

## 5. The audit module (`apps/api/src/audit/`)

| File                             | Responsibility                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit.const.ts`                 | `AUDIT_WRITER` (string DI token, api-keys pattern), `AUDIT_SOURCE_ADMIN_API = 'admin_api'`, the append-only constraint/trigger names for the e2e           |
| `audit.interface.ts`             | `AuditTableName` union, `AuditWriteInput`, `AuditActor`, `AuditRequestFacts`, `AuditDiff`                                                                  |
| `audit-transaction.interface.ts` | `export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];` — the single place the transaction type is derived (`F9`)       |
| `audit-diff.logic.ts`            | `diffAuditPayload(before, after): AuditDiff` — pure, no I/O (`D4`)                                                                                         |
| `audit-actor.interface.ts`       | `AuditActorProvider { resolve(): AuditActor }`                                                                                                             |
| `audit-actor.provider.ts`        | `@Injectable()`, returns `{ type: 'system', id: null, name: 'system' }` today (`D6`)                                                                       |
| `audit-request.logic.ts`         | `toAuditRequestFacts(req: AuditRequestLike, requestId: string): AuditRequestFacts` — pure header/ip extraction (`D7`)                                      |
| `audit.repository.interface.ts`  | `insert(row: NewAuditLogRow, tx: DatabaseTransaction): Promise<void>`                                                                                      |
| `audit.repository.ts`            | Drizzle implementation, `@Inject(DATABASE)`                                                                                                                |
| `audit-writer.interface.ts`      | `AuditWriter { write(input: AuditWriteInput, tx: DatabaseTransaction, facts: AuditRequestFacts): Promise<void> }`                                          |
| `audit-writer.service.ts`        | takes the actor from the provider, the diff from the pure logic, then one `repository.insert` **on the caller's transaction handle** — never opens its own |
| `audit.module.ts`                | provides `DATABASE`-backed repository, writer, actor provider; **exports `AuditWriter`**                                                                   |

Writer contract:

```ts
export interface AuditWriteInput {
  readonly customerId: string | null;
  readonly tableName: AuditTableName;
  readonly recordId: string | null;
  readonly operation: AuditOperation;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
}

export interface AuditWriter {
  write(
    input: AuditWriteInput,
    tx: DatabaseTransaction,
    facts: AuditRequestFacts,
  ): Promise<void>;
}
```

Rules the implementation must honour:

1. `before = null` for `insert`, `after = null` for `delete`/`soft_delete`, both present for `update`.
2. If `diffAuditPayload` returns **no changed keys** on an `update`, the writer writes nothing and returns — an empty diff is not an audit fact.
3. The writer never catches: a failed audit insert must roll the business write back (that is the whole point of the shared transaction).

---

## 6. Infrastructure changes

| File                                                                                                 | Change                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`infra/postgres/init/02-schemas.sh`](../../infra/postgres/init/02-schemas.sh:63)                    | `CREATE SCHEMA IF NOT EXISTS activity;` + `audit;`; `USAGE` VALUES list → 6 entries; `CREATE` VALUES list → 5 entries (`platform`, `customer`, `iam`, `activity`, `audit`); grant-matrix comment gains the two rows; `\echo` line updated |
| [`scripts/test/_postgres-init-schemas-test.sh`](../../scripts/test/_postgres-init-schemas-test.sh:1) | expectations `4 → 6` schemas, `12 → 18` `USAGE`, `3 → 5` `CREATE`; keep asserting `email` is `USAGE`-only                                                                                                                                 |
| [`scripts/test/lib/20-cross-service.sh`](../../scripts/test/lib/20-cross-service.sh:1)               | the schema-list SQL literal and its expected count                                                                                                                                                                                        |

`activity`/`audit` are created by this script **and** populated by the migration, so a fresh volume and an already-initialised one end up with the same owner and the same grants (the AIS-18 rule).

---

## 7. Test matrix

| Suite                             | File (new/extended)                                               | Mandatory coverage                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema contract                   | extend [`schema.spec.ts`](../../apps/api/src/db/schema.spec.ts:1) | column mapping for both tables; four enum drift assertions vs the shared tuples; `NOT NULL`/nullable per column; `activities_author_reference_check` SQL text; partial index predicate; `audit_logs` has **no** FK on `customer_id`, `actor_id`, `record_id`; `bigint` identity + `inet` column types pinned; the committed `0006` SQL is read and asserted like the earlier migrations |
| Diff logic                        | `apps/api/src/audit/audit-diff.logic.spec.ts`                     | add-only / remove-only / change-only; identical objects → empty diff; `updated_at` excluded; `Date` → ISO; `undefined` dropped vs `null` kept; nested object replaced wholesale; array equality; `null` before vs object after                                                                                                                                                          |
| Request facts                     | `apps/api/src/audit/audit-request.logic.spec.ts`                  | array-valued `user-agent` header, missing headers, `req.ip` absent, over-long values clipped or rejected per contract limits                                                                                                                                                                                                                                                            |
| Writer                            | `apps/api/src/audit/audit-writer.service.spec.ts`                 | one insert per operation; actor from the provider; empty diff → no insert; repository rejection propagates (never swallowed); `soft_delete` writes `after: null`                                                                                                                                                                                                                        |
| Actor provider                    | `apps/api/src/audit/audit-actor.provider.spec.ts`                 | returns the frozen `system` actor                                                                                                                                                                                                                                                                                                                                                       |
| Module wiring                     | `apps/api/src/audit/audit.module.spec.ts`                         | module compiles and exports the `AUDIT_WRITER` token                                                                                                                                                                                                                                                                                                                                    |
| Append-only (real DB)             | `apps/api/test/audit-immutability.e2e-spec.ts`                    | behind the existing [`database-gate.ts`](../../apps/api/test/lib/database-gate.ts:1) loud-skip; `UPDATE` raises, `DELETE` raises, `TRUNCATE` raises, `INSERT` succeeds; a business write + `AuditWriter.write` in one transaction commits both, and a thrown error rolls **both** back                                                                                                  |
| `activities` invariants (real DB) | same e2e or a sibling `activities.e2e-spec.ts`                    | all four `CHECK` branches accepted, four contradictory combinations rejected **by constraint name**; soft delete removes from the feed but keeps the audit row                                                                                                                                                                                                                          |
| DB bootstrap                      | `_postgres-init-schemas-test.sh`, `20-cross-service.sh`           | the new counts, plus `db:migrate` applied twice is a no-op                                                                                                                                                                                                                                                                                                                              |

Mocks and fixtures live in `apps/api/src/audit/test/mocks/` (api-keys convention), never inside the spec files.

---

## 8. Documentation deliverables

| File                                                                                 | Change                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/Specs/Database-Local.md`](../../docs/Specs/Database-Local.md:1)               | new §4.2: the two schemas, why `activity` and `audit` are separate (feed vs. immutable ledger), the constraint list and _why_ each exists (`NO ACTION`, the four-branch `CHECK`, no-FK columns), the append-only trigger, the anonymisation rule, verification queries |
| [`docs/Specs/Infrastructure-Docker.md`](../../docs/Specs/Infrastructure-Docker.md:1) | §6.2 schema list + grant matrix, the `6 / 18 / 5` smoke note, header date                                                                                                                                                                                              |
| `docs/history/<ts>-ais-177-activity-audit-tables.md`                                 | narrative: findings, decisions, evidence, verification output                                                                                                                                                                                                          |
| `docs/milestones/<ts>-ais-177-append-only-audit-log.milestone.md`                    | the two decisions a future contributor must not "simplify": (a) grants cannot enforce append-only for an owning role → trigger, (b) `NO ACTION` rather than `RESTRICT`/`SET NULL` on the author FKs                                                                    |

---

## 9. Verification

```text
db:      pnpm --filter @callback/api db:generate
         pnpm --filter @callback/api db:check
         pnpm --filter @callback/api build
         pnpm --filter @callback/api db:migrate        # twice: second run is a no-op
api:     pnpm --filter @callback/api test
         pnpm --filter @callback/api test:e2e          # with DATABASE_URL set
infra:   bash scripts/test/_postgres-init-schemas-test.sh
all:     pnpm quality && pnpm lint && pnpm -r build && pnpm test
```

Database gate (the AIS-18 recipe, repeated because it worked):

```bash
docker run -d --name ais177-gate -p 5433:5432 -e POSTGRES_DB=aisztens_db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres_test_only \
  -e AISZTENS_DB_USER=aisztens -e AISZTENS_DB_PASSWORD=aisztens_test_only \
  -e TKOVARI_DB_PASSWORD=x -e KRAK_DB_PASSWORD=y \
  -v "$PWD/infra/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine
set DATABASE_URL=postgres://aisztens:aisztens_test_only@localhost:5433/aisztens_db
pnpm --filter @callback/api build && pnpm --filter @callback/api db:migrate
```

Acceptance evidence to capture in the history entry: `6` schemas / `18` `USAGE` / `5` `CREATE`; `8` migrations (0000–0007); `4` new enums; the `UPDATE`/`DELETE`/`TRUNCATE` raise messages; the rollback test proving a business row and its audit row disappear together.

---

## 10. Execution order

1. `schema.ts`: `activity` + `audit` `pgSchema`s, `nullableUpdatedAt()`, four mirrored enum tuples and their `pgEnum`s, `activities`, `audit_logs`, row types; `git add` — no migration yet.
2. `db:generate` → review `0006` against §4's checklist → fix `CREATE SCHEMA` guards by hand if present.
3. `db:generate --custom --name=audit_immutability` → write `0007` (function, triggers, grants).
4. `schema.spec.ts`: extend the enum-drift table, column mappings, constraint and index assertions; read `0006`/`0007` SQL text.
5. `apps/api/src/audit/`: const → interface → transaction type → diff logic (+ spec) → actor provider (+ spec) → request facts logic (+ spec) → repository (+ spec/mocks) → writer (+ spec) → module (+ spec).
6. `02-schemas.sh` + the two shell test expectations.
7. `apps/api/test/audit-immutability.e2e-spec.ts` (and the `activities` invariant cases).
8. Run the full gate set (§9) against a throwaway Postgres.
9. Docs: `Database-Local.md`, `Infrastructure-Docker.md`, history, milestone.
10. Run the gates a second time; commit as `AIS-177: feat(db): add activity and audit schemas and AuditWriter`, transition AIS-177 to _In Review_.

---

## 11. Risk register

| Risk                                                                                       | Mitigation                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A hand-edited `0007` is later rewritten by `db:generate`                                   | `--custom` migration with a "do not regenerate" header; `db:check` stays green; the e2e proves the trigger exists, so a lost trigger fails CI, not production                                                                                                                                                                                                        |
| The trigger blocks a legitimate operation (e.g. anonymisation wants to null `customer_id`) | Anonymisation **must** touch `audit_logs`? It must **not** — the decision is that `before_data`/`after_data` stay, and the `customer_id` clear on `audit_logs` happens with the trigger temporarily... **no**: instead the _anonymisation_ path is out of scope here and AIS-178/AIS-176 must decide. Recorded as a follow-up so nobody "fixes" the trigger casually |
| `inet` rejects a proxy header value (`x-forwarded-for` list)                               | `toAuditRequestFacts` takes a single address and validates it; an invalid value becomes `null` rather than a failed write                                                                                                                                                                                                                                            |
| Cross-schema enum (`activity.author_type` used by `audit.audit_logs`)                      | Both schemas are created in `02-schemas.sh` before any migration; the migration creates the type first; `db:migrate` on an existing volume was verified in AIS-18 with the same script order                                                                                                                                                                         |
| Transaction threading is forgotten in AIS-178                                              | The writer signature **requires** the `tx` handle — passing the root `Database` does not type-check                                                                                                                                                                                                                                                                  |
| The two tables drift from the shared contract                                              | `schema.spec.ts` enum-drift assertions + AIS-178's envelope/response validator                                                                                                                                                                                                                                                                                       |

---

## 12. Follow-ups (recorded, not implemented here)

- **AIS-178** — every write in the resource group (`customers`, `contacts`, `customer_tags`, `customer_users`, `activities`) goes through one transaction: row write → `AuditWriter.write` (`AIS-14` `D-D`). Contact soft delete must also delete its `contact_roles` rows (AIS-18 follow-up), or the `primary` slot stays occupied.
- **AIS-178** — `GET /:id/audit-logs` needs `SELECT` on `audit.audit_logs`; provided here by `D5`.
- **AIS-184** — the `vapi` schema reuses `activity.author_type`? It writes `activities` rows (`createNote`) and audit rows for worker-driven changes, so it should reuse this writer instead of its own insert.
- **Auth story (AIS-73/74)** — implement `AuditActorProvider` against the session; nothing else changes.
- **Anonymisation** — decide whether the trigger gets a controlled bypass (a `SECURITY DEFINER` function owned by a migration-only role) or whether `audit_logs` rows are never touched. Default position: never touched.
