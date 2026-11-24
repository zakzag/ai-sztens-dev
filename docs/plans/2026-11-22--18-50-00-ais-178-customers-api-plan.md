# AIS-178 — `customers` API: implementation plan (slice `/a` first)

**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Depends on:** AIS-16 (contract) ✅, AIS-18 (`customer` + `iam` schemas) ✅, AIS-177 (`activity` + `audit` + `AuditWriter`) ✅
**Consumed by:** AIS-19 (list), AIS-20 (detail), AIS-21 (edit), AIS-179 (contacts/users tabs), AIS-181 (activity/audit tabs), AIS-182 (wizard)
**Screen contract:** [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md)
**Commit title (slice a):** `AIS-178: feat(api): add customers CRUD endpoints with audit`

---

## 0. Why three slices

The ticket is ~22 endpoints across six resources. The contract gates force one rule: **a registry
entry, its `api-client` service and its controller must land in the same commit** (otherwise
`service-coverage`, `endpoint-registry` and the envelope-contract e2e all fail). The split is
therefore **per resource**, not per layer:

| Slice | Resources | Unblocks |
| --- | --- | --- |
| **a** (this plan) | `customers`: `list`, `findById`, `create`, `update`, `updateStatus`, `remove` | AIS-19, AIS-20, AIS-21 |
| b | `contacts`, `tags` | AIS-179 |
| c | `activities`, `audit-logs` (read), `customer users` (invite) | AIS-181 |

---

## 1. Decisions (closed)

| # | Question | Decision |
| --- | --- | --- |
| A | Admin authentication before AIS-178? | **No.** The application runs on the developer's machine only. The `/api/admin/*` routes stay unauthenticated, the risk is recorded in [`API-Convention.md`](../Specs/API-Convention.md) §7.1, and AIS-73/74 plus a Caddy allow-list are a **hard** requirement before any public deployment. |
| B | Who is the audit actor? | `system` until the session exists. `AuditActorProvider` is the single seam: the auth story replaces one class and re-binds `AUDIT_ACTOR_PROVIDER`. Because `audit.audit_logs` is append-only, this period is **not backfillable** — the same note as A. |
| C | Migrations in the deploy path (AIS-43/44/45/46)? | Deferred, consistent with A: local runs use `pnpm --filter @callback/api db:migrate`. Must be closed before the first public deploy. |
| D | How is `customer_number` generated? | `AIS-YYYYMM-NNN` by reading `max(customer_number)` for the current month **inside the write transaction**, then retrying once on `23505`. No counter table: AIS-18 shipped seven tables and no `number_counters`, and an extra table would need an eighth migration for a value that a `max()` answers correctly under the retry. |
| E | Is there a `customers.contract.ts`? | Not yet — that is the first artefact of slice a. |
| F | `primaryContactName` | Derived list projection (AIS-17 `D9`), not a column: the `primary` row of `contact_roles` joined back to `contacts.name`. Same "derived, never stored" family as `lastActivityAt` and `hasMissingData`. |
| G | `status` in the general `PATCH`? | No. `updateStatus` is its own operation (`PATCH /:id/status`) and owns `status_changed_at` (AIS-16 `D2`, AIS-17 `D15`). |

---

## 2. Pre-flight findings

| # | Finding | Consequence |
| --- | --- | --- |
| F1 | [`customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:1) already carries `customerSchema`, `customerDetailSchema`, `createCustomerSchema`, `updateCustomerSchema` and the fixture; [`customers.list-query.ts`](../../packages/shared/src/contract/customers/customers.list-query.ts:1) carries the four filters | No new Zod schema is needed for slice a — only the registry file and the error codes |
| F2 | The admin parity test asserts that the admin error copy covers exactly the shared code set | Every new `API_ERROR_CODE` lands with its Hungarian copy in `apps/admin/src/lib/api-error-code.const.ts` + `error-message.const.ts`, in the same commit |
| F3 | `db:generate` is not needed for slice a | `lastActivityAt` / `hasMissingData` / `primaryContactName` are query projections, not columns |
| F4 | The `customers` table has `deleted_at`, and `customers_tax_number_key` is a **partial** unique index (`WHERE deleted_at IS NULL`) | A soft-deleted customer frees its tax number; the `409` mapping must therefore come from the constraint name, never from a pre-check |
| F5 | `AuditWriter.write` requires the caller's transaction handle | Every mutating service method is `db.transaction(tx => …)`; the controller passes `toAuditRequestFacts(req, ctx.requestId)` |
| F6 | `activities` FKs are `NO ACTION` on the author columns and `CASCADE` on the customer | A customer soft delete never touches `activities`; a hard delete would, but there is no hard delete |

---

## 3. Slice a — deliverables

| File | Content |
| --- | --- |
| `packages/shared/src/contract/customers/customers.contract.ts` | six `ApiEndpointContract` entries (`customers.list/findById/create/update/updateStatus/remove`), `admin` audience, errors from the catalogue |
| `packages/shared/src/contract/error-code.const.ts` (+ status map) | `CUSTOMER_NUMBER_CONFLICT`, `CUSTOMER_TAX_NUMBER_CONFLICT` → `409` (contacts/tags codes arrive in slice b) |
| `apps/admin/src/lib/api-error-code.const.ts`, `error-message.const.ts` | the Hungarian copy of the two codes |
| `apps/api/src/customers/customers.const.ts` | DI token, route segment, constraint names, sort-column map, counter prefix |
| `customers.errors.ts`, `customers.error-guard.ts` | `CustomerNumberConflictError`, `CustomerTaxNumberConflictError`, `CustomerNotFoundError`, `CustomerRowMissingError`; `23505` + constraint name → domain error |
| `customers.filter.ts` | `customerNotDeletedFilter(q, filters)` — one expression shared by the page query and the count |
| `customers.logic.ts` | pure: paging arithmetic, `hasMissingData`, month prefix, `toStatusPatch` (status → `status_changed_at`) |
| `customers.mapper.ts` | row → contract (`Date` → ISO), including the three derived fields |
| `customers.repository.interface.ts` / `.repository.ts` | `findPage` (lateral `max(activities.created_at)`, `primaryContactName`, `hasMissingData`), `findById` (with children), `create`, `update`, `updateStatus`, `softDelete`, `nextCustomerNumber` |
| `customers.service.interface.ts` / `.service.ts` | orchestration + **one transaction per write**: row write → `AuditWriter.write`; `STALE_WRITE` on an `updatedAt` mismatch |
| `customers.controller.ts` | six routes, `ZodBodyPipe` / `ZodQueryPipe`, `responses.ok(...)`, `@ReqCtx()` and `@Req()` for the audit facts |
| `customers.module.ts` | imports `DatabaseModule` + `AuditModule`; binds `CUSTOMERS_REPOSITORY` |
| `packages/api-client/src/customers/` | `customers.const.ts`, `.interface.ts`, `.service.ts` via `clientPathOf`, plus the `service.registry.ts` line |

### Behaviour that must hold

1. `list` returns `meta.pagination` and honours `q` + `type` + `status` + `source` + `responsibleOperatorId`, all applied server-side.
2. `create` stores `status`/`statusChangedAt` from the server, never from the body (`createCustomerSchema` is `.strict()`).
3. `update` requires `updatedAt`; a mismatch is `409 STALE_WRITE` and changes nothing.
4. `updateStatus` writes the status **and** `status_changed_at` in one statement.
5. `remove` is a soft delete: the row keeps its data, disappears from every read, and frees its tax number.
6. Every one of the four mutating operations writes **exactly one** `audit_logs` row, on the caller's transaction, with `table_name = 'customers'` and the changed keys only.

---

## 4. Tests

| Suite | Coverage |
| --- | --- |
| `customers.logic.spec.ts` | paging arithmetic, month prefix + format, `hasMissingData` branches, status patch |
| `customers.mapper.spec.ts` | every field, `Date` → ISO, `null` handling, the three derived fields |
| `customers.repository.spec.ts` | mocked `Database`: the list SQL shape (filters, sort + `id` tie-breaker, `deleted_at IS NULL`), `nextCustomerNumber` (empty month → `001`), constraint → domain error |
| `customers.service.spec.ts` | one audit row per write, same transaction handle, no audit row for a no-op update, `STALE_WRITE`, `404` on a soft-deleted row |
| `customers.controller.spec.ts` | envelope payloads, `409`/`404` mapping, query parsing |
| `packages/api-client/test/customers.service.test.ts` | success + error for each of the six methods |
| `apps/api/test/customers.e2e-spec.ts` | real Postgres (database gate, every test rolls back): create → list (`q` + filters) → detail → patch → status → soft delete; duplicate tax number `409`; `STALE_WRITE` `409`; `404` after delete; **one** audit row per mutation |

---

## 5. Verification

```text
shared:  pnpm --filter @callback/shared test
client:  pnpm --filter @callback/api-client test
api:     pnpm --filter @callback/api test
         pnpm --filter @callback/api lint
         pnpm --filter @callback/api db:check
admin:   pnpm --filter @callback/admin test        # error-copy parity
all:     pnpm quality && pnpm test
e2e:     DATABASE_URL=… pnpm --filter @callback/api test:e2e
```

---

## 6. Follow-ups (not in slice a)

- Slice b: `contacts` (with the AIS-18 rule — a contact soft delete removes its `contact_roles` rows), `tags`, `CUSTOMER_PRIMARY_CONTACT_CONFLICT`.
- Slice c: `activities`, `audit-logs` read (the ledger already grants `SELECT`), `customer users` invite.
- `CUSTOMER_OWNER_CONFLICT` belongs to the customer-users slice (one active owner), not to slice a.
- AIS-73/74 + Caddy allow-list before any public deployment (decisions A and B).
- AIS-44/45/46 before the first deploy that carries `0005`–`0008` (decision C).
