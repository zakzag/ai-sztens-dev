# Remove the customer responsible-operator concept — implementation plan

**Date:** 2026-11-24 02:41 (Europe/Budapest) · **Branch:** `AIS-14-company-admin` (before its merge)
**Trigger:** product decision — "we do not need a company responsible operator now"
**Scope:** full removal — DB column + FK, shared contract field + query parameter, API mapper/filter, api-client docs/tests, every living spec

---

## 1. Why remove it instead of hiding it

The concept was introduced with the AIS-14/AIS-16 data layer: one optional `iam.operators`
reference per customer ("who owns the relationship"). AIS-19's screen contract then asked for a
filter on it, and the AIS-15 wave plan **deferred** that filter (`D-W2`) because no operator-directory
operation exists to fill the `Combobox`.

A dormant field is worse than no field: it keeps a ledger of a relationship nobody maintains, it
costs a join in every list query path that might use it, and every future reader has to decide
again whether it matters. The branch has not been merged, the feature has never been live, and no
row carries a value, so removal is cheap **now** and progressively more expensive after the merge.

## 2. What stays

The word "operator" appears in three unrelated places that must **not** be touched:

| Kept | Why |
| --- | --- |
| `activity.activities.operator_id` + `authorType` | the **author** of a note, not an owner |
| `audit.audit_logs.operator_id` / `actorId` | the audit actor |
| `iam.customer_users.invited_by_operator_id` | who invited a login user |

## 3. Decisions

| # | Decision | Reason |
| --- | --- | --- |
| **D1** | Remove the DB column **and** its FK with a new forward migration (`0008`), never by editing `0005` | `0005` has already run in migrated environments; rewriting it would silently desync them |
| **D2** | Remove the field from `customerSchema`, `createCustomerSchema` and `updateCustomerSchema` | the request schemas are `.strict()`: dropping the field turns a stale payload into a clear `400` instead of a silent no-op |
| **D3** | Remove `responsibleOperatorId` from `customerListQuerySchema` and drop `CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER` (+ its export and its entry in `CUSTOMER_LIST_QUERY_PARAMETERS`) | an OpenAPI parameter that no screen can fill is a lie in the published contract |
| **D4** | An old link with `?responsibleOperatorId=…` is **ignored**, not rejected | zod strips unknown keys, so a bookmark keeps working with the filter simply absent; this behaviour gets its own unit test |
| **D5** | Do it on the unmerged AIS-14 branch | the contract and the schema live in files that branch introduced; `main` never sees the field |
| **D6** | `docs/Specs/Database-Schema.md` is **regenerated** (`pnpm db:diagram`), not edited | it is generated output; the generator's own tests guard its shape |

## 4. Order of work (each step gated by the next)

```text
1  packages/shared      list-query, schema, fixture, index export, helper doc
2  packages/shared test customer-list-query, list-query.helper
3  apps/api             db/schema, interface, mapper, filter
4  apps/api test+mock   schema.spec, mapper.spec, repository.spec, customers.mock
5  drizzle             db:generate -> 0008 (DROP CONSTRAINT + DROP COLUMN)
6  packages/api-client  service/interface docs, service test URL assertion
7  scripts/db          schema-model fixture: 11 -> 10 relationships
8  docs/Specs          regenerate Database-Schema, fix Database-Local, API-Convention,
                       Customers-Admin-Screens, UI-Architecture §5, New-Admin-Page §2
9  gates               build, typecheck, lint, test, quality, gate fixtures, db:diagram:check
```

Contract first, because `packages/shared/dist` types are consumed by both the API and the client:
touching the API first would compile against a stale contract.

## 5. Verification

```bash
pnpm -r build
pnpm typecheck
pnpm lint
pnpm test
pnpm quality
node --test scripts/quality scripts/db scripts/lib/vite-build.logic.test.mjs
pnpm db:diagram:check
```

Manual DB check after applying the migration:

```sql
\d customer.customers   -- no responsible_operator_id, no customers_responsible_operator_id_operators_id_fk
```

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Losing real data | the feature never shipped; verify `SELECT count(*) … WHERE responsible_operator_id IS NOT NULL` before applying on any environment that has rows |
| A stale client still sending the field | `.strict()` → `400` with the standard validation envelope; no silent write |
| `db/schema.spec.ts` "single foreign key" test | the table now has **zero** FKs; the assertion becomes "references no other table" |
| The schema-diagram regression guard hardcodes 11 relationships | it is a fixture whose purpose is to fail exactly here — updated to 10 with a comment |
| A reader thinks the author `operatorId` was also removed | every spec edit names the distinction (§2 above) |
