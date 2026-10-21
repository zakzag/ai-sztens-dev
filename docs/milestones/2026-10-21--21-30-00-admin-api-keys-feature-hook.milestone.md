# Admin data-access foundation — API-keys feature hook (AIS-60)

**Date:** 2026-10-21 21:30
**Scope:** Phase 4 of the AIS-57 plan — the first TanStack Query layer of `apps/admin`.

## 1. Problem / feature

The admin SPA had a query client wired in `main.tsx`, but no way to read data: no
composition root, no service instance, no query keys, no error-to-text mapping. The
`api-keys` page (AIS-41) could not be built without those, and the ticket required that
the page read **only** through a hook — never `fetch` — with tests that run without a
network.

## 2. Measured data / evidence

| Check | Result |
|---|---|
| `pnpm --filter @callback/admin test` (before) | 1 test file / 1 test |
| `pnpm --filter @callback/admin test` (after) | 6 files / **46 tests**, 4.3 s |
| `pnpm --filter @callback/admin lint` | clean |
| `pnpm --filter @callback/admin build` | `tsc --noEmit` + `vite build` OK (282.95 kB js) |
| Palette / colour-literal scan of `apps/admin/src` | `0` matches |

Two type errors surfaced only in the `build` step (`tsc --noEmit`), not in `vitest`
(esbuild strips types): a `403`-literal default parameter, and a type-predicate that
narrowed a value to `never`. Both are recorded below.

## 3. Design rationale

| Decision | Why | Alternative rejected |
|---|---|---|
| `session-token.ts` owns the storage key via `read/store/clearSessionToken()` | `AuthContext` (login/logout) and the HTTP client (`getToken`) must agree on one key | repeating `TOKEN_STORAGE_KEY` in two modules |
| Composition root (`services/api-client.ts`) is the only caller of `createHttpClient` | `import.meta.env` and the token supplier stay out of hooks, so hooks can be tested with a module double | reading env inside the hook |
| Hooks return **narrow** interfaces, not `UseQueryResult` | a page cannot start to depend on `failureCount`, `dataUpdatedAt`, …; query→UI mapping stays in one place | returning the TanStack result objects |
| `invalidateQueries(API_KEYS_QUERY_KEYS.all)` then `onCreated(created)` (awaited) | the list must be fresh before the form reports success; the form reset is the caller's job | hand-patching the cache, or resetting inside the hook |
| 409 → field error via `error.status`, never message text | a translated/changed backend message must not move the error from the field to the page | `message.includes('exists')` |
| `toExpiryIso` = **local** midnight → ISO; `undefined` for an empty input, `RangeError` for a non-date | the DB column is `timestamptz`; a naive `YYYY-MM-DD` would shift the day in `Europe/Budapest`. “No expiry” must be *omitted* from the body, not sent as `null` | `new Date(str)` (parses as UTC) or `''` |
| `toErrorMessage` maps on `status` only; non-`ApiError` → generic text | technical English messages must never reach the UI, and one function keeps wording consistent | rendering `error.message` |
| Test doubles are module-level **singletons** in `src/test/mocks` | `vi.mock` factories are hoisted, so they cannot close over a per-test binding; `resetApiKeysServiceMock()` restores defaults in `beforeEach` | creating mocks inside each test file |

## 4. Implementation

| File | Change |
|---|---|
| `apps/admin/src/auth/session-token.ts` | new — key + three SSR-safe accessors |
| `apps/admin/src/auth/AuthContext.tsx` | modified — uses the accessors, local key constant removed |
| `apps/admin/src/services/api-client.ts` | new — `httpClient` + `apiKeysService` singletons, `getToken: readSessionToken` |
| `apps/admin/src/services/api-client.const.ts` | new — `DEFAULT_API_BASE_URL = '/api'` fallback |
| `apps/admin/src/vite-env.d.ts` | modified — typed `VITE_API_BASE_URL` |
| `apps/admin/src/lib/date.ts`, `date.const.ts` | new — `toExpiryIso`, `formatExpiry` + texts/locale |
| `apps/admin/src/lib/error-message.ts`, `error-message.const.ts` | new — `toErrorMessage` + per-status texts |
| `apps/admin/src/features/api-keys/api-keys.{const,interface,logic}.ts` | new — query keys, hook result types, 409 rules |
| `apps/admin/src/features/api-keys/use-api-keys.ts` | new — `useApiKeysQuery`, `useCreateApiKeyMutation` |
| `apps/admin/src/test/mocks/{api-keys,api-error,query-client}.mock.*` | new — fixtures, service double, query harness |
| `apps/admin/src/{auth,lib,features/api-keys}/*.test.*` | new — 45 tests over the branches above |

Fix 1: `createStatusError(status = HTTP_STATUS.FORBIDDEN)` inferred `status: 403`; declared
`status: number`. Fix 2: `isValidationError(error)` narrowed `error` to `never` after the
`switch`, so `error.status` was unreachable; the status is now captured in a local `const`
and compared against `HTTP_STATUS`.

## 5. Outcome and how to verify

The admin app now has one path to the backend: `page → use-* hook → apiKeysService →
httpClient`. Nothing else constructs a client, and no hook performs a request of its own.

```bash
pnpm --filter @callback/shared build
pnpm --filter @callback/api-client build
pnpm --filter @callback/admin test    # 46 tests
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
```

Manual check after AIS-41 lands: open `/api-keys`, then in DevTools confirm exactly one
`GET /api/api-keys` per mount and an `Authorization`-free request (no token stored) that
picks up the header immediately after a login.

## 6. Follow-ups

- AIS-63: the `api-keys` row of the state table in `docs/Specs/UI-Architecture.md`.
- AIS-41: the page consuming these hooks; the form reset belongs to `onCreated`.
- The API has no auth guard yet: the token supplier is wired but unused server-side.
