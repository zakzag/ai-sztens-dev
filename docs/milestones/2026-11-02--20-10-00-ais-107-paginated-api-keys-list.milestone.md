# AIS-107 — First paginated list endpoint (server-side paging + documented query)

**Date:** 2026-11-02 20:10 (Europe/Budapest) · **Ticket:** AIS-107 (subtask of AIS-102)

## 1. Problem / feature

`GET /api/api-keys` returned **every** row (`findAll`) and the response had no `meta.pagination`
block. AIS-106 had already shipped the _shared_ list-query contract (`listQuerySchema`,
`createListQuerySchema`, `paginatedSchema`), but no controller used `ZodQueryPipe`: the contract was
unproven in production. This ticket makes the endpoint paginated, sorted and searchable, and is the
reference implementation every later list endpoint copies.

## 2. Measured data / evidence

- `rg "@Query\(" apps/api/src` → **0 hits** before the change: `ZodQueryPipe` existed and was tested
  (AIS-90) but never wired.
- `ApiResponseService.ok(data, ctx, pagination?)` already accepted the paging block — no envelope
  change was needed.
- The `Database` mock modelled three chains (`insert…returning`, `select…orderBy`,
  `select…where…limit`): no `offset()`, no `count(*)`, so `findPage` was untestable as-is.
- `ApiEndpointContract` had no query-parameter slot: the generated OpenAPI document would have
  described an endpoint that no longer existed.

## 3. Root cause / design rationale

| Decision                                                                 | Alternative rejected                           | Why                                                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findPage(query) → { rows, total }`, `count(*)` over the **same** filter | `rows.length` as the total                     | `rows.length` is the page size; the pager needs the full result size                                                                                             |
| `orderBy(sortColumn, asc(id))`                                           | `orderBy(sortColumn)` only                     | two rows with the same value can swap between requests, so a page boundary silently skips or repeats a row                                                       |
| `?q=` **implemented** (ILIKE on `name` or `identifier`)                  | accept and ignore it                           | `q` is part of the validated contract; ignoring it is an invisible lie, and `total: 0` is not testable otherwise (a `page=9999` slice still reports `total > 0`) |
| Paging arithmetic in the pure shared `toPaginationMeta`                  | `Math.ceil` in the controller                  | the client pager needs the same numbers; one implementation cannot disagree with itself                                                                          |
| OpenAPI parameters as **descriptors derived from the shared constants**  | `registerPath({ request: { query: schema } })` | the `q` field ends in a `transform` (`ZodEffects`), which zod-to-openapi v7 cannot render as a parameter                                                         |
| `createListQuerySchema` generic over the sort tuple                      | `sort: string` + a cast at every call site     | the literal union (`'name' \| 'createdAt' \| …`) is what makes the column map exhaustive                                                                         |

## 4. Solution / implementation

| File                                                                | Change                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/shared/src/contract/list-query.schema.ts`                 | generic factory; extracted order/page constants                              |
| `packages/shared/src/contract/list-query.helper.ts`                 | new `toPaginationMeta(query, total)`                                         |
| `packages/shared/src/contract/list-query.parameters.ts`             | new: OpenAPI descriptors of `page`/`limit`/`order`/`q`                       |
| `packages/shared/src/contract/api-keys/api-keys.list-query.ts`      | new: sort allow-list, `apiKeyListQuerySchema`, parameter descriptors         |
| `packages/shared/src/contract/endpoint.interface.ts`                | optional `queryParameters`, `examplePagination`, `ApiQueryParameterContract` |
| `packages/shared/src/contract/api-keys/api-keys.contract.ts`        | list entry documents its query + paginated example                           |
| `apps/api/src/api-keys/api-keys.const.ts`                           | `API_KEY_SORT_COLUMNS` (typed against the contract union)                    |
| `apps/api/src/api-keys/api-keys.filter.ts`                          | new: `apiKeySearchFilter` (`ILIKE` on `name`/`identifier`)                   |
| `apps/api/src/api-keys/api-keys.repository.interface.ts`            | **breaking**: `findAll` → `findPage`, `ApiKeyPage`                           |
| `apps/api/src/api-keys/api-keys.repository.ts`                      | `count(*)` + `limit`/`offset` slice, deterministic order                     |
| `apps/api/src/api-keys/api-keys.interface.ts`                       | new: `PaginatedApiKeys`                                                      |
| `apps/api/src/api-keys/api-keys.service.ts`                         | `list(query)` → `{ items, pagination }`                                      |
| `apps/api/src/api-keys/api-keys.controller.ts`                      | `@Query(new ZodQueryPipe(apiKeyListQuerySchema))`                            |
| `apps/api/src/common/openapi/zod-openapi.ts`, `openapi.registry.ts` | `queryParametersOf`, `exampleMetaOf`                                         |
| `apps/api/src/api-keys/test/mocks/database.mock.ts`                 | `offset()`, scripted `count(*)`, lazy thenable nodes                         |
| `docs/Specs/API-Convention.md`                                      | §4.1 rewritten: per-resource allow-list, real paging, `q` semantics          |

## 5. Outcome and how to verify

`GET /api/api-keys?q=<prefix>&page=2&limit=10&sort=name&order=asc` answers `200` with the correct
slice and `meta.pagination = { page: 2, limit: 10, total: 12, totalPages: 2 }`; an unmatched `q`
answers `200` + `data: []` + `total: 0`; `limit=101` and an unknown `sort` answer `400`
`VALIDATION_FAILED` with the field in `details[].path`.

```bash
pnpm --filter @callback/shared test
pnpm --filter @callback/shared build     # apps/api consumes the built package
pnpm --filter @callback/api test
pnpm --filter @callback/api build
pnpm --filter @callback/api lint
pnpm --filter @callback/api test:e2e     # needs Node >= 24.9 + the dev-stack Postgres
pnpm --filter @callback/admin test       # guard: AIS-119 call sites still compile
pnpm knip
```

Manual check: open `/api/docs` (dev only) — `GET /api/api-keys` now lists `page`, `limit`, `sort`,
`order`, `q`, and its example body contains `meta.pagination`.

## 6. Follow-ups

- ~~The AppModule e2e suites cannot run on Node 20.19.2~~ — **resolved**: the repo now pins
  Node ≥ 24.9 (`engines` + `.node-version` 24.22.2) and the full e2e run executed
  (11 suites / 51 tests, nothing skipped) against the local Postgres.
- `packages/api-client` `list()` still sends no query and drops `meta` (AIS-109), so the admin list
  shows page 1 of 20 (AIS-114 owns the pager).
- `%` and `_` in `?q=` behave as SQL wildcards (documented, not escaped).
- The committed OpenAPI baseline (AIS-99) must be regenerated after this change.
