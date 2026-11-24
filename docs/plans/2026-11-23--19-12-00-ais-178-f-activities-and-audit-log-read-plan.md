# AIS-178 / slice f — `activities` + the audit-log read

**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Slice lettering** (audit [`2026-11-23--15-23-00-ais-14-gap-analysis.md`](../history/2026-11-23--15-23-00-ais-14-gap-analysis.md:106), M4):
**a** contract ✅ · **b** `customers` API ✅ · **c** `api-client` ✅ · **d** contacts ✅ · **e** tags + customer users ✅ · **f** = this plan · after it AIS-178 is feature-complete.
**Depends on:** AIS-177 (`activity.activities`, `audit.audit_logs`, `AuditWriter`, append-only trigger `0007`) ✅
**Consumed by:** AIS-181 (the `activity` and `audit` tabs), and the AIS-14 DoD e2e chain
**Screen contract:** [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:161) §3.2
**Suggested branch:** `AIS-178-f-activities-audit-log`
**Commit title:** `AIS-178: feat(api): add customer activities and the audit-log read`

---

## 0. Why this slice is the last one

Every other resource is reachable, but **an operator still cannot write a single remark about a
customer**: there is no `note` column by design (AIS-16 `D9`), so the activity feed *is* the remark
store, and it has no endpoint. Three visible consequences follow, and all three are DoD items:

1. `customers.lastActivityAt` is `null` for every customer and `?sort=lastActivityAt` sorts a value that
   can never move.
2. The ledger is written on every mutation but **never readable**, so the "Napló" tab (AIS-181) has no
   source — although `0007_audit_immutability.sql` grants `SELECT` on it exactly for this.
3. The DoD chain *create → list → detail → **activity** → the entry appears in the audit log* cannot be
   written at all today.

---

## 1. Decisions

| # | Question | Decision |
| --- | --- | --- |
| F1 | Scope | Four `activities` operations + the `audit-logs` read. Five registry entries, each with its controller **and** client method in one commit (the AIS-110/AIS-98 gates fail otherwise). |
| F2 | Where does the ledger *read* live? | In the `customers` feature, **not** in the `audit` module. [`audit.repository.interface.ts`](../../apps/api/src/audit/audit.repository.interface.ts:5) documents the module as write-only precisely because "reads belong to the customers module, which owns the list contract". The writer, the diff logic and the append-only guarantee stay untouched. |
| F3 | Who authors an activity? | `AUDIT_ACTOR_PROVIDER` — the same seam the ledger uses. The service injects it and writes `authorType` / `authorName` / `operatorId` / `customerUserId` from `resolve()`. Today that is `system`/`system`/`null`/`null`, which satisfies `activities_author_reference_check`; AIS-73/74 replaces one class. |
| F4 | Concurrency token of `PATCH …/activities/:activityId` | The row's **last write instant**: compare against `updatedAt ?? createdAt`, then set `updatedAt = now`. `activities.updated_at` is nullable ("never edited", AIS-177), so a plain `updatedAt` compare would make the *first* edit impossible. The contract already requires `updatedAt` in the body. |
| F5 | `DELETE` semantics | Soft delete (`deleted_at`), audited as `soft_delete`; a repeat is `404`. Because `lastActivityAt` is `max(created_at) WHERE deleted_at IS NULL`, the projection falls back to the previous activity — that is the reason the column exists. |
| F6 | Audit-log query contract | Paged + `order` (default `desc`) and the four filters the ticket names: `tableName` (closed list = `AUDIT_TABLE_NAMES`), `operation` (`AUDIT_OPERATION_VALUES`), `actorId` (uuid), and `from`/`to` on `occurredAt`. **No `q`**: the ledger is machine data, and a free-text search over `jsonb` payloads would promise a relevance the index (`audit_logs_customer_occurred_idx`) cannot serve. |
| F7 | Activity-list query contract | Paged + `order`, **no `q` and no `sort`**: the feed is strictly `created_at`-ordered (index `activities_customer_created_idx`) and the screen has no search box. `q` is therefore *removed* from the schema rather than accepted and ignored. |
| F8 | `from > to` | Shape-valid, content-wrong → `422 SEMANTIC_VALIDATION_FAILED` with `details[0].path = "from"` (the AIS-108 rule), not a silent empty page. |
| F9 | Stable order | Activities: `created_at` + `id` tie-breaker. Ledger: `occurred_at` + **`id` descending** tie-breaker — `id` is the identity sequence, so it *is* the append order and two rows of the same millisecond stay stable across pages. |
| F10 | What stays impossible | No `UPDATE`/`DELETE` of a ledger row (trigger + grants), no export, no audit search in `before_data`/`after_data`, no activity attachments, and no writer-side change of any kind. |

---

## 2. Pre-flight findings

| # | Finding | Consequence |
| --- | --- | --- |
| P1 | All Zod schemas already exist: `activitySchema`, `createActivitySchema`, `updateActivitySchema` (with the required `updatedAt`), `auditLogSchema` ([`customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:252)) | Slice f adds **list** schemas and path-parameter schemas only; no request body is invented. |
| P2 | Fixtures `VALID_ACTIVITY`, `SYSTEM_ACTIVITY`, `VALID_AUDIT_LOG` exist | The registry examples and the list fixtures derive from them — no new sample data. |
| P3 | `AUDIT_TABLE_NAMES` already lists `activities` ([`audit.const.ts`](../../apps/api/src/audit/audit.const.ts:33)) | An activity write audited by `AuditWriter` type-checks without touching the audit module. |
| P4 | `activity.activities` has `deleted_at`; `audit.audit_logs` does **not** (append-only) | Activity reads filter `deleted_at IS NULL`; the ledger read has **no** such filter and must not grow one. |
| P5 | `audit_logs.id` is `bigint` with `mode: 'number'` | The wire type is `z.number().int().nonnegative()`, already in `auditLogSchema`; no string conversion needed. |
| P6 | The ledger has **no foreign keys** on purpose | A customer delete does not remove its ledger rows, so the audit read must not assume the customer row is alive — but it still answers `404` for a soft-deleted customer, consistently with every other child route. |
| P7 | `activities.metadata` is `jsonb` and nullable | `updateActivitySchema` accepts `metadata: null` → "clear it"; the mapper must keep `undefined` (leave alone) and `null` (clear) apart, exactly like the customer patch. |
| P8 | `customers.repository.ts` already projects `lastActivityAt` with `deleted_at IS NULL` ([`customers.repository.ts`](../../apps/api/src/customers/customers.repository.ts:87)) | No change needed there; the e2e proves the projection starts moving once an activity exists — and moves back after a soft delete. |
| P9 | `updateActivitySchema` requires `updatedAt` but `activities.updated_at` has no `$onUpdate` | The repository sets `updated_at` explicitly on every update; forgetting it would freeze the token (covered by a unit test). |
| P10 | OpenAPI needs a component name per schema ([`zod-openapi.ts`](../../apps/api/src/common/openapi/zod-openapi.ts:102)) | Six new names: `Activity`, `ActivityList`, `CreateActivity`, `UpdateActivity`, `AuditLog`, `AuditLogList`. |

---

## 3. Deliverables

### 3.1 Registry entries (all five in one commit)

| operationId | verb | path | validation | success | audit |
| --- | --- | --- | --- | --- | --- |
| `customers.listActivities` | `GET` | `/api/admin/customers/:id/activities` | `customerIdSchema` + `ZodQueryPipe(activityListQuerySchema)` | `200` + `meta.pagination` | — |
| `customers.createActivity` | `POST` | `/api/admin/customers/:id/activities` | + `ZodBodyPipe(createActivitySchema)` | `201` `Activity` | `activities` `insert` |
| `customers.updateActivity` | `PATCH` | `/api/admin/customers/:id/activities/:activityId` | both params + `ZodBodyPipe(updateActivitySchema)` | `200` `Activity` | `activities` `update` (changed keys only) |
| `customers.removeActivity` | `DELETE` | `/api/admin/customers/:id/activities/:activityId` | both params | `200`, `data: null` | `activities` `soft_delete` |
| `customers.listAuditLogs` | `GET` | `/api/admin/customers/:id/audit-logs` | `customerIdSchema` + `ZodQueryPipe(auditLogListQuerySchema)` | `200` + `meta.pagination` | — (read-only by construction) |

### 3.2 New files — `apps/api/src/customers/customers-activities.*`

| File | Content |
| --- | --- |
| `customers-activities.const.ts` | `CUSTOMER_ACTIVITIES_REPOSITORY`, `CUSTOMER_ACTIVITIES_ROUTE = 'admin/customers/:id/activities'`, `ACTIVITIES_TABLE_NAME = 'activities'` |
| `customers-activities.errors.ts` | `ActivityRowMissingError` (no Nest import; a guarded update/soft delete that returns no row is a `STALE_WRITE`/`404` decision made by the service) |
| `customers-activities.interface.ts` | `ActivityPage`, `ActivityPatch` (the column subset a `PATCH` may write, incl. `metadata: null`) |
| `customers-activities.filter.ts` | `activityVisibleFilter(customerId)` — `customer_id = … AND deleted_at IS NULL`, one expression for the page **and** the count |
| `customers-activities.mapper.ts` | pure: `toActivity(row)`, `toNewActivityRow(customerId, input, author, now)`, `toActivityPatch(input)`, `hasActivityPatch(patch)`, `toActivityAuditPayload(row)` |
| `customers-activities.repository.interface.ts` / `.repository.ts` | `customerExists`, `findPage`, `findAnyById` (to tell `404` from "changed meanwhile"), `create(tx)`, `updateById(tx, …, expectedLastWrite)`, `softDeleteById(tx, …, deletedAt)`, `runInTransaction` |
| `customers-activities.service.ts` | one transaction per write; author from `AUDIT_ACTOR_PROVIDER`; `404`/`409 STALE_WRITE` classification; audit row per write |
| `customers-activities.controller.ts` | four routes, `@Req()` facts on the three mutating handlers |
| `customers-activities.*.spec.ts`, `test/mocks/customers-activities.mock.ts` | §6 |

### 3.3 New files — `apps/api/src/customers/customers-audit-logs.*`

| File | Content |
| --- | --- |
| `customers-audit-logs.const.ts` | `CUSTOMER_AUDIT_LOGS_REPOSITORY`, `CUSTOMER_AUDIT_LOGS_ROUTE = 'admin/customers/:id/audit-logs'` |
| `customers-audit-logs.interface.ts` | `AuditLogPage` |
| `customers-audit-logs.filter.ts` | `auditLogVisibleFilter(customerId, query)` — the four filters + the `occurredAt` range, one expression reused by page and count |
| `customers-audit-logs.mapper.ts` | pure: `toAuditLog(row)` (`Date` → ISO, `jsonb` passthrough) |
| `customers-audit-logs.repository.interface.ts` / `.repository.ts` | `customerExists`, `findPage(customerId, query)` — **`SELECT` only**, no write method at all |
| `customers-audit-logs.service.ts` | parent guard + paging arithmetic; nothing else (no write path to get wrong) |
| `customers-audit-logs.controller.ts` | one `GET` route |
| `customers-audit-logs.*.spec.ts`, `test/mocks/customers-audit-logs.mock.ts` | §6 |

### 3.4 Shared contract (`packages/shared`)

| File | Change |
| --- | --- |
| `customers.const.ts` | `CUSTOMERS_ACTIVITY_ID_PARAM = ':activityId'` |
| `customers.schema.ts` | `activityIdSchema`, `activityListSchema` (`z.array(activitySchema)`), `auditLogListSchema` (`z.array(auditLogSchema)`) |
| `customers.list-query.ts` | `activityListQuerySchema` (`listQuerySchema.omit({ q: true })`), `auditLogListQuerySchema` (same `.omit` + `tableName`/`operation`/`actorId`/`from`/`to`), the matching `ApiQueryParameterContract` entries, and the OpenAPI parameter arrays |
| `customers.interface.ts` | `ActivityListQuery`, `AuditLogListQuery` |
| `customers.fixture.ts` | `VALID_ACTIVITY_LIST`, `VALID_AUDIT_LOG_LIST` (derived from the existing single-row fixtures) |
| `customers.contract.ts` | the five entries of §3.1 |
| `index.ts`, `test/endpoint-registry.test.ts` | exports + the five sample payloads |

### 3.5 Client (`packages/api-client`)

| File | Change |
| --- | --- |
| `customers.const.ts` | `CUSTOMERS_ACTIVITIES_PATH` (`clientPathOf('customers.listActivities')`), `CUSTOMERS_ACTIVITY_PATH` (`customers.updateActivity`), `CUSTOMERS_AUDIT_LOGS_PATH` (`customers.listAuditLogs`) |
| `customers.path.ts` | `toCustomerActivitiesPath`, `toCustomerActivityPath`, `toCustomerAuditLogsPath` |
| `customers.interface.ts` / `.service.ts` | `listActivities` / `createActivity` / `updateActivity` / `removeActivity` / `listAuditLogs` — the three list calls through `getList`, the mutations through `post`/`patch`/`delete` with the shared schemas |
| `index.ts` | the three paths and builders |

### 3.6 Modified files

| File | Change |
| --- | --- |
| `apps/api/src/customers/customers.module.ts` | two controllers, two repository tokens |
| `apps/api/src/customers/customers.module.spec.ts` | the new tokens resolve |
| `apps/api/src/common/openapi/zod-openapi.ts` (+ spec) | six component names |
| `docs/Specs/API-Convention.md` | §12.3 (five routes, the ledger's read-only nature, the two query contracts); header date bumped |
| `docs/Specs/Database-Local.md` | the documented **purge recipe** for e2e ledger rows (`session_replication_role = replica` under a superuser session) — the AIS-14 DoD's M8 item |
| `docs/history/<ts>-ais-178-f-activities-audit-log.md`, `docs/milestones/<ts>-….milestone.md` | change summary + decision record |

**Not touched:** `apps/api/drizzle/*` (no migration — both tables exist since AIS-177), `apps/api/src/audit/*` (write-only by design, `F2`), `apps/admin/src/pages` (AIS-181), `infra/*`.

---

## 4. Behaviour that must hold

1. `listActivities`: `deleted_at IS NULL`, newest first, `order` respected, `id` tie-breaker, `meta.pagination` from `toPaginationMeta`.
2. `createActivity`: `authorType`/`authorName` come from `AUDIT_ACTOR_PROVIDER`, never from the body (`.strict()` rejects an author field); `deletedAt`/`createdAt` stay server values; `201` with the stored row.
3. `createActivity` writes **exactly one** `activities` insert row on the caller's transaction, `table_name = 'activities'`, `record_id` = the new id.
4. `updateActivity`: the token is `updatedAt ?? createdAt`; a mismatch is `409 STALE_WRITE`; the write also sets `updatedAt = now`, so the next edit's token has moved.
5. `updateActivity` with only `updatedAt` is a no-op: `200` with the current row, no `UPDATE`, **no** audit row (the b-plan `D7` rule).
6. `removeActivity`: one `UPDATE … SET deleted_at = now()`; a repeat is `404`; the audit row is `soft_delete`; `lastActivityAt` of the parent falls back to the previous live activity.
7. `listAuditLogs`: `occurred_at` descending with the `id` tie-breaker, `order=asc` honoured; every filter applied server-side; `meta.pagination` consistent with the filters.
8. `listAuditLogs` never writes: the repository has no insert/update/delete method, and an append-only table cannot be mutated even by accident.
9. `from > to` is `422` with `details[0].path = 'from'`; an unknown `tableName`/`operation` is a `400` from the shared enum.
10. Every route answers `404` for a soft-deleted or unknown customer, and `400` for a malformed uuid — never `500`.

---

## 5. Data notes (no migration)

| Table | Rule the endpoints rely on | Consequence |
| --- | --- | --- |
| `activity.activities` | `deleted_at` exists; `updated_at` is **nullable** and has no `$onUpdate` | soft delete + the `updatedAt ?? createdAt` token (`F4`), written explicitly by the repository (`P9`) |
| `activity.activities` | `activities_author_reference_check` — exactly one author branch | the `system` actor writes `operator_id`/`customer_user_id` as `null` (`F3`); a body cannot reach the columns |
| `activity.activities` | `activities_customer_created_idx` (partial, live rows) | the feed query and the count share one `WHERE` |
| `audit.audit_logs` | append-only triggers (`BEFORE UPDATE/DELETE`, `BEFORE TRUNCATE`) | the read path is the *only* new path; a write from this slice would fail loudly |
| `audit.audit_logs` | no FKs; `customer_id` nullable | the audit read filters by `customer_id` and never joins the customer row |

---

## 6. Tests

| Suite | Coverage |
| --- | --- |
| `customers-activities.mapper.spec.ts` | author snapshot, `metadata` `undefined` vs `null`, `Date` → ISO, the nullable `updatedAt` |
| `customers-activities.repository.spec.ts` | mocked `Database`: the page `WHERE` equals the count's, `deleted_at IS NULL`, `id` tie-breaker, guarded update SQL (`updated_at = expected`), the explicit `updated_at = now` write, soft delete scope |
| `customers-activities.service.spec.ts` | author from the provider (not the body), one audit row per write, same `tx`, no audit on an empty patch, `STALE_WRITE` on the first edit of a never-edited row, `404` on a soft-deleted row, rethrown unknown errors |
| `customers-activities.controller.spec.ts` | `201`/`200`/`data: null`, param validation, audit facts from the raw request |
| `customers-audit-logs.mapper.spec.ts` | `bigint` id as a number, `jsonb` passthrough, nullable `customer_id`/`record_id`/`request_id` |
| `customers-audit-logs.repository.spec.ts` | the filter combinations (each of the four + the range), the `occurred_at`/`id` order, the page and count sharing one expression |
| `customers-audit-logs.service.spec.ts` | parent guard, `422` for `from > to`, paging block, nothing else (no write path) |
| `customers-audit-logs.controller.spec.ts` | envelope + query delegation |
| `customers.module.spec.ts` | the two new tokens resolve |
| `packages/api-client/test/customers.service.test.ts` | the five methods: URL, method, body, parse, plus the `422` and `409` code paths |
| `apps/api/test/customer-activity.e2e-spec.ts` | real Postgres: create → list (feed order) → patch (and a stale patch → `409`) → soft delete → `404`; **`lastActivityAt` moves in the customer detail and moves back after the delete**; one audit row per mutation |
| `apps/api/test/customer-audit-logs.e2e-spec.ts` | the DoD chain: after the four mutations the ledger contains them; the four filters narrow it; `occurred_at` ordering; `from > to` → `422`; an unknown `tableName` → `400`; the customer's rows only |
| gates | `envelope-contract` (verb + path), `openapi` (registry-driven), `service-coverage` (five new methods), admin parity (no new error code) |

E2E hygiene: unique `e2e-<uuid>` customer, business rows removed in `afterAll` (the customer cascade takes the activities), ledger rows **kept** and tagged with a fixed user agent — the trigger forbids deleting them, and `Database-Local.md` gains the purge recipe in this slice.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| The ledger read tempts someone into "fixing" a row | The repository exposes `SELECT` only, and the triggers turn an accidental `UPDATE`/`DELETE` into a hard failure (`F10`). |
| The first activity edit is always `STALE_WRITE` | The token is `updatedAt ?? createdAt` (`F4`), proven by a dedicated unit test and by the e2e patch step. |
| `updated_at` is never set, so the token freezes | The repository writes it explicitly; a unit test asserts the `set` payload contains it (`P9`). |
| Two ledger rows share a millisecond and the page repeats/skips one | `occurred_at` + `id` tie-breaker (`F9`); `id` is the identity sequence. |
| The audit read becomes a slow `jsonb` search | No `q` (`F6`); the filters ride `audit_logs_customer_occurred_idx`. |
| Activity author stays `system` forever | AIS-73/74 replaces `AUDIT_ACTOR_PROVIDER` in one binding; the ledger and the feed both follow because they read the same provider (`F3`). |
| The e2e pollutes the ledger forever | Documented purge recipe lands in this slice (`Database-Local.md`), and the rows carry the suite's user agent. |

---

## 8. Verification

```text
shared:  pnpm --filter @callback/shared test
client:  pnpm --filter @callback/api-client test          # incl. service-coverage
api:     pnpm --filter @callback/api test
         pnpm --filter @callback/api lint
         pnpm --filter @callback/api typecheck
         pnpm --filter @callback/api db:check
admin:   pnpm --filter @callback/admin test               # copy parity (unchanged)
e2e:     pnpm --filter @callback/api test:e2e -- customer-activity customer-audit-logs
docs:    pnpm quality
all:     pnpm typecheck && pnpm build
```

Definition of done for slice f:

- [ ] Five routes mounted; `envelope-contract`, `openapi` and `service-coverage` green.
- [ ] An activity can be created, listed, edited (with a moving token) and soft-deleted; `lastActivityAt` follows all four.
- [ ] The ledger is readable with the four filters and a stable order, and is writable by **nothing** in this slice.
- [ ] The DoD chain (create → list → detail → activity → ledger row) exists as one e2e suite.
- [ ] `docs/Specs/API-Convention.md` §12.3 and the purge recipe in `Database-Local.md` are updated in the same change; history + milestone written.

---

## 9. Out of scope

- **Admin UI** for the two tabs — AIS-181 (`use-customer-activities.ts`, `use-customer-audit-logs.ts`).
- **Auth** (AIS-73/74): the actor stays `system`; `audit_logs` rows of this period are not backfillable.
- **Ledger maintenance**: no undelete, no purge job, no export, no retention policy.
- **Activity attachments / typed metadata UI**, activity search (`q`), and any activity type transition rules.
- **`GET /api/admin/tags`** (the catalogue read deferred in slice `e`) and the invitation e-mail — both are follow-ups of their own slices.
- **Migrations in the deploy path** (AIS-43/44/45/46) and the AIS-14 milestone, which is due when AIS-178 closes — after this slice.
