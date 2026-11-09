# AIS-114 — Admin generic hook layer (`useApiList`, `useApiDetail`, `useApiMutation`)

**Date:** 2026-11-03 01:51 (Europe/Budapest)
**Ticket:** AIS-114 (subtask of AIS-103 — „Form és validáció: közös formátum-sémák, form primitívek, generikus hookok és mezőhiba-leképezés")
**Depends on:** AIS-109 (implemented — `HttpClient.getList` → `ApiResult`, `unwrapPaginatedEnvelope`), AIS-106/AIS-107 (implemented — `paginatedSchema`, `meta.pagination` on the wire), AIS-119 (implemented — `useListParams`), AIS-118 (implemented — MSW harness)
**Blocks:** AIS-111 (field-error mapping uses the generic mutation), AIS-116 (pager UI consumes the `meta` this ticket exposes)
**Scope decision (approved by user):** **full** — `ApiKeysService.list` switches to `getList`, `ApiKeysPage` reads its params from the URL, and `findByIdentifier` is added so `useApiDetail` has a real consumer
**Status:** planned

---

## 1. Goal, in one paragraph

One place per state bucket: a page should never re-implement “loading / error / refetch / invalidate”. This ticket
adds three generic hooks in [`features/api/`](../../apps/admin/src/features/api) that turn TanStack Query state into the
**narrow, already-mapped view** the UI consumes (the same shape `useApiKeysQuery` invented ad hoc): the raw
`ApiError`, the Hungarian `errorMessage`, the `errorSurface` tier, and — for lists — the guaranteed
`meta.pagination`. To make `meta` real, the `api-keys` client service has to stop throwing the envelope away
(`client.get` → `client.getList`), which in turn lets `ApiKeysPage` be driven by the URL params that AIS-119 already
provides. **No business logic and no notification system inside the hooks**: filtering/sorting stay pure functions in
`*.logic.ts`, and `meta.successMessage` is only carried through until AIS-84 wires the global capture.

---

## 2. Audited starting point

| Fact                                                                                                                                     | Where                                                                                                                                                                                      | Consequence                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `getList` already returns `ApiResult<TRows>` with a guaranteed `meta.pagination`; a missing block is a parse error                       | [`http-client.interface.ts:154`](../../packages/api-client/src/http-client.interface.ts:154), [`paginated.schema.ts:51`](../../packages/shared/src/contract/paginated.schema.ts:51)        | No transport work; only the service has to use it              |
| `ApiKeysService.list()` returns `readonly ApiKey[]` via `client.get` — `meta` is discarded                                               | [`api-keys.service.ts:28`](../../packages/api-client/src/api-keys/api-keys.service.ts:28)                                                                                                  | `meta.pagination` cannot be exposed without a service change   |
| The API **already** sends `meta.pagination` and accepts `page`/`limit`/`sort`/`order`/`q`                                                | [`api-keys.controller.ts:69`](../../apps/api/src/api-keys/api-keys.controller.ts:69), [`api-keys.list-query.ts:51`](../../packages/shared/src/contract/api-keys/api-keys.list-query.ts:51) | Wire contract ready; defaults come from the shared schema      |
| `useListParams(schema)` exists but has **no consumer**; its docblock names `useApiList` (AIS-114) as the consumer                        | [`use-list-params.ts:35`](../../apps/admin/src/features/api/use-list-params.ts:35)                                                                                                         | Threading it through the page closes an open loop              |
| `useApiKeysQuery` / `useCreateApiKeyMutation` already build the target shape by hand                                                     | [`use-api-keys.ts:32`](../../apps/admin/src/features/api-keys/use-api-keys.ts:32)                                                                                                          | The generic hook is an extraction, not a new invention         |
| Error → copy / surface mapping exists and is pure                                                                                        | [`error-surface.logic.ts:75`](../../apps/admin/src/lib/error-surface.logic.ts:75), [`error-message.ts`](../../apps/admin/src/lib/error-message.ts:1)                                       | Hooks only call it, never branch on status                     |
| MSW list handlers answer a plain `data` envelope with **no** `meta.pagination`                                                           | [`api-keys.handlers.ts:51`](../../apps/admin/src/test/mocks/handlers/api-keys.handlers.ts:51), [`handler-envelope.ts:38`](../../apps/admin/src/test/mocks/handlers/handler-envelope.ts:38) | Every list handler must gain a pager block, or `getList` fails |
| `GET /api/api-keys/:identifier` exists server-side and in the registry (`apiKeys.findByIdentifier`) but has **no** client service method | [`api-keys.contract.ts:80`](../../packages/shared/src/contract/api-keys/api-keys.contract.ts:80)                                                                                           | `useApiDetail` needs `findByIdentifier` to have a consumer     |
| Pager / table primitives (`Pagination`, `DataTable`) do not exist yet                                                                    | AIS-116 (To Do)                                                                                                                                                                            | This ticket exposes `meta`; it must **not** invent pager UI    |

---

## 3. Decisions

### D1 — The hook owns state, never rules

`useApiList` / `useApiDetail` / `useApiMutation` only translate TanStack state into a view model. No filtering, no
sorting, no field-path mapping: those stay in `*.logic.ts` (e.g. [`api-keys.logic.ts`](../../apps/admin/src/features/api-keys/api-keys.logic.ts:115)).
The only allowed “logic” is the pure state→view mapping, extracted into `api-hooks.logic.ts` so it is unit-testable
without React.

### D2 — No dependency on the notification system

`useApiMutation` accepts an optional `meta: { successMessage?: string }` and **returns it untouched** as
`successMessage`. Nothing renders it, nothing calls a toast. AIS-84 wires the global capture later; the test only
proves the value survives the hook (DoD bullet).

### D3 — Query keys come from `*.const.ts`, never from a hook call site

The hook takes a ready `queryKey`. For the list the key must depend on the query, so `api-keys.const.ts` gains a
**factory**:

```ts
export const API_KEYS_QUERY_KEYS = {
  all: ['api-keys'] as const,
  list: (params: ApiKeyListQuery) => ['api-keys', 'list', params] as const,
  detail: (identifier: string) => ['api-keys', 'detail', identifier] as const,
} as const;
```

`all` stays the invalidation prefix, so a successful mutation refreshes list _and_ detail without knowing their shape.

### D4 — Invalidation in one place

`useApiMutation` takes `invalidateKeys?: readonly QueryKey[]` and calls `queryClient.invalidateQueries` **before** the
caller's `onSuccess`. No hand-patched cache entries, matching the existing `useCreateApiKeyMutation` behaviour.

### D5 — `features/api-keys` migrates onto the generic hooks

`useApiKeysQuery` becomes a thin adapter over `useApiList`; `useCreateApiKeyMutation` a thin adapter over
`useApiMutation`. Their **public result shapes stay unchanged** (`apiKeys`, `createApiKey`, `error` as message…) so
[`ApiKeysPage`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:29) and [`ApiKeyForm`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:1)
do not have to change their contracts. The feature keeps its own query-key const and `EMPTY_API_KEY_LIST`.

### D6 — The service uses the paginated transport

```ts
export interface ApiKeysService {
  list(
    query: ApiKeyListQuery,
    options?: RequestOptions,
  ): Promise<ApiResult<readonly ApiKey[]>>;
  findByIdentifier(
    identifier: string,
    options?: RequestOptions,
  ): Promise<ApiKey>;
  create(input: CreateApiKeyInput, options?: RequestOptions): Promise<ApiKey>;
}
```

`list` calls `client.getList(path, apiKeyListSchema, { query, defaults }, options)`; the path for the detail comes from
`clientPathOf('apiKeys.findByIdentifier')` (no hand-written route). `defaults` is a new
`API_KEY_LIST_QUERY_DEFAULTS = { ...LIST_QUERY_DEFAULTS, sort: API_KEY_DEFAULT_SORT }`, so the URL only carries what
the user changed.

### D7 — `meta` typing: non-null on success, `null` until then

`UseApiListResult<TRows>` exposes `readonly meta: PaginatedMeta | null`, where `PaginatedMeta = ApiResult<TRows>['meta']`.
No `any`, no assertion: while loading or after a failure the block simply does not exist yet, and `data` falls back to
the caller-supplied `emptyData` (stable identity, like `EMPTY_API_KEY_LIST`).

### D8 — Cancellation is real, so `silent` is reachable

The hook's `queryFn` receives `{ signal }` from TanStack, and the service methods accept `RequestOptions`, so an
aborted read arrives as an abort-like error — already classified `silent` by
[`toErrorSurface()`](../../apps/admin/src/lib/error-surface.logic.ts:75). Without this, the `silent` tier would stay dead
code in the generic path.

### D9 — Pager/filter UI is explicitly out of scope

`ApiKeysPage` threads `useListParams(apiKeyListQuerySchema)` into the hook and passes `meta` down, but renders no
controls: `Pagination`, `DataTable` and `EmptyState` belong to **AIS-116**. A deep link (`?page=2&sort=name`) works
immediately; visible controls land with the primitives.

---

## 4. File-by-file changes

### 4.1 `packages/api-client` (client contract)

| File                                                                                       | Change                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`api-keys.interface.ts`](../../packages/api-client/src/api-keys/api-keys.interface.ts:12) | `list(query, options?) → ApiResult<readonly ApiKey[]>`; new `findByIdentifier(identifier, options?)`; every method takes optional `RequestOptions` |
| [`api-keys.service.ts`](../../packages/api-client/src/api-keys/api-keys.service.ts:26)     | `list` → `client.getList`; `findByIdentifier` → `client.get(DETAIL_PATH, apiKeySchema)`; `create` unchanged apart from the pass-through options    |
| [`api-keys.const.ts`](../../packages/api-client/src/api-keys/api-keys.const.ts:13)         | Add `API_KEYS_DETAIL_PATH = clientPathOf('apiKeys.findByIdentifier')` + `API_KEY_LIST_QUERY_DEFAULTS`                                              |
| [`index.ts`](../../packages/api-client/src/index.ts:80)                                    | Export the new const(s) — no barrels, explicit only                                                                                                |
| [`api-keys.service.test.ts`](../../packages/api-client/test/api-keys.service.test.ts:1)    | Assert `getList` usage, defaults omission, `ApiResult` passthrough, detail path substitution, malformed pagination → `ApiError`                    |

### 4.2 `apps/admin/src/features/api` (new generic layer)

| File                                                                                 | Content                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`api-hooks.const.ts`](../../apps/admin/src/features/api/api-hooks.const.ts)         | `API_HOOKS_EMPTY_META = null` is _not_ needed — only the shared “no keys” helpers if any; keep this file for stable query defaults                                            |
| [`api-hooks.interface.ts`](../../apps/admin/src/features/api/api-hooks.interface.ts) | Shared types: `ApiQueryErrorView` (`error`, `errorMessage`, `errorSurface`), `PaginatedMeta<TRows>`, option/result types per hook                                             |
| [`api-hooks.logic.ts`](../../apps/admin/src/features/api/api-hooks.logic.ts)         | Pure `toApiQueryErrorView(error: unknown): ApiQueryErrorView` (calls `toApiError`, `toErrorMessage`, `toErrorSurface`)                                                        |
| [`use-api-list.ts`](../../apps/admin/src/features/api/use-api-list.ts)               | `useApiList<TRows>({ queryKey, queryFn, emptyData, enabled? })` → `{ data, meta, isLoading, isFetching, error, errorMessage, errorSurface, refetch }`                         |
| [`use-api-detail.ts`](../../apps/admin/src/features/api/use-api-detail.ts)           | `useApiDetail<TData>({ queryKey, queryFn, enabled? })` → `{ data: null \| TData, isLoading, error, errorMessage, errorSurface, refetch }`                                     |
| [`use-api-mutation.ts`](../../apps/admin/src/features/api/use-api-mutation.ts)       | `useApiMutation<TData, TVariables>({ mutationFn, invalidateKeys?, meta?, onSuccess? })` → `{ mutateAsync, isPending, isSuccess, error, errorMessage, successMessage, reset }` |

`queryFn` signature in both read hooks: `(context: { signal: AbortSignal }) => Promise<...>`.
`refetch` is `(): void` (fires and forgets, matching the existing hook), so a page cannot await it by accident.

### 4.3 `apps/admin/src/features/api-keys` (migration, D5)

| File                                                                                       | Change                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`api-keys.const.ts`](../../apps/admin/src/features/api-keys/api-keys.const.ts:19)         | `API_KEYS_QUERY_KEYS.list` becomes the param-taking factory; add `detail`; keep `EMPTY_API_KEY_LIST` unchanged                                                                                                                                        |
| [`api-keys.interface.ts`](../../apps/admin/src/features/api-keys/api-keys.interface.ts:48) | `UseApiKeysQueryResult` gains `meta` (or re-exports the generic result type) while keeping the existing fields                                                                                                                                        |
| [`use-api-keys.ts`](../../apps/admin/src/features/api-keys/use-api-keys.ts:32)             | `useApiKeysQuery(params)` = `useApiList({ queryKey: API_KEYS_QUERY_KEYS.list(params), queryFn: ({ signal }) => apiKeysService.list(params, { signal }), emptyData: EMPTY_API_KEY_LIST })`; `useCreateApiKeyMutation` = `useApiMutation` + `onCreated` |

### 4.4 `apps/admin/src/pages/api-keys` (D9)

| File                                                                                 | Change                                                                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [`ApiKeysPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:29)          | `const { params } = useListParams(apiKeyListQuerySchema)` → `useApiKeysQuery(params)`; `meta` read but not yet rendered (AIS-116) |
| [`api-keys.interface.ts`](../../apps/admin/src/pages/api-keys/api-keys.interface.ts) | Add the page-level type if the passed-through `meta` needs a name (no inline types)                                               |

### 4.5 Test doubles (`apps/admin/src/test/mocks`)

| File                                                                                       | Change                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [`handler-envelope.ts`](../../apps/admin/src/test/mocks/handlers/handler-envelope.ts:38)   | `successResponse(data, { pagination? })` merges the block into `meta` (via `toPaginationMeta` from `@callback/shared`) |
| [`api-keys.handlers.ts`](../../apps/admin/src/test/mocks/handlers/api-keys.handlers.ts:51) | Every list handler gains `meta.pagination`; add `apiKeysDetailSuccess`, `apiKeysDetailNotFound`, `apiKeysListPageTwo`  |
| [`server.ts`](../../apps/admin/src/test/mocks/server.ts:16)                                | Default handler set: list (with pager) + create + detail                                                               |
| [`api-key.mock.ts`](../../packages/api-client/test/mocks/api-key.mock.ts:1)                | Add a `VALID_API_KEY_RESULT` (`ApiResult`) fixture used by the service test                                            |

---

## 5. Test matrix (DoD)

| Suite                                               | Cases                                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/api/api-hooks.logic.test.ts`              | `ApiError` → surface passthrough; non-`ApiError` → `page`; `null` error → all `null`                                                                                                                                           |
| `features/api/use-api-list.test.tsx`                | loading (empty data, `meta === null`) → success with **two** rows + `meta.pagination`; empty list (`total: 0`); `500` (`errorSurface: 'page'`); offline (`banner`); `refetch` after failure recovers; `meta` never `undefined` |
| `features/api/use-api-detail.test.tsx`              | success; `404` → `page` + `isNotFoundError`-compatible code; loading; `refetch`; `enabled: false` never fetches                                                                                                                |
| `features/api/use-api-mutation.test.tsx`            | success invalidates the given keys (list refetches, cache not hand-patched); `meta.successMessage` returned verbatim; `500` → `errorMessage`; `reset` clears; `isPending` during an infinite handler                           |
| `features/api-keys/use-api-keys.test.tsx`           | Existing suite stays green after the migration, plus an assertion that `meta.pagination.total` is exposed                                                                                                                      |
| `features/api-keys/use-api-keys.envelope.test.tsx`  | Unchanged behaviour: a 200 without the envelope is still `UNEXPECTED_PAYLOAD`                                                                                                                                                  |
| `packages/api-client/test/api-keys.service.test.ts` | `getList` + defaults omission + detail path + `ApiResult` typing                                                                                                                                                               |

Mocks live in `src/test/mocks/**` only; no `fetch` stubbing, no real timers.

---

## 6. Out of scope

- `Pagination` / `DataTable` / `EmptyState` / `Skeleton` primitives — **AIS-116**.
- The pager/filter **UI** and any visible control on `/api-keys` — AIS-116 (this ticket only threads params and exposes `meta`).
- `update` / `remove` service methods and the mutation flows that use them — separate ticket (AIS-108 server side is done, client side is not in this scope).
- The toast/notification capture — **AIS-84** (`successMessage` is only carried).
- `packages/ui` and `apps/web` — untouched.

---

## 7. Verification

```bash
pnpm --filter @callback/api-client test
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
pnpm quality
```

Manual smoke: `pnpm --filter @callback/admin dev`, open `/api-keys?page=1&limit=5&sort=name` — the request must carry
exactly those params, and a page past the end must render an empty table (`total` in `meta`), not an error.

---

## 8. Documentation to update with the change

| Document                                                         | Update                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) | `features/` row gains `features/api/` hooks; the `pages/api-keys` state row states that query params now feed `useApiList`; bump `**Utolsó frissítés:**` |
| [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1)   | Client transport section: `ApiKeysService.list(query)` returns `ApiResult`, `findByIdentifier` added                                                     |
| `docs/history/<ts>-ais-114-generic-api-hooks.md`                 | Change summary (required by the documentation rule)                                                                                                      |
| `docs/milestones/<ts>-ais-114-generic-api-hooks.milestone.md`    | Decision-grade record: envelope→`ApiResult` switch, `meta` typing, `silent`/abort wiring (required by the milestone rule)                                |

---

## 9. Execution order

1. `packages/api-client`: service contract + `getList` impl + consts + tests (green on its own).
2. MSW harness: `successResponse` pagination + list/detail handlers (admin tests can then exist).
3. `features/api`: interface, pure logic, then the three hooks + their tests.
4. `features/api-keys`: migration onto the generic hooks, existing suites green.
5. `pages/api-keys`: `useListParams` wiring.
6. Docs (specs, history, milestone) + full `pnpm quality`.
