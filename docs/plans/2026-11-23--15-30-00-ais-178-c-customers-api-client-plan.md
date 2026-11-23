# AIS-178 / slice c — the `customers` client service

**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Slice lettering:** `a` = contract (shipped), `b` = the `apps/api` side (shipped), **`c` = this
plan — the `api-client` service**; `d` = contacts, `e` = tags + customer users, `f` = activities +
audit-log read (all still open).
**Parent plans:** [`2026-11-22--18-50-00-ais-178-customers-api-plan.md`](./2026-11-22--18-50-00-ais-178-customers-api-plan.md:1),
[`2026-11-22--22-16-00-ais-178-b-customers-api-slice-plan.md`](./2026-11-22--22-16-00-ais-178-b-customers-api-slice-plan.md:1) (§9, "Out of scope → slice c").
**Gap analysis this plan closes:** [`2026-11-23--15-23-00-ais-14-gap-analysis.md`](../history/2026-11-23--15-23-00-ais-14-gap-analysis.md:1) item **M1**.
**Suggested branch:** `AIS-178-customers-api-client`
**Commit title:** `AIS-178: feat(api-client): add the customers service`

---

## 0. Why this slice exists

The six `customers` endpoints are mounted and tested, but `packages/api-client` cannot call a single
one of them. The AIS-110 coverage gate compares the endpoint registry with the built client services,
so it is **red on `main` today**:

```text
pnpm --filter @callback/api-client test service-coverage
→ customers.list / findById / create / update / updateStatus / remove: reason "missing-service"
→ namespaces: expected ['apiKeys','customers'], received ['apiKeys']
```

Two of the three gate assertions fail (line 71 `missing`, line 80 `orphan` passes, line 90
namespace list). Slice c is the only thing that turns the gate green, and it is the prerequisite of
every admin screen in AIS-15: no client service ⇒ no query hook ⇒ no list page.

The b-plan's rule still holds: **b and c are one PR** (two commits). b alone leaves `main` red.

---

## 1. Decisions

| # | Question | Decision |
| --- | --- | --- |
| D1 | What exactly is slice c? | `packages/api-client/src/customers/` (`const`, `path`, `interface`, `service`), the `service.registry.ts` line, the `index.ts` re-exports, `test/mocks/customer.mock.ts`, `test/customers.service.test.ts`, plus **one** shared fix (D3). No admin code. |
| D2 | How are paths obtained? | `clientPathOf('customers.list' / 'customers.findById' / 'customers.updateStatus')`. A route is never written by hand: the registry owns it, the base URL already carries `/api`. |
| D3 | The four list filters (`type`, `status`, `source`, `responsibleOperatorId`) are **dropped today** | Fix it in the shared `toListQueryParams` with a generic pass-through (`<TQuery extends ListQuery & { readonly sort?: string }>`) and make `ListRequest` generic the same way. Without this the admin's filters would silently not travel. |
| D4 | Return types | `list` → `ApiResult<readonly Customer[]>` via `getList` (only a list needs `meta.pagination`); `findById` → `CustomerDetail`; `create`/`update`/`updateStatus` → `Customer`; `remove` → `null` (`noPayloadSchema` is `z.null()`). Exactly the `api-keys` convention (AIS-109/110). |
| D5 | Error handling | None. The transport already throws `ApiError` for `404`, `409 STALE_WRITE`, `409 CUSTOMER_*_CONFLICT` and contract drift; the service maps nothing and swallows nothing. The tests assert the codes and `details[].path` survive. |
| D6 | Admin wiring | **Not here.** `apps/admin/src/services/api-client.ts` stays untouched: an unused `customersService` export would fail the dead-code gate (`pnpm quality:dead-code`), and the hooks that consume it are AIS-15. |
| D7 | New error codes / copy | None. `CUSTOMER_NUMBER_CONFLICT` and `CUSTOMER_TAX_NUMBER_CONFLICT` already exist with Hungarian copy, so the admin parity test is unaffected. |
| D8 | File/naming conventions | `customers.const.ts`, `customers.path.ts`, `customers.interface.ts`, `customers.service.ts`; named exports only; explicit `.js` extensions in relative imports; JSDoc on every exported symbol (ts coding standards). |

---

## 2. Pre-flight findings (facts, verified in the code)

| # | Finding | Consequence |
| --- | --- | --- |
| F1 | `API_ENDPOINTS` contains the six `customers.*` ids (`customers.contract.ts`), and `createServiceFactories()` has only `apiKeys` (`service.registry.ts:20`) | The gate fails on `missing-service`; the registry line is the whole fix. |
| F2 | `toListQueryParams` writes **only** `page`, `limit`, `order`, `q`, `sort` (`list-query.helper.ts:113-144`), and `ListRequest.query` is typed `ListQuery & { sort?: string }` (`http-client.interface.ts:195`) | A `status=active` filter is silently dropped by the transport *and* rejected by the type. D3 must fix both. |
| F3 | `getList` builds the URL with the shared helper (`http-client.ts:465`) | So the fix belongs in the shared helper, not in the transport. |
| F4 | `customerListSchema` is `z.array(customerSchema)` | It is the row-array schema `getList` expects — pass it directly, never `z.array(...)` again. |
| F5 | `CUSTOMERS_ID_PARAM = ':id'`, `CUSTOMERS_PATH = '/api/admin/customers'` (`customers.const.ts:24-27`) | `clientPathOf` strips `/api`; the substitution helper replaces `:id` and URL-encodes it (`api-keys.path.ts` pattern). |
| F6 | `customers.remove` carries no body and documents no `STALE_WRITE` (b-plan `D5`) | `delete(path, noPayloadSchema)`; `null` is the honest return type, not `void`. |
| F7 | The coverage gate derives the method name from the last id segment (`list`, `findById`, `create`, `update`, `updateStatus`, `remove`) | The service must expose exactly those six names — a rename makes the gate red again (`orphan`). |
| F8 | `packages/api-client/package.json` declares `exports["."] → dist/index.js` | `src/index.ts` is the package entry, so exporting the new symbols there cannot be flagged as an unused export. |
| F9 | `CUSTOMER_DEFAULT_SORT = 'createdAt'` and `LIST_QUERY_DEFAULTS` exist | The resource defaults constant mirrors `API_KEY_LIST_QUERY_DEFAULTS`, so `?sort=createdAt` never appears in the URL. |
| F10 | The shared package has **no** test for `list-query.helper.ts` | The D3 change ships with a new `packages/shared/test/list-query.helper.test.ts` covering both the old and the new behaviour. |

---

## 3. Deliverables

### 3.1 New — `packages/api-client/src/customers/customers.const.ts`

```ts
import {
  CUSTOMER_DEFAULT_SORT,
  LIST_QUERY_DEFAULTS,
  type ListQueryDefaults,
} from '@callback/shared';
import { clientPathOf } from '../endpoint-path.js';

/** `GET/POST /api/admin/customers`, relative to the injected `/api` base URL. */
export const CUSTOMERS_PATH = clientPathOf('customers.list');

/** Detail route, still carrying `:id`; substituted by `toCustomerDetailPath`. */
export const CUSTOMERS_DETAIL_PATH = clientPathOf('customers.findById');

/** Dedicated status route, still carrying `:id`. */
export const CUSTOMERS_STATUS_PATH = clientPathOf('customers.updateStatus');

/** Values that count as “unchanged” in the customers list query. */
export const CUSTOMER_LIST_QUERY_DEFAULTS: ListQueryDefaults = {
  ...LIST_QUERY_DEFAULTS,
  sort: CUSTOMER_DEFAULT_SORT,
};
```

### 3.2 New — `packages/api-client/src/customers/customers.path.ts`

`toCustomerDetailPath(id)` and `toCustomerStatusPath(id)` — pure, `encodeURIComponent(id)`, replacing
`CUSTOMERS_ID_PARAM` (the `api-keys.path.ts` pattern, so the placeholder is known in one place).

### 3.3 New — `packages/api-client/src/customers/customers.interface.ts`

```ts
export interface CustomersService {
  list(query: CustomerListQuery, options?: RequestOptions): Promise<ApiResult<readonly Customer[]>>;
  findById(id: string, options?: RequestOptions): Promise<CustomerDetail>;
  create(input: CreateCustomerInput, options?: RequestOptions): Promise<Customer>;
  update(id: string, input: UpdateCustomerInput, options?: RequestOptions): Promise<Customer>;
  updateStatus(id: string, input: UpdateCustomerStatusInput, options?: RequestOptions): Promise<Customer>;
  remove(id: string, options?: RequestOptions): Promise<null>;
}
```

JSDoc must state, per method, which failure codes the caller can expect (`404`, `409 STALE_WRITE`,
`409 CUSTOMER_TAX_NUMBER_CONFLICT`, `409 CUSTOMER_NUMBER_CONFLICT`) and that `undefined` leaves a
field alone while `null` clears it.

### 3.4 New — `packages/api-client/src/customers/customers.service.ts`

```ts
export function createCustomersService(client: HttpClient): CustomersService {
  return {
    list: (query, options) =>
      client.getList(CUSTOMERS_PATH, customerListSchema, { query, defaults: CUSTOMER_LIST_QUERY_DEFAULTS }, options),
    findById: (id, options) => client.get(toCustomerDetailPath(id), customerDetailSchema, options),
    create: (input, options) => client.post(CUSTOMERS_PATH, input, customerSchema, options),
    update: (id, input, options) => client.patch(toCustomerDetailPath(id), input, customerSchema, options),
    updateStatus: (id, input, options) =>
      client.patch(toCustomerStatusPath(id), input, customerSchema, options),
    remove: (id, options) => client.delete(toCustomerDetailPath(id), noPayloadSchema, options),
  };
}
```

No logic of its own: parse the **response** with the shared schema (drift becomes an `ApiError` at the
edge, not `undefined` in React), pass `options` through so a TanStack Query abort signal works.

### 3.5 Modified — `packages/api-client/src/service.registry.ts`

```ts
import { createCustomersService } from './customers/customers.service.js';
// …
return { apiKeys: createApiKeysService, customers: createCustomersService };
```

### 3.6 Modified — `packages/api-client/src/index.ts`

Exports `CUSTOMERS_PATH`, `CUSTOMERS_DETAIL_PATH`, `CUSTOMERS_STATUS_PATH`,
`CUSTOMER_LIST_QUERY_DEFAULTS`, `toCustomerDetailPath`, `toCustomerStatusPath`,
`createCustomersService`, and `type CustomersService`.

### 3.7 Modified — `packages/shared/src/contract/list-query.helper.ts` (D3)

```ts
const PAGING_KEYS: ReadonlySet<string> = new Set(['page', 'limit', 'order', 'q', 'sort']);

export function toListQueryParams<
  TQuery extends ListQuery & { readonly sort?: string },
>(query: TQuery, defaults: ListQueryDefaults = LIST_QUERY_DEFAULTS): URLSearchParams;
```

Rule for the extras: after the five paging keys, append every remaining key whose value is neither
`undefined`, `null` nor `''`, in insertion order (`isFilterValue()` narrows the value at runtime).

**Why a generic and not an index signature.** The first draft typed the parameter as
`ListQuery & { sort?: string } & Record<string, …>`. That compiles for the customers service but not
for [`toListParamsUrlSearchParams<TParams extends ListParams>()`](../../apps/admin/src/features/api/use-list-params.logic.ts:191):
a *type variable* gets no implicit index signature, so the admin hook would stop compiling. The
generic keeps every caller's own query type assignable — an `interface`-shaped one included, which
the new shared test proves — and `ListRequest<TQuery>` in `http-client.interface.ts` mirrors it.

*(Rejected alternative: building the query string inside the customers service. `getList` also
unwraps and validates `meta.pagination`; duplicating the URL logic there would create a second,
diverging builder — and slices d/e/f need exactly the same pass-through.)*

---

## 4. Behaviour that must hold

| # | Requirement |
| --- | --- |
| 1 | `list` sends `GET /admin/customers` with **no** query string when the query is default (`page 1`, `limit 20`, `sort createdAt`, `order desc`). |
| 2 | A changed field is encoded, in the builder's fixed order (`page`, `limit`, `order`, `q`, `sort`) followed by the extras: `?page=2&limit=50&order=asc&q=acme&sort=legalName&type=company&status=active&source=referral&responsibleOperatorId=<uuid>`. |
| 3 | `list` returns `{ data, pagination }`; a response without `meta.pagination` is an `ApiError`, never a silently missing block. |
| 4 | `findById` → `GET /admin/customers/<id>`; a `404` surfaces as `ApiError` (`isNotFoundError`). |
| 5 | `create` → `POST /admin/customers`, body = `CreateCustomerInput`, response parsed as `Customer`; `409 CUSTOMER_NUMBER_CONFLICT` / `409 CUSTOMER_TAX_NUMBER_CONFLICT` keep their code and `details[].path`. |
| 6 | `update` → `PATCH /admin/customers/<id>` with the caller's `updatedAt` token untouched; `409 STALE_WRITE` surfaces unchanged. |
| 7 | `updateStatus` → `PATCH /admin/customers/<id>/status`, **never** the general `PATCH`. |
| 8 | `remove` → `DELETE /admin/customers/<id>`, `noPayloadSchema`; a `204` or a non-`null` payload is a contract violation. |
| 9 | `id` is URL-encoded; an unresolved `:id` never reaches `fetch` (the transport throws `UnresolvedPathParameterError`). |
| 10 | `options.signal` reaches `fetch` on every method. |

---

## 5. Tests

| Suite | Coverage |
| --- | --- |
| `packages/api-client/test/customers.service.test.ts` | path constants (`/admin/customers`, `/admin/customers/:id`, `/admin/customers/:id/status`); detail-path parity for `update` and `remove` via `clientPathOf`; default query ⇒ no `?`; every paging field and **each of the four filters** encoded; `meta.pagination` returned and a missing pager rejected; `findById` + `404`; `create` + `409 CUSTOMER_TAX_NUMBER_CONFLICT` with `details[0].path = 'taxNumber'`; `update` + `409 STALE_WRITE`; `updateStatus` hitting the `/status` route; `remove` returning `null` and rejecting a non-null payload; abort signal forwarded; a malformed response body ⇒ `ApiError` (contract drift) |
| `packages/api-client/test/mocks/customer.mock.ts` | re-exports `VALID_CUSTOMER`, `VALID_CUSTOMER_LIST`, `VALID_CUSTOMER_DETAIL`, `VALID_CREATE_CUSTOMER_REQUEST`, `VALID_UPDATE_CUSTOMER_REQUEST` from `@callback/shared` + one `UPDATED_CUSTOMER`; **no inline fixtures in the spec** (house rule) |
| `packages/shared/test/list-query.helper.test.ts` (new) | `page 1` / default `limit` / default `order` / default `sort` omitted; `q` omitted when empty or over-length; extras appended in insertion order; `undefined` / `null` / `''` extras skipped; numbers and booleans stringified; `mergeListQuery` still cannot override paging fields |
| gate | `service-coverage.test.ts` — all three assertions green (this is the DoD of the slice) |
| regression | `api-keys.service.test.ts` and `http-client.test.ts` stay green (the URL builder keeps its existing order) |

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Widening `ListRequest.query` lets a typo reach the server | The server's `customerListQuerySchema` strips unknown keys, so the real guard is the *type*: the service takes the contract's `CustomerListQuery`, not a loose record. A future `<resource>ListQuery` per service keeps it typed. |
| The extra-filter pass-through changes existing URLs | The five paging keys are written first, in the current order; extras are appended after them, so `api-keys` URLs are byte-identical. The existing tests prove it. |
| The gate flips back to red | Method names must equal the last id segment (`list`, `findById`, `create`, `update`, `updateStatus`, `remove`). Run the gate before pushing. |
| An unused export fails the dead-code gate | `src/index.ts` is the package entry (F8) and `service.registry.ts` consumes the factory, so nothing is orphaned. Do **not** wire the service into `apps/admin` in this slice (D6). |
| `CustomerDetail` has extra fields the UI may not need | The detail schema is already the published contract; parsing it wholesale is correct — a consumer picks what it renders. |

---

## 7. Verification

```bash
pnpm --filter @callback/shared test          # list-query helper + schema tests
pnpm --filter @callback/api-client test      # the gate + the new service suite
pnpm typecheck
pnpm lint
pnpm quality                                 # palette / layers / theme / docs / dead-code gates
pnpm -r build
```

Definition of done for slice c:

- [ ] `service-coverage` green: `missing` empty, `orphan` empty, namespace list `['apiKeys','customers']`.
- [ ] No route literal in `packages/api-client/src/customers/` — all three paths come from `clientPathOf`.
- [ ] The four customer filters travel in the list URL (proved by a test).
- [ ] Every response parsed with the shared schema; drift is an `ApiError`, not `undefined`.
- [ ] No admin file touched; `pnpm quality:dead-code` green.
- [ ] Tests added per §5; `pnpm test`, `lint`, `typecheck`, `-r build` green.
- [ ] `docs/history/<ts>-ais-178-c-customers-api-client.md` written; AIS-178/b and /c merged in one PR.

---

## 8. Out of scope

- **Admin feature hooks and pages** (`apps/admin/src/features/customers/`, entities, pages) — AIS-15.
- **Slice d/e/f** — contacts, tags, customer users, activities, audit-log read (each brings its own
  registry entries, client methods and `409` codes; see the gap analysis M2–M4).
- **`customers.service.interface.ts` on the API side** (gap analysis §4) — an API-side cleanup, not
  this slice.
- **Migrations, grants, contract schemas** — nothing changes on the server for slice c.
