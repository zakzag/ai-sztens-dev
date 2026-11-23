# AIS-178 / slice b — the `customers` API (repository, service, controller, audit)

**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Slice lettering:** this plan uses the audit's letters ([`2026-11-22--22-08-00-ais-14-completeness-audit.md`](../history/2026-11-22--22-08-00-ais-14-completeness-audit.md:1)):
**a** = contract (shipped in `c9754dc`), **b** = this plan (the API), **c** = the `api-client` service,
**d** = contacts + roles, **e** = tags + customer users, **f** = activities + audit-log read.
**Parent plan:** [`2026-11-22--18-50-00-ais-178-customers-api-plan.md`](./2026-11-22--18-50-00-ais-178-customers-api-plan.md:1) — its
"slice a" bundled contract + API + client; the contract part shipped alone, so the API is what remains.
**Suggested branch:** `AIS-178-customers-api`
**Commit titles:** `AIS-178: feat(api): add customers CRUD endpoints with audit`, then `AIS-178: feat(api-client): add the customers service`

---

## 0. Why this plan exists

The brief is "plan AIS-178/b". In the audit's lettering that is **the `apps/api` side of the six
`customers` operations slice a registered**, plus the contract corrections the implementation proves
necessary. Nothing else: no contacts, no tags, no activities, no UI.

One constraint shapes the whole slice. The AIS-110 gate compares the registry with the built client
services, and right now it is **red**:

```text
pnpm --filter @callback/api-client test service-coverage
→ customers.list / findById / create / update / updateStatus / remove: reason "missing-service"
```

Slice b cannot fix that (it ships no client service), so the rule for this work is:

> **b and c merge together** — two commits, one pull request. `main` is red today; it must not stay
> red after the API arrives. If b is merged alone, the red window simply continues.

---

## 1. Decisions

| # | Question | Decision |
| --- | --- | --- |
| D1 | What exactly is "slice b"? | The six registered `customers` operations in `apps/api` + the contract corrections they require. Transport-agnostic layers only in this commit; the client service is slice c in the same PR. |
| D2 | Who opens the transaction? | The **repository** exposes `runInTransaction<T>(work)`. The service composes "business row write → `AuditWriter.write`" inside it, so the service stays free of Drizzle (`db.transaction` would leak the ORM into the orchestration layer) and the audit row cannot land outside the business write (AIS-177 requires the `tx` handle). |
| D3 | `status` on `POST` | **Keep it.** [`createCustomerSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:262) already publishes `status` with `.default('prospect')`; removing a published field now would break the wizard contract (AIS-182) for no gain. The server still owns `statusChangedAt` and both timestamps. |
| D4 | `primaryContactName` | **Add** it to [`customerSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:109) as `z.string().nullable()` — the AIS-17 screen contract `D9` requires the list column and the schema has no such field today. Derived, never stored: a LATERAL on `contact_roles` (`role = 'primary'`) joined to live `contacts`. |
| D5 | `STALE_WRITE` on `DELETE` | **Remove it** from the `customers.remove` entry ([`customers.contract.ts`](../../packages/shared/src/contract/customers/customers.contract.ts:178)). `DELETE` carries no body, so there is no token to compare; `apiKeys.remove` documents `NOT_FOUND` only, and a soft delete loses no field value. |
| D6 | `customer_number` generation | `max()` of the month inside the write transaction, **retry once** on `23505`, and every attempt in a **fresh transaction** (a unique violation aborts the Postgres transaction, so an in-place retry is impossible). A `pg_advisory_xact_lock` per month removes collisions entirely — documented as the alternative, not built. |
| D7 | `PATCH` with no field (only `updatedAt`) | **Short-circuit**: no `UPDATE`, return the current row, **no audit row**. `updatedAt()` is `$onUpdate`, so an empty `UPDATE` would bump `updated_at` and produce a write that the writer legitimately refuses to audit — a phantom change. Rejecting it with `422` would need a new error code in the registry; the silent no-op is what the parent plan's test table already expects. |
| D8 | `:id` validation | A malformed uuid must not reach Postgres (`22P02` → `500`). Add `customerIdSchema = z.string().uuid()` to the contract and validate the param with the **existing** generic [`ZodValidationPipe`](../../apps/api/src/common/http/zod.pipe.ts:32) — no new pipe class, and the envelope answers `400 VALIDATION_FAILED`. |
| D9 | Audit facts | Only the four mutating handlers read the raw request: `@Req() req: AuditRequestLike` → `toAuditRequestFacts(req, ctx.requestId)`. That is exactly the seam AIS-177 `D7` designed, and it supersedes the "the controller never touches the raw request" sentence in the [`ReqCtx`](../../apps/api/src/common/http/request-context.decorator.ts:50) docblock — amend that one sentence in this slice so the comment stays true. |
| D10 | New error codes / admin copy | **None.** `CUSTOMER_NUMBER_CONFLICT` and `CUSTOMER_TAX_NUMBER_CONFLICT` already exist with their Hungarian copy ([`error-message.const.ts`](../../apps/admin/src/lib/error-message.const.ts:55)), so the admin parity test stays green without touching `apps/admin`. |

---

## 2. Pre-flight findings

| # | Finding | Consequence |
| --- | --- | --- |
| F1 | [`CUSTOMERS_PATH`](../../packages/shared/src/contract/customers/customers.const.ts:24) is `/api/admin/customers`, but a Nest controller path is **relative to the global `api` prefix** (`api-keys` uses `API_KEYS_ROUTE = 'api-keys'` for the registry's `/api/api-keys`) | New `CUSTOMERS_ROUTE = 'admin/customers'` in `apps/api/src/customers/customers.const.ts`. The registry stays untouched. |
| F2 | The envelope-contract e2e ([`envelope-contract.e2e-spec.ts`](../../apps/api/test/envelope-contract.e2e-spec.ts:85)) fails on any mounted enveloped route that is not registered with the **same verb and path** | The controller is the safety net of the contract: once `CustomersModule` is in `AppModule`, the six registry entries are proven to exist at runtime. A path typo fails CI, not production. |
| F3 | [`customers.remove`](../../packages/shared/src/contract/customers/customers.contract.ts:178) documents `STALE_WRITE` without a request body that could carry the token | See `D5`; fix the entry in this slice. |
| F4 | [`customerSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:109) has no `primaryContactName`, and `customerDetailSchema` has no `primaryContactName` either | See `D4`; the field must be added to the base schema so list **and** detail carry it (detail derives it from its contact list, not from a second query). |
| F5 | `customers.updated_at` is `$onUpdate`, i.e. Drizzle bumps it on every write ([`schema.ts`](../../apps/api/src/db/schema.ts:144)); `AUDIT_DIFF_IGNORED_KEYS` already drops it ([`audit.const.ts`](../../apps/api/src/audit/audit.const.ts:53)) | The stale-write guard works exactly like `api-keys`; the audit diff never reports `updated_at`. Empty PATCH follows `D7`. |
| F6 | `customers_customer_number_key` is a **plain** unique constraint, `customers_tax_number_key` is a **partial** unique index (`WHERE tax_number IS NOT NULL AND deleted_at IS NULL`) | `23505` must be classified by **constraint name**, never by a pre-check; a soft-deleted customer frees its tax number (and the e2e proves it). |
| F7 | `contacts` carries `deleted_at`, `contact_roles` does **not** (AIS-18 rule) | `findById` must filter `contacts.deleted_at IS NULL`; slice d owns "delete the role rows when a contact is soft-deleted". `primaryContactName` must join a live contact only. |
| F8 | `activities` exists (AIS-177) but nothing writes it yet | `lastActivityAt` is `null` for every customer until slice f. The projection must still be SQL, not a stub, or slice f would have to rewrite the list query. |
| F9 | `AUDIT_TABLE_NAMES` already lists `customers` ([`audit.const.ts`](../../apps/api/src/audit/audit.const.ts:33)) | No audit-module change is needed; the writer accepts the payload as-is. |
| F10 | `audit.audit_logs` is **append-only** (trigger, migration `0007`) | The e2e writes real, permanent ledger rows. It cleans up business rows in `afterAll` and tags its ledger rows with a fixed user agent; purging them needs a superuser session (`session_replication_role = replica`), which is documented, not automated. |
| F11 | `AppModule` imports only `ApiKeysModule` + `VapiWebhooksModule`; `AuditModule` is not in the graph | Importing `CustomersModule` also makes `AUDIT_WRITER` resolvable, which is what makes the audit assertions real rather than mocked. |
| F12 | The list contract's sort allow-list includes `lastActivityAt` ([`customers.const.ts`](../../packages/shared/src/contract/customers/customers.const.ts:130)), which is not a column | The sort map is `Record<CustomerSortField, SQL \| PgColumn>`; `lastActivityAt` sorts on the LATERAL alias with `NULLS LAST`, so no customer without activities sinks or floats arbitrarily. |

---

## 3. Deliverables

### 3.1 New feature folder — `apps/api/src/customers/`

| File | Content |
| --- | --- |
| `customers.const.ts` | `CUSTOMERS_REPOSITORY` DI token, `CUSTOMERS_ROUTE = 'admin/customers'`, the two constraint names, `PG_UNIQUE_VIOLATION_CODE` reuse, sort map (7 fields incl. the derived one), `CREATE_ATTEMPTS = 2` |
| `customers.interface.ts` | `CustomerPatch`, `CustomerListRow` (row + `lastActivityAt` + `primaryContactName`), `CustomerDetailRows` (parent + tags + contacts + roles + users) |
| `customers.logic.ts` | pure: `toCustomerNumberPrefix(now)` (`AIS-YYYYMM-`), `toNextCustomerNumber(prefix, currentMax)`, `hasMissingData(row)`, `toStatusPatch(status, now)` |
| `customers.mapper.ts` | row → `Customer` / `CustomerDetail`; `toNewCustomerRow`; `toCustomerPatch`; `toContactsWithRoles(contacts, roles)` — all pure, all `Date` → ISO |
| `customers.errors.ts` | `CustomerNumberConflictError`, `CustomerTaxNumberConflictError`, `CustomerRowMissingError` (no Nest import) |
| `customers.error-guard.ts` | `isCustomerNumberConflict`, `isCustomerTaxNumberConflict` (23505 + constraint name, cause-chain walk) |
| `customers.filter.ts` | `customerVisibleFilter(query)` — `deleted_at IS NULL` **and** `q` (legalName / taxNumber / customerNumber ILIKE) and the three equality filters; one function for the page query **and** the count |
| `customers.repository.interface.ts` | `findPage`, `findById`, `findAnyById`, `create(tx)`, `updateById(tx)`, `updateStatusById(tx)`, `softDeleteById(tx)`, `nextCustomerNumber(tx)`, `runInTransaction` |
| `customers.repository.ts` | the only file that builds SQL: page + count in one `Promise.all`, the two LATERAL projections, the detail's three child reads, the guarded writes |
| `customers.service.interface.ts` / `customers.service.ts` | orchestration: one transaction per write, row write → `AuditWriter.write`, error translation to `AppError`, `STALE_WRITE` classification via `findAnyById`, `customer_number` retry loop |
| `customers.controller.ts` | six routes, `ZodQueryPipe` / `ZodBodyPipe` / `ZodValidationPipe(customerIdSchema)`, `responses.ok(...)`, `@ReqCtx()` + raw `@Req()` for the mutating four |
| `customers.module.ts` | imports `DatabaseModule`, `HttpModule`, `AuditModule`; binds `CUSTOMERS_REPOSITORY` |
| `test/mocks/customers.mock.ts`, `test/mocks/database.mock.ts` | row fixtures, repository mock, writer mock, actor provider mock (no mocks inline in spec files) |
| `customers.*.spec.ts` | one spec per unit (see §6) |

### 3.2 New shared helper — `apps/api/src/db/postgres-error.logic.ts`

A pure `findPostgresError(error, { code, constraintName })` that walks the `cause` chain (Drizzle
wraps `postgres.js` errors). `customers.error-guard.ts` uses it; `api-keys.api-error-guard.ts` is
**not** refactored in this slice (an unrelated diff in a shipped feature), recorded as a follow-up.

### 3.3 Modified files

| File | Change |
| --- | --- |
| `packages/shared/src/contract/customers/customers.schema.ts` | `customerIdSchema`; `primaryContactName` on `customerSchema` |
| `packages/shared/src/contract/customers/customers.fixture.ts` | the new field in `VALID_CUSTOMER` / `VALID_CUSTOMER_DETAIL` / `VALID_CUSTOMER_LIST` |
| `packages/shared/src/contract/customers/customers.contract.ts` | `remove.errors` without `STALE_WRITE`; list/detail examples carry `primaryContactName` |
| `apps/api/src/app.module.ts` | import `CustomersModule` |
| `apps/api/src/common/http/request-context.decorator.ts` | one amended sentence (`D9`) |
| `docs/Specs/API-Convention.md` | new subsection: the `customers` endpoints, the two `409` codes, the `admin` audience; header date bumped |
| `docs/history/<ts>-ais-178-b-customers-api.md` | change summary with the measured evidence |
| `apps/api/test/customers.e2e-spec.ts` | new suite (§6) |

**Not touched:** `apps/admin` (no new error code), `infra/postgres/init/*` (no schema change),
`apps/api/drizzle/*` (no migration — the columns exist since AIS-18), `packages/api-client` (slice c).

---

## 4. Routes (must match the registry exactly)

Controller base: `@Controller(CUSTOMERS_ROUTE)` → `/api/admin/customers` under the global `api` prefix.

| operationId | verb | handler path | validation | success | audit |
| --- | --- | --- | --- | --- | --- |
| `customers.list` | GET | — | `ZodQueryPipe(customerListQuerySchema)` | `200` + `meta.pagination` | — |
| `customers.findById` | GET | `:id` | `ZodValidationPipe(customerIdSchema)` | `200` (detail) | — |
| `customers.create` | POST | — | `ZodBodyPipe(createCustomerSchema)` | `201` | `insert` |
| `customers.update` | PATCH | `:id` | param + `ZodBodyPipe(updateCustomerSchema)` | `200` | `update` |
| `customers.updateStatus` | PATCH | `:id/status` | param + `ZodBodyPipe(updateCustomerStatusSchema)` | `200` | `update` |
| `customers.remove` | DELETE | `:id` | param | `200`, `data: null` | `soft_delete` |

`DELETE` answers `200` with a null payload, never `204`: the envelope must keep `meta.requestId`
(`noPayloadSchema` is the same choice `api-keys` made).

---

## 5. Behaviour that must hold

1. `list`: `deleted_at IS NULL`, every filter applied server-side, stable order (`sort` column, `id`
   tie-breaker), `meta.pagination` from the shared `toPaginationMeta`.
2. `list`: `lastActivityAt`, `hasMissingData`, `primaryContactName` are **derived** — no column, no
   second query per row.
3. `findById`: parent + tags + live contacts with their roles + customer users, in **one** method and
   at most four round trips; a soft-deleted or unknown id is `404` (never `409`, never `500`).
4. `create`: `customer_number` and `statusChangedAt`/`createdAt`/`updatedAt` are server values; the
   body's `status` (default `prospect`) is honoured; the response is `201` with the stored row.
5. `create`: exactly **one** `audit_logs` row, `table_name = 'customers'`, `record_id` and
   `customer_id` = the new id, written on the same transaction.
6. `create` under contention: a `23505` on `customers_customer_number_key` retries **once in a fresh
   transaction**; a second failure is a `409 CUSTOMER_NUMBER_CONFLICT`.
7. `update`: `updatedAt` is required and never written; a mismatch is `409 STALE_WRITE`; a duplicate
   tax number is `409 CUSTOMER_TAX_NUMBER_CONFLICT` with `details[0].path = 'taxNumber'`.
8. `update` with no field: `200` with the current row, nothing written, **no** audit row (`D7`).
9. `updateStatus`: `status` **and** `status_changed_at` in one statement, guarded by `updatedAt`; the
   audit row carries only the changed keys.
10. `remove`: one `UPDATE … SET deleted_at = now()`; a repeat is `404`; the row keeps its data and
    frees its tax number; `activities` are untouched (only a hard delete cascades).
11. Every failure is an `AppError` subclass; a `23505` from any **other** constraint stays a `500` and
    is never reported as a business conflict.

---

## 6. Tests

| Suite | Coverage |
| --- | --- |
| `postgres-error.logic.spec.ts` | direct error, wrapped `cause`, `constraint` vs `constraint_name`, wrong code, wrong constraint, non-object, self-referencing `cause` |
| `customers.error-guard.spec.ts` | both guards; the cross case (number conflict is not a tax conflict) |
| `customers.logic.spec.ts` | month prefix (Dec → Jan rollover via an injected `now`), `001` on an empty month, `999` edge (next number would overflow → explicit error), `hasMissingData` branches, status patch |
| `customers.mapper.spec.ts` | every field, `Date` → ISO, `null` vs `undefined` on the patch, `primaryContactName` null/derived, tags/contacts/roles/users grouping, an empty role list |
| `customers.repository.spec.ts` | mocked `Database`: the `WHERE` of page and count is the same expression, `deleted_at IS NULL` everywhere, `q` matches three columns, sort + `id` tie-breaker, `lastActivityAt` sort with `NULLS LAST`, `nextCustomerNumber` SQL and empty-month case, constraint → domain error, `runInTransaction` passes the handle |
| `customers.service.spec.ts` | one audit row per write, **same** transaction handle, no audit on empty patch (`D7`), retry-once on a number collision then success, second collision → `409`, `STALE_WRITE` vs `404` classification, `409` mapping of both codes, unknown error re-thrown |
| `customers.controller.spec.ts` | envelope payloads, `201` on create, `data: null` on delete, query/bodies passed to the service as the pipes produced them, audit facts built from the request |
| `customers.module.spec.ts` | DI graph: `CUSTOMERS_REPOSITORY` and `AUDIT_WRITER` resolve |
| `apps/api/test/customers.e2e-spec.ts` | real Postgres (DB gate, loud skip): create → list (`q` + each filter) → detail → patch → status → soft delete → `404`; duplicate tax number `409`; stale `409`; **one** audit row per mutation (counted in `audit.audit_logs` by `record_id`); tax number reusable after the soft delete; `400` on a malformed uuid; pagination meta |
| gates | `envelope-contract` (routes match the registry), `openapi` (registry-driven, must not drift) |

E2E hygiene (F10): unique fixture names, business rows deleted in `afterAll`, ledger rows kept and
tagged via a fixed `user-agent`; the suite must never `DELETE` from `audit.audit_logs` (the trigger
would fail the run, which is the append-only rule doing its job).

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Route path drifts from the registry | The envelope-contract e2e fails on verb+path; run it before pushing. |
| Audit row lands outside the business transaction | `AuditWriter.write` **requires** the `tx` handle; passing the root `Database` does not type-check. |
| Retry loop hides a real `23505` | Only `customers_customer_number_key` with SQLSTATE `23505` is retried, once. |
| `primaryContactName` costs one join per row | LATERAL with `LIMIT 1` on a partial unique index (`contact_roles_primary_key`) — at most one row, indexed by `customer_id`. |
| The e2e pollutes the ledger forever | Documented; tagged user agent; purge recipe in `Database-Local.md` needs a superuser session. |
| The client gate stays red | b and c merge together (`§0`). |
| A `400` instead of `404` for a malformed uuid surprises the UI | Documented in `API-Convention.md`; the admin links carry real ids, and the fallback `404` for a well-formed unknown id is unchanged. |

---

## 8. Verification

```text
shared:  pnpm --filter @callback/shared test
api:     pnpm --filter @callback/api test
         pnpm --filter @callback/api lint
         pnpm --filter @callback/api typecheck
         pnpm --filter @callback/api db:check
client:  pnpm --filter @callback/api-client test        # still red until slice c lands
admin:   pnpm --filter @callback/admin test             # error-copy parity
e2e:     pnpm --filter @callback/api test:e2e            # DATABASE_URL + db:up
docs:    pnpm quality
all:     pnpm typecheck && pnpm build && pnpm test
```

Definition of done for slice b:

- [ ] The six routes are mounted and the `envelope-contract` + `openapi` e2e suites are green.
- [ ] Every write produces exactly one audit row, on the caller's transaction, with the changed keys only.
- [ ] `customers.update` / `updateStatus` answer `409 STALE_WRITE` on a stale token; `remove` answers `404` on a repeat.
- [ ] Both `409` codes are raised from **constraint names**, and the e2e proves all four declared cases (duplicate number, duplicate tax number, stale write, unknown id).
- [ ] `primaryContactName` is on the wire for list and detail, and the shared fixture matches.
- [ ] `pnpm --filter @callback/api test`, `lint`, `typecheck`, `db:check` green; `pnpm quality` green.
- [ ] `docs/Specs/API-Convention.md` updated in the same change; history entry written.

---

## 9. Out of scope

- **Slice c** — `packages/api-client/src/customers/` (service, interface, path, const) + the
  `service.registry.ts` line. Same PR, second commit; it is the only thing that turns the AIS-110 gate green.
- **Slice d** — contacts + roles CRUD, including the AIS-18 rule that a contact soft delete removes
  its `contact_roles` rows and `CUSTOMER_PRIMARY_CONTACT_CONFLICT`.
- **Slice e** — tags, customer users, the invite flow, `CUSTOMER_OWNER_CONFLICT`.
- **Slice f** — activities, `GET /:id/audit-logs`, the create → list → detail → activity → audit e2e chain.
- Admin authentication (AIS-73/74) — the actor stays `system`; the ledger rows of this period are not
  backfillable (AIS-177 `D6`).
- Migrations in the deploy path (AIS-43/44/45/46) and the AIS-14 milestone, which is due after AIS-178 closes.
