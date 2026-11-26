# AIS-106 — the shared list-query and pagination contract

**Date:** 2026-10-30
**Ticket:** AIS-106 (subtask of AIS-102)
**Plan:** [`docs/plans/2026-10-30--17-25-00-ais-106-list-query-contract-plan.md`](../plans/2026-10-30--17-25-00-ais-106-list-query-contract-plan.md:1)

---

## 1. Problem / feature

A paginated list request had no shared shape. The server had `ZodQueryPipe` and the envelope's
`meta.pagination`, but:

- **nothing** defined what a list query may contain (which fields, which ranges, what a valid
  `sort` column is), so every endpoint would have invented its own;
- the **client** had no way to reach `meta.pagination` — `client.get(path, apiKeyListSchema)`
  returns the `data` and drops the `meta`, so a client could not page, and `total`/`totalPages`
  were unreachable without a type assertion.

## 2. Measured data / evidence

Before the change (Node 24.22.2, zod 3.25.76):

| Metric                               | Before                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `packages/shared` test files / tests | 5 / 99                                                                            |
| The client transport's `list()`      | `client.get(API_KEYS_PATH, apiKeyListSchema)` — no query string, `meta` discarded |
| A shared list-query schema           | none                                                                              |

The zod behaviour was **measured** with a probe script before the plan was written, not assumed:

| Case                                             | Result                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `parse({})`                                      | `{ page: 1, limit: 20, order: 'desc' }`       |
| `parse({ page: '3', limit: '50' })`              | `{ page: 3, limit: 50 }` — the coercion works |
| `limit: ''` / `'0'` / `'101'`                    | rejected (`too_small` / `too_big`)            |
| `page: '0'` / `'1.5'`                            | rejected                                      |
| `order: 'sideways'`                              | rejected (`invalid_enum_value`)               |
| `q: ''` → `undefined` · `q: '  abc  '` → `'abc'` | trimmed and short-circuited                   |

One observation corrected the plan: after an empty `q` the key **stays present** with an `undefined`
value, so the URL builder has to skip `undefined` values as well as the defaults.

## 3. Root cause or design rationale

The envelope already had `meta.pagination`; what was missing was the **request** side and the
**client-side view**. Three decisions shaped the implementation.

**The response shape does not change.** `successEnvelopeSchema` stays as it is: `data` remains an
array, and `POST` (one object) and `DELETE` (`null`) still fit. The `paginatedSchema` is a
_separate, client-side_ schema that pairs the rows with a mandatory `meta.pagination`.

**The `sort` allow-list forces a factory.** The sortable columns are resource-specific (`name` for
api-keys, `createdAt` for companies), so a single static schema could not constrain them. A static
schema would have made an unknown column a `500` from the database; with
`createListQuerySchema(sortBy)` it is a `400`, and zod's enum error names the permitted values.

**The generic needed the array schema, not the item schema.** The first implementation called
`successEnvelopeSchema(itemSchema.array())` and did not compile:

```text
error TS2322: Type 'TItem[]' is not assignable to type 'TItem[][]'.
```

The cause: `successEnvelopeSchema` wraps the payload in `.nullable()` (the `POST`/`DELETE` case), and
zod's `ZodNullable<ZodType<T>>` widens the element type of a generic `ZodType` by one array
dimension. **The tests passed** — zod does not type-check at runtime — so `tsc` was the only thing
that caught it. The fix was to build the paginated schema on the shared `responseMetaSchema`
directly: the same `meta` rules, no nullable payload, and an exact type.

## 4. Solution / implementation

New files under `packages/shared/src/contract/`:

| File                      | Change                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-query.schema.ts`    | The `page`/`limit`/`sort`/`order`/`q` fields, the limit constants, the static `listQuerySchema` and the `createListQuerySchema(sortBy)` factory.                       |
| `list-query.helper.ts`    | The `ListQuery` interface, `mergeListQuery` (resource filters can never move the user to another page) and `toListQueryParams` (the defaults are left out of the URL). |
| `api-result.interface.ts` | `ApiResult<TRows>` — the rows plus a **mandatory** `meta.pagination`.                                                                                                  |
| `paginated.schema.ts`     | `paginatedSchema(rowsSchema)` — a response without `meta.pagination` fails the parse.                                                                                  |

Modified:

| File                                    | Change                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/contract/index.ts` | The new exports.                                                                                                                                                         |
| `packages/shared/src/index.ts`          | The same exports again — the root index **duplicates** the contract index rather than re-exporting it (`export *` is forbidden, so the package surface stays greppable). |
| `docs/Specs/API-Convention.md`          | A new §4.1 — the list query contract — and the header date.                                                                                                              |

New tests: `list-query.test.ts`, `list-query-factory.test.ts`, `list-query-helper.test.ts`,
`paginated.test.ts`.

**Not changed:** `envelope.schema.ts` and `envelope.interface.ts` (the `meta.pagination` already
existed), `api-keys.schema.ts` (the AIS-75 conflict is avoided by not touching it),
`packages/api-client` (the transport is AIS-109), `apps/api` (the `ZodQueryPipe` and the
`ApiResponseService` are ready).

**No server-side paging.** `findAll` is deliberately unpaginated — the tables hold provider
credentials, a handful of rows. The paginated endpoint is a separate change that turns `findAll`
into `findPage` (AIS-102).

## 5. Outcome and how to verify

| Metric                                 | Before | After       |
| -------------------------------------- | ------ | ----------- |
| `packages/shared` test files / tests   | 5 / 99 | **9 / 146** |
| New npm dependencies                   | —      | **0**       |
| `pnpm --filter @callback/shared build` | green  | **green**   |
| `pnpm -r build`                        | green  | **green**   |

```bash
pnpm --filter @callback/shared test
pnpm --filter @callback/shared build
pnpm -r build
pnpm test
pnpm format:check
```

## 6. Follow-ups

- **The server does not use the schema yet.** The contract exists; wiring it into the endpoints
  (the `ZodQueryPipe` with the resource's allow-list) is part of AIS-109/AIS-102.
- **The client does not build the query yet.** `toListQueryParams` is ready for AIS-119's
  `useListParams` and AIS-109's transport.
- **The `sort` allow-list is per resource.** Each resource needs its own
  `createListQuerySchema(['name', 'createdAt'])` call — the list of sortable columns is a contract
  decision, not a shared constant.
- **The `as unknown as TRows` cast** in the paginated transform is the price of the nullable
  input; the repo's envelope has the same trade-off documented in its docblock.
- **The two export indexes duplicate.** A new export must be added twice — the repo's existing
  pattern, not new debt, but worth knowing before adding an export.
