# The customer responsible operator no longer exists — column, contract, filter, docs

**Date:** 2026-11-24 02:41 (Europe/Budapest) · **Ticket:** AIS-189 · **Branch:** `AIS-14-company-admin`
**Type:** breaking contract + schema change — the field is gone everywhere, not deprecated
**Plan:** [`2026-11-24--02-41-00-remove-customer-responsible-operator-plan.md`](../plans/2026-11-24--02-41-00-remove-customer-responsible-operator-plan.md:1)

## What was asked

After the AIS-17 wave delta marked the responsible-operator **filter** as deferred (`D-W2`), the
product decision was simpler than the plan assumed: *the company does not need a responsible
operator at all*. This change removes the concept rather than parking it.

## What was removed, layer by layer

| Layer | File | Change |
| --- | --- | --- |
| DB schema | [`schema.ts`](../../apps/api/src/db/schema.ts:468) | the `responsible_operator_id` uuid column and its `iam.operators` reference |
| Migration | [`0008_fine_vulture.sql`](../../apps/api/drizzle/0008_fine_vulture.sql:1) | `DROP CONSTRAINT customers_responsible_operator_id_operators_id_fk` then `DROP COLUMN responsible_operator_id` |
| Contract (read) | [`customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:181) | field removed from `customerSchema` |
| Contract (write) | same | removed from `createCustomerSchema` and `updateCustomerSchema` — both `.strict()`, so a stale payload is now a `400` |
| Contract (list) | [`customers.list-query.ts`](../../packages/shared/src/contract/customers/customers.list-query.ts:55) | the filter field, `CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER`, its array entry and its `index.ts` export |
| Fixtures | [`customers.fixture.ts`](../../packages/shared/src/contract/customers/customers.fixture.ts:44) | both sample customers |
| API | `customers.mapper.ts`, `customers.filter.ts`, `customers.interface.ts` | row/list/detail mapping, insert row, patch builder, `WHERE` condition, input type |
| api-client | `customers.service.ts`, `customers.interface.ts` | doc comments now name three filters |
| Specs | `Database-Schema.md` (regenerated), `Database-Local.md`, `API-Convention.md`, `Customers-Admin-Screens.md`, `UI-Architecture.md` §5, `New-Admin-Page.md` §2 | column/FK rows, the `SET NULL` sentence, a new §4.1 changelog entry, the URL table, the filter row, the state-plan row, the checklist sentence |

Deliberately **kept**: the *author* `operatorId` on activities and audit rows, and
`customer_users.invited_by_operator_id`. Those are authorship, not ownership.

## Three behaviours worth knowing

1. **A stale link does not break.** `customerListQuerySchema` strips unknown keys, so
   `?responsibleOperatorId=<uuid>` is now simply ignored instead of answered with a `400`. The new
   unit test `strips the retired responsibleOperatorId filter instead of validating it` pins this,
   because "an old bookmark keeps working" is a decision, not an accident.
2. **`customer.customers` has no foreign keys any more.** The removed reference was the only one, so
   the `db/schema.spec.ts` assertion changed meaning: it now asserts **zero** foreign keys, which is
   what stops one from silently growing back.
3. **A hardcoded fixture failed first, as designed.** `schema-model.logic.test.mjs` guards the real
   schema parse and listed 11 relationships including the dropped FK; it was updated to 10 with a
   comment naming the migration.

## Verification (run in this session, all green)

```text
pnpm -r build                                        -> all packages + both SPAs
pnpm typecheck                                       -> all packages
pnpm lint                                            -> all packages
pnpm test                                            -> shared 403, api 1009 (77 suites), ui/admin/client/notifications
pnpm quality                                         -> layers, knip, palette, themes, field-errors, docs: 0 violations
node --test scripts/quality scripts/db scripts/lib/vite-build.logic.test.mjs -> 124 pass / 0 fail
pnpm db:diagram:check                                -> Database-Schema.md is up to date
```

The migration has **not** been applied to a running database in this session; applying it is part of
the deploy step, and the safe pre-check is recorded in the plan §6.

## Follow-ups

- **Jira:** the change belongs to the AIS-16 contract family; the follow-up ticket for the
  operator-directory endpoint (`Q-1` of the wave plan) is now **moot** — there is nothing left to
  filter, so it should be closed instead of implemented.
- If a responsible-operator notion returns later, it comes back as a new contract change (AIS-16
  family), not as a resurrected column: the removal is recorded in the migration history.
- The removal is tracked as **AIS-189** (created right after the commit). The commit subject carries the
  branch-derived `AIS-14` key, so the PR/squash-merge title must carry `AIS-189` to keep the
  ticket–commit link alive on `main`.
