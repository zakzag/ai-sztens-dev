# AIS-107 — Paginated `GET /api/api-keys`

**Date:** 2026-11-02 20:10 (Europe/Budapest)
**Ticket:** AIS-107 — subtask of AIS-102 („Adatáramlás: lista/pagináció konvenció, PATCH/DELETE végpontok és teljes kliens-transport")
**Plan:** [`docs/plans/2026-11-02--19-50-00-ais-107-paginated-api-keys-list-plan.md`](../plans/2026-11-02--19-50-00-ais-107-paginated-api-keys-list-plan.md)
**Milestone:** [`docs/milestones/2026-11-02--20-10-00-ais-107-paginated-api-keys-list.milestone.md`](../milestones/2026-11-02--20-10-00-ais-107-paginated-api-keys-list.milestone.md)

## What changed

### `packages/shared` (the contract)

- [`list-query.schema.ts`](../../packages/shared/src/contract/list-query.schema.ts:1) —
  `createListQuerySchema` is now generic over the sort tuple (`<TSort extends string>`), so the
  parsed `sort` keeps its **literal union** instead of widening to `string`; `LIST_QUERY_ORDER_VALUES`,
  `LIST_QUERY_DEFAULT_ORDER`, `LIST_QUERY_DEFAULT_PAGE` extracted as the single source of those numbers.
- [`list-query.helper.ts`](../../packages/shared/src/contract/list-query.helper.ts:1) — new pure
  `toPaginationMeta(query, total)` (`totalPages = 0` when `total === 0`, otherwise `ceil(total / limit)`).
- [`list-query.parameters.ts`](../../packages/shared/src/contract/list-query.parameters.ts:1) — **new**:
  OpenAPI descriptors of `page`/`limit`/`order`/`q`, each built from the same constants the schema uses.
- [`api-keys/api-keys.list-query.ts`](../../packages/shared/src/contract/api-keys/api-keys.list-query.ts:1) —
  **new**: `API_KEY_SORT_FIELDS`, `API_KEY_DEFAULT_SORT` (`createdAt`), `apiKeyListQuerySchema`,
  `ApiKeyListQuery`, `API_KEY_SORT_PARAMETER`, `API_KEY_LIST_QUERY_PARAMETERS`.
- [`endpoint.interface.ts`](../../packages/shared/src/contract/endpoint.interface.ts:1) — optional
  `queryParameters` and `examplePagination` on `ApiEndpointContract`, plus `ApiQueryParameterContract`.
- [`api-keys/api-keys.contract.ts`](../../packages/shared/src/contract/api-keys/api-keys.contract.ts:1) —
  the `apiKeys.list` entry documents its five query parameters, shows `meta.pagination` in the
  example, and documents `VALIDATION_FAILED`.

### `apps/api`

- [`api-keys.const.ts`](../../apps/api/src/api-keys/api-keys.const.ts:1) — `API_KEY_SORT_COLUMNS`,
  typed `Record<ApiKeySortField, PgColumn>` so a missing column is a compile error.
- [`api-keys.filter.ts`](../../apps/api/src/api-keys/api-keys.filter.ts:1) — **new**: the `?q=`
  filter (`ILIKE` on `name` **or** `identifier`), reused by the count and the page query.
- [`api-keys.repository.interface.ts`](../../apps/api/src/api-keys/api-keys.repository.interface.ts:1) —
  **breaking**: `findAll()` → `findPage(query): Promise<ApiKeyPage>` (`{ rows, total }`); the old
  “no pagination by design” docblock rewritten.
- [`api-keys.repository.ts`](../../apps/api/src/api-keys/api-keys.repository.ts:1) — `findPage`
  runs `count(*)` and the `limit`/`offset` slice in parallel, `orderBy(sort, asc(id))` for a
  deterministic page boundary.
- [`api-keys.interface.ts`](../../apps/api/src/api-keys/api-keys.interface.ts:1) — **new**:
  `PaginatedApiKeys { items, pagination }`.
- [`api-keys.service.ts`](../../apps/api/src/api-keys/api-keys.service.ts:1) — `list(query)` returns
  the page type; the arithmetic comes from `toPaginationMeta`.
- [`api-keys.controller.ts`](../../apps/api/src/api-keys/api-keys.controller.ts:1) —
  `@Query(new ZodQueryPipe(apiKeyListQuerySchema))`, then `responses.ok(items, ctx, pagination)`.
  First production use of `ZodQueryPipe`.
- [`common/openapi/zod-openapi.ts`](../../apps/api/src/common/openapi/zod-openapi.ts:1) +
  [`openapi.registry.ts`](../../apps/api/src/common/openapi/openapi.registry.ts:1) — `queryParametersOf(entry)`
  merged into the operation's `parameters`; `exampleMetaOf(entry)` adds `meta.pagination` to the sample.

## Tests

| Suite                                 | Result                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @callback/shared test` | 10 suites / **167 tests** green (new: `api-keys-list-query.test.ts`, `toPaginationMeta` block, generic-factory type assertion)                                 |
| `pnpm --filter @callback/api test`    | 38 suites / **370 tests** green (repository `findPage` + `q` filter + tie-breaker, service pagination, controller `meta.pagination`, OpenAPI query parameters) |
| `pnpm --filter @callback/admin test`  | 23 files / **195 tests** green (guard: the shared factory change did not break AIS-119)                                                                        |
| `pnpm --filter @callback/api build`   | green                                                                                                                                                          |
| `pnpm --filter @callback/api lint`    | 0 errors (1 pre-existing `no-unsafe-argument` warning in the OpenAPI bridge)                                                                                   |
| `pnpm knip`                           | clean                                                                                                                                                          |

The `Database` mock gained `offset()`, a scripted `count(*)` (`countWhere`) and **lazy** thenable
chain nodes: an eagerly created rejected promise that a test chains over is an unhandled rejection
and kills the Jest worker, which is a 30-minute debug for a one-line fix.

## e2e — executed, not skipped

The first run of this suite self-skipped: Jest's ESM runner needs Node ≥ 24.9 to `require()` the
CommonJS-only `@nestjs/config`, and the shell was on 20.19.2 (`[app-module-gate] skipped…`). After
switching the repo to Node 24 (see below) **all 13 `api-keys` e2e tests executed against the real
`AppModule` and the local Postgres** — including the five new scenarios:

```
√ GET /api/api-keys lists the created keys inside `data` with `meta.pagination`
√ GET /api/api-keys serves page 2 of a filtered, name-ascending list
√ GET /api/api-keys answers an empty result with 200, `data: []` and `total: 0`
√ GET /api/api-keys rejects limit=101 with 400 + a `limit` detail
√ GET /api/api-keys rejects an unknown sort column with 400 + a `sort` detail
```

The full e2e run: **11 suites / 51 tests passed, nothing skipped**.

## Node baseline raised to 24

- [`package.json`](../../package.json:6) — `"engines": { "node": ">=24.9.0" }`.
- [`.node-version`](../../.node-version:1) — `24.22.2`, the version `fnm` switches to.
- [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md:40) — new §2.1 documenting why
  the gate matters (an older runtime makes the `AppModule` suites pass **without asserting**).

Docker Desktop was not running, so the DB step is worth recording: `docker info` failed with
`npipe:////./pipe/dockerDesktopLinuxEngine`, then `pnpm db:up` reported
`Container infra-postgres-1 Running` once the engine was up.

## Out of scope (deliberately)

`packages/api-client` parametrised list/transport (AIS-109), `useApiList` (AIS-114), the admin
pager/filter UI (AIS-104), and the committed OpenAPI baseline regeneration (AIS-99) — the baseline
must be re-run **after** this change.

## Known limitation

The admin list still calls `list()` without a query, so it now receives **page 1 of 20** rows.
Acceptable at the current key count; the UI-side pager is AIS-114.
