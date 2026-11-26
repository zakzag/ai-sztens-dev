# AIS-114 — Admin generic hook layer (`useApiList`, `useApiDetail`, `useApiMutation`)

**Date:** 2026-11-03 14:54 (Europe/Budapest)
**Ticket:** AIS-114 (subtask of AIS-103 — „Form és validáció")
**Plan:** [`docs/plans/2026-11-03--01-51-00-ais-114-generic-api-hooks-plan.md`](../plans/2026-11-03--01-51-00-ais-114-generic-api-hooks-plan.md:1)
**Depends on:** AIS-109 (transport), AIS-106/AIS-107 (paginated contract), AIS-119 (`useListParams`), AIS-118 (MSW harness)

## What changed

One place per state bucket: a page should never re-implement “loading / error / refetch / invalidate”. Three generic
hooks were added in [`apps/admin/src/features/api/`](../../apps/admin/src/features/api:1) that turn TanStack Query state
into the narrow, already-mapped view the UI consumes (the same shape `useApiKeysQuery` invented ad hoc): the raw
`ApiError`, the Hungarian `errorMessage`, the `errorSurface` tier, and — for lists — the guaranteed `meta.pagination`.

### `apps/admin/src/features/api/` (new generic layer)

| File                     | Responsibility                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-hooks.interface.ts` | Shared types: `ApiQueryErrorView` (`error`, `errorMessage`, `errorSurface`), per-hook option/result types. No inline object types.                                                                                              |
| `api-hooks.logic.ts`     | Pure `toApiQueryErrorView(error)`: calls `toApiError` → `toErrorMessage` → `toErrorSurface`. Non-`ApiError` → `page`; `null` error → all `null`. Unit-tested without React.                                                     |
| `use-api-list.ts`        | `useApiList<TRows>({ queryKey, queryFn, emptyData })` → `{ data, meta, isLoading, isFetching, error, errorMessage, errorSurface, refetch }`. `meta: PaginatedMeta \| null` (non-null on success only).                          |
| `use-api-detail.ts`      | `useApiDetail<TData>({ queryKey, queryFn })` → `{ data, isLoading, error, errorMessage, errorSurface, refetch }`.                                                                                                               |
| `use-api-mutation.ts`    | `useApiMutation<TData, TVariables>({ mutationFn, invalidateKeys?, meta?, onSuccess? })` → `{ mutateAsync, isPending, isSuccess, error, errorMessage, successMessage, reset }`. Invalidates **before** the caller's `onSuccess`. |

### `packages/api-client/src/api-keys/` (client contract)

| File                    | Change                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-keys.interface.ts` | `list(query, options?) → ApiResult<readonly ApiKey[]>`; new `findByIdentifier(identifier, options?)`; every method takes optional `RequestOptions`.                                                |
| `api-keys.service.ts`   | `list` → `client.getList(path, apiKeyListSchema, { query, defaults }, options)`; `findByIdentifier` → `client.get(DETAIL_PATH, apiKeySchema)`; `create` unchanged apart from pass-through options. |
| `api-keys.const.ts`     | New `API_KEY_LIST_QUERY_DEFAULTS = { ...LIST_QUERY_DEFAULTS, sort: API_KEY_DEFAULT_SORT }`.                                                                                                        |
| `api-keys.path.ts`      | **new** — `toApiKeyDetailPath(id)` resolves the registry placeholder (`clientPathOf('apiKeys.findByIdentifier')`). No hand-written route.                                                          |
| `index.ts`              | Export the new const(s) and path helper. Explicit only, no barrels.                                                                                                                                |

### `apps/admin/src/features/api-keys/` (migration onto generic hooks — D5)

`useApiKeysQuery(params)` becomes a thin adapter over `useApiList`; `useCreateApiKeyMutation` a thin adapter over
`useApiMutation`. Their **public result shapes stay unchanged** (`apiKeys`, `createApiKey`, `error` as message…), so
[`ApiKeysPage`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:1) and [`ApiKeyForm`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx:1)
do not change their contracts.

### `apps/admin/src/pages/api-keys/` (D9 — params threaded, pager UI out of scope)

[`ApiKeysPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeysPage.tsx:1) threads
`useListParams(apiKeyListQuerySchema)` into the hook and passes `meta` down, but renders no controls. A deep link
(`?page=2&sort=name`) works immediately; visible controls land with AIS-116 primitives.

### Test doubles (`apps/admin/src/test/mocks/`)

`handler-envelope.ts` gains a `pagination?` merge into `meta`; every list handler now carries `meta.pagination`. New
fixtures: `apiKeysDetailSuccess`, `apiKeysDetailNotFound`, `apiKeysListPageTwo`. No `fetch` stubbing, no real timers.

## Decisions worth remembering

1. **The hook owns state, never rules.** Filtering / sorting / field-path mapping stay in `*.logic.ts`; the hooks only
   translate TanStack state into a view model (D1).
2. **No dependency on the notification system.** `useApiMutation` accepts an optional `meta: { successMessage? }` and
   returns it untouched; nothing renders or toasts it — AIS-84 wires the global capture later (D2).
3. **Query keys come from const, never a call site.** The list key is a param-taking factory (`['api-keys','list',params]`);
   `all` stays the invalidation prefix so a mutation refreshes list _and_ detail without knowing their shape (D3).
4. **`meta` typing: non-null on success, `null` until then.** No `any`, no assertion — while loading or after a failure
   the block simply does not exist yet; `data` falls back to the caller-supplied stable `emptyData` (D7).
5. **Cancellation is real.** The read hooks' `queryFn` receives `{ signal }`; an aborted read arrives as an abort-like
   error already classified `silent` by `toErrorSurface()` — so the `silent` tier is reachable on the generic path (D8).
6. **The service uses the paginated transport, not a hand-written route.** The detail path comes from the registry via
   `clientPathOf('apiKeys.findByIdentifier')`, and defaults are omitted from the URL unless the user changed them.

## Verification

| Check                                     | Result                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @callback/api-client test` | 8 suites / 169 tests, green                                                                                                                           |
| `pnpm --filter @callback/admin test`      | 27 files / 223 tests, green (including the migrated `use-api-keys.*`)                                                                                 |
| `pnpm lint`                               | exit 0, zero warnings                                                                                                                                 |
| `pnpm quality`                            | exit 0 — layers, knip, palette, field-errors all clean                                                                                                |
| `pnpm format:check`                       | my files prettier-clean (12 pre-existing unformatted files untouched; only `.roo/rules/window-shell.md` remains)                                      |
| `pnpm test:e2e`                           | 5 suites skipped — no Postgres reachable in this shell (`database-gate skipped: no Postgres reachable`; run `pnpm db:up`). Not caused by this change. |

## Docs updated with the change

- **Deferred** — [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) and
  [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1) still need their AIS-114 rows (the `features/api/`
  hooks row, the `pages/api-keys` page-state row stating query params now feed `useApiList`, and the client transport
  section). The header date bump is pending too. This is a known gap in this commit — the specs were not yet edited.

## Follow-ups (optional)

- **AIS-110** — the registry has 5 operations (`list`, `findByIdentifier`, `create`, `update`, `remove`) but the client
  service only exposes 3; `update`/`remove` methods and a “every registry entry has a client method” test are next.
- **AIS-116** — `Pagination` / `DataTable` / `EmptyState` primitives that consume the `meta.pagination` this ticket now
  exposes on `/api-keys`.
- The plan drafted an optional `api-hooks.const.ts`; query keys were threaded as params instead, so it was not created.
