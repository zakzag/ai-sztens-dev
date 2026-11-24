# Milestone — the customer responsible operator was removed, not deferred

**Date:** 2026-11-24 · **Branch:** `AIS-14-company-admin` · **Plan:** [`2026-11-24--02-41-00-remove-customer-responsible-operator-plan.md`](../plans/2026-11-24--02-41-00-remove-customer-responsible-operator-plan.md:1)

## 1. Problem / feature

The customer record carried one optional staff reference, `responsible_operator_id` → `iam.operators`,
meant to name the colleague who owns the relationship. The admin screen contract asked for a list
filter on it, and the AIS-15 wave plan deferred that filter (`D-W2`) because no operator-directory
operation exists to populate a picker. The product then decided the field itself is unnecessary.

Deferral was the wrong end state: a nullable ownership column that no screen can set and no screen
can filter is a ledger nobody maintains, and it keeps an operator join reachable from every list
query path.

## 2. Measured data / evidence

| Check | Result |
| --- | --- |
| Consumers of the field in shipped code | 0 UI surfaces, 0 write paths in any app; only contract, API mapper/filter and fixtures |
| Populated rows | none — the feature never shipped, so no environment holds a value |
| Schema before / after | `customer.customers` 22 → 21 columns, 1 → 0 foreign keys |
| Diagram model before / after | 11 → 10 relationships |
| API surface | the list keeps `type`, `status`, `source`; the OpenAPI parameter count drops by one |

## 3. Root cause / design rationale

The field was created speculatively, in the AIS-14 data layer, before any screen consumed it. Once
the screen contract turned its filter into a deferred item, the column survived with no producer and
no consumer — the classic shape of a speculative field that becomes permanent by inertia.

Two alternatives were considered:

| Option | Why it lost |
| --- | --- |
| Keep the column, hide the filter | keeps dead ownership data and its join; a future reader must re-decide whether it matters |
| Keep the column, add the operator directory | builds an endpoint and a picker for a relationship the product does not want |

The removal also removes a blocker: with the field gone, there is nothing for a future
responsible-operator concept to inherit, so it can be designed fresh if it ever returns.

**What was deliberately not removed:** the author references — `activity.activities.operator_id`,
`audit.audit_logs.operator_id` and `iam.customer_users.invited_by_operator_id`. Authorship is a
different relationship and stays.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `packages/shared/src/contract/customers/customers.list-query.ts` | filter field, `CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER`, its entry in `CUSTOMER_LIST_QUERY_PARAMETERS`, docs |
| `packages/shared/src/contract/customers/customers.schema.ts` | field removed from the read, create and update schemas |
| `packages/shared/src/contract/customers/customers.fixture.ts` | both sample customers |
| `packages/shared/src/index.ts`, `contract/list-query.helper.ts` | export and doc comment |
| `apps/api/src/db/schema.ts` | column and its `ON DELETE set null` reference |
| `apps/api/drizzle/0008_fine_vulture.sql` | `DROP CONSTRAINT` + `DROP COLUMN` |
| `apps/api/src/customers/customers.{mapper,filter,interface}.ts` | list/detail/insert/patch mapping, `WHERE` condition, input type |
| `packages/api-client/src/customers/*`, `test/customers.service.test.ts` | doc comments and the URL assertion now name three filters |
| `apps/api/src/db/schema.spec.ts`, `db/schema.spec.ts`-style mocks, `scripts/db/schema-model.logic.test.mjs` | column list, the "no other table referenced" assertion, 11 → 10 relationships |
| `docs/Specs/Database-Schema.md` | regenerated with `pnpm db:diagram` |
| `docs/Specs/{Database-Local,API-Convention,Customers-Admin-Screens,UI-Architecture,New-Admin-Page}.md` | FK sentence, new §4.1 changelog entry, URL table, filter row, state-plan row, checklist sentence |

Behaviour decisions recorded in code: the request schemas are `.strict()`, so a stale client that
sends the field now gets a `400`; the list-query schema **strips** the retired key, so an old
bookmarked URL keeps working with the filter simply absent — pinned by its own unit test.

## 5. Outcome and how to verify

```bash
pnpm -r build && pnpm typecheck && pnpm lint && pnpm test    # all green
pnpm quality                                                 # six gates, 0 violations
node --test scripts/quality scripts/db scripts/lib/vite-build.logic.test.mjs  # 124 pass
pnpm db:diagram:check                                        # doc up to date
```

After applying the migration on a stack:

```sql
\d customer.customers   -- no responsible_operator_id, no customers_responsible_operator_id_operators_id_fk
SELECT count(*) FROM customer.customers WHERE responsible_operator_id IS NOT NULL;  -- errors: column gone
```

The field must not appear anywhere:

```bash
rg -i "responsible_operator|responsibleOperator" --glob '!**/dist/**' --glob '!docs/plans/**' --glob '!docs/history/**'
```

Only historical plans, history entries and the previous migration `0005` may still mention it.

## 6. Follow-ups

- The wave plan's `Q-1` follow-up ticket (operator-directory endpoint for the filter) is **moot** and
  should be closed rather than implemented.
- The commit carries no ticket key: no Jira ticket exists yet for this removal. Once an AIS-16-family
  ticket is created, the PR/squash-merge title should carry its key so the ticket–commit link survives.
- The migration is verified by tests and the generator only; applying it on a deployed database is the
  deploy step, with the pre-check from plan §6.
