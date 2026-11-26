# AIS-178 / slice c — the `customers` client service

**Date:** 2026-11-23 15:37 (Europe/Budapest)
**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Plan:** [`docs/plans/2026-11-23--15-30-00-ais-178-c-customers-api-client-plan.md`](../plans/2026-11-23--15-30-00-ais-178-c-customers-api-client-plan.md)
**Gap analysis it closes:** [`2026-11-23--15-23-00-ais-14-gap-analysis.md`](./2026-11-23--15-23-00-ais-14-gap-analysis.md) item **M1**
**Commit title:** `AIS-178: feat(api-client): add the customers service`

---

## Why

The six `customers` endpoints were mounted and tested by slice b, but the frontend could not call a
single one of them: `packages/api-client` had no `customers/` folder and
`createServiceFactories()` returned `{ apiKeys }` only. The AIS-110 gate compares the endpoint
registry with the built services, so `main` was **red**:

```text
customers.list / findById / create / update / updateStatus / remove → missing-service
namespaces: expected ['apiKeys','customers'], received ['apiKeys']
```

Without the service there is also no data path for any AIS-15 screen (list, detail, wizard), so this
slice is the hard prerequisite of the whole customer UI.

## What changed

| # | File | Change |
| --- | --- | --- |
| 1 | `packages/shared/src/contract/list-query.helper.ts` | `toListQueryParams` is generic (`<TQuery extends ListQuery & { readonly sort?: string }>`) and now appends every **non-paging** query key after the fixed `page → limit → order → q → sort` block, skipping `undefined`/`null`/`''`; new private `appendExtraFilters()` + `isFilterValue()` |
| 2 | `packages/shared/src/index.ts` | unchanged for this slice (the generic needs no new exported type) |
| 3 | `packages/shared/test/list-query.helper.test.ts` | **new sibling of `list-query-helper.test.ts`** — filter pass-through, skipped values, insertion order, no paging key twice, and an `interface`-shaped query |
| 4 | `packages/api-client/src/http-client.interface.ts` | `ListRequest` is generic (`ListRequest<TQuery>`), so a resource's own query type — filters included — is what the transport forwards |
| 5 | `packages/api-client/src/customers/customers.const.ts` | **new** — `CUSTOMERS_PATH`, `CUSTOMERS_DETAIL_PATH`, `CUSTOMERS_STATUS_PATH` (all via `clientPathOf`), `CUSTOMER_LIST_QUERY_DEFAULTS` |
| 6 | `packages/api-client/src/customers/customers.path.ts` | **new** — `toCustomerDetailPath()`, `toCustomerStatusPath()` (pure, URL-encoded) |
| 7 | `packages/api-client/src/customers/customers.interface.ts` | **new** — six documented methods, with the failure codes each caller can expect |
| 8 | `packages/api-client/src/customers/customers.service.ts` | **new** — `createCustomersService()`: `getList` for `list`, `get`/`post`/`patch`/`delete` for the rest, every response parsed with the shared schema |
| 9 | `packages/api-client/src/service.registry.ts` | `customers: createCustomersService` |
| 10 | `packages/api-client/src/index.ts` | exports the three paths, the defaults, the two path builders, the factory and the `CustomersService` type |
| 11 | `packages/api-client/test/mocks/customer.mock.ts` | **new** — re-exports the shared fixtures (no second copy), adds `VALID_CREATE_INPUT`, `VALID_UPDATE_INPUT`, `UPDATED_CUSTOMER` |
| 12 | `packages/api-client/test/customers.service.test.ts` | **new** — 24 cases across paths, list filters/pager, `404`, both `409`s, the `/status` route, `null` payload and abort signal |

## The one defect fixed outside the package

`toListQueryParams` wrote **only** `page`, `limit`, `order`, `q` and `sort`. The `customers` list has
four more filters (`type`, `status`, `source`, `responsibleOperatorId`), and `ListRequest.query` did
not even allow them at the type level — so a filter would have been dropped by the transport and
rejected by the compiler. The fix is a generic pass-through in the **shared** helper (not a second
builder in the service), because `getList` also unwraps and validates `meta.pagination` and slices
d/e/f will need the same behaviour for their own filters. The five paging keys keep their position,
so every `api-keys` URL is byte-identical.

## Behaviour that is now proven by tests

- `list` with a default query sends **no** query string; a changed field is encoded in the fixed
  order, and the four resource filters travel after it.
- `list` returns `{ data, pagination }`; a response without `meta.pagination` is an `ApiError`
  (`UNEXPECTED_PAYLOAD`), never a silently missing block.
- `findById`, `update` and `remove` all address the **same** detail route; `updateStatus` uses its
  own `/status` route.
- `404 NOT_FOUND`, `409 STALE_WRITE` and `409 CUSTOMER_TAX_NUMBER_CONFLICT` (with
  `issues[0].path === 'taxNumber'`) reach the caller unchanged.
- `remove` resolves `null` and rejects a non-null success payload.
- `options.signal` reaches `fetch`.

## Verification

```bash
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test        # service-coverage gate + the new suite
pnpm typecheck
pnpm lint
pnpm quality:dead-code
pnpm -r build
```

> **Not executed in this session.** The agent had no shell inside the workspace (the command MCP
> server is rooted at another project and rejects this cwd), so the gates above were written but not
> run here. Run them before opening the PR; the slice's DoD is exactly "`service-coverage` green".

## Known limitations / follow-ups

- **What the app does not consume yet.** `apps/admin/src/services/api-client.ts` is deliberately
  untouched: an unused `customersService` export would fail `pnpm quality:dead-code`. The one line
  (`export const customersService: CustomersService = createCustomersService(httpClient);`) belongs
  to the first AIS-15 ticket that needs it.
- **Slices d/e/f** still have no client methods — contacts, tags, customer users, activities and the
  audit-log read (`GET /:id/audit-logs`) need their registry entries first (gap analysis M2–M5).
- **The generic is the load-bearing part.** An index-signature type would compile for the customers
  service but break `toListParamsUrlSearchParams<TParams extends ListParams>()` in the admin hook,
  because a type variable gets no implicit index signature. If a future refactor "simplifies" the
  generic back to an intersection with `Record<string, …>`, `pnpm typecheck` in `apps/admin` fails —
  that is the guard, and the new shared test (`an interface-shaped query`) documents the intent.
