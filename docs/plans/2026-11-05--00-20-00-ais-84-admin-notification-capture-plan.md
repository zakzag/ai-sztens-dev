# AIS-84 — admin: global notification capture (QueryCache / MutationCache, HTTP `onEvent`) + host in the layout — implementation plan

**Created:** 2026-11-05 00:20 (Europe/Budapest)
**Ticket:** AIS-84 (subtask of AIS-86) · **Status:** `To Do` in Jira
**Prerequisites:** AIS-109 (`HttpEvent` + `onEvent` — **already merged**), AIS-118 (`app/` layer — merged),
AIS-79/80/81/82/83 (`@callback/notifications` core + storage + UI primitives + React bindings — merged)
**Scope:** `apps/admin` only. **No** change in `packages/api-client`, `packages/notifications` or `packages/ui`.

---

## 1. Goal

Every request, every failed query/mutation and every runtime error becomes a log entry **without a
single `notify(...)` call in a form or a page**, and the toast stack + log panel are mounted once in
the authenticated shell.

```tsx
// main.tsx — the only boot sequence
const notifier = createNotifier(notificationStore);
registerHttpEventListener(createHttpEventEmitter(notifier));
const queryClient = createAppQueryClient(notifier);   // QueryCache + MutationCache wired

<BrowserRouter>
  <App queryClient={queryClient} />
</BrowserRouter>
```

## 2. What already exists (facts, checked on the branch)

| Piece | State |
| ----- | ----- |
| `HttpClientConfig.onEvent` + `HttpEvent` | implemented in [`http-client.interface.ts`](packages/api-client/src/http-client.interface.ts:40), emitted on **all** three paths (network, non-2xx, parse) in [`http-client.ts`](packages/api-client/src/http-client.ts:251); covered by 8 tests in [`http-client.test.ts`](packages/api-client/test/http-client.test.ts:806) |
| `@callback/notifications/react` | `NotificationProvider`, `NotificationHost`, `createNotifier`, `useNotifier`, `useToastTimers` — [`src/react/index.ts`](packages/notifications/src/react/index.ts:1) |
| Provider contract | store **and** storage are injectable; an injected **store is not seeded** from `storage.load()` — the app must inject both to keep the restore path ([`notification.context.tsx`](packages/notifications/src/react/notification.context.tsx:90)) |
| Error vocabulary | `toErrorMessage` (copy) and `toErrorSurface` (silent/page/banner/field) are pure and already the single decision point ([`error-message.ts`](apps/admin/src/lib/error-message.ts:77), [`error-surface.logic.ts`](apps/admin/src/lib/error-surface.logic.ts:111)) |
| `apps/admin` deps | **no** `@callback/notifications` dependency yet ([`package.json`](apps/admin/package.json:20)) |
| Layer gate | `services` may **not** import `app/` (`no-service-to-higher-layer`, [`.dependency-cruiser.rules.cjs`](.dependency-cruiser.rules.cjs:98)) |
| `useApiMutation` | carries `meta.successMessage`, never renders it; no `mutationKey` yet ([`use-api-mutation.ts`](apps/admin/src/features/api/use-api-mutation.ts:31)) |

## 3. Decisions

| # | Decision | Why |
| - | -------- | --- |
| D1 | **No transport change.** AIS-84 only *consumes* `onEvent` | AIS-109 already shipped the hook and its tests; the ticket's api-client DoD is satisfied by that change |
| D2 | **One store instance**, created in `app/notifications/notification.store.ts` (store **and** mirror), injected into `<NotificationProvider store storage>` **and** bound into the cache callbacks via `createNotifier(store)` | Ticket key decision 1. Injecting the storage too is required: a bare injected store would skip `storage.load()` and the restored log would vanish |
| D3 | **The HTTP event is log-only** (`toast: false`) for every outcome; the toast decision belongs to the query/mutation cache callbacks | *Deviation from ticket key decision 5, on purpose:* the HTTP layer has only `status` — no `code`, no `issues`, no abort signal — so it can neither pick the accurate Hungarian copy nor respect `toErrorSurface`. Toasting there would double every mutation failure (two messages, two cards). Logging every attempt is what the panel needs |
| D4 | Cache callbacks reuse the existing classifier: `silent` → no entry at all, `field` → log only (the form marks the input), `banner` → log only (the banner is the persistent surface), `page` → log **and** toast | One failure, one visible surface — the rule that already governs tiers 1–3 (§4.1 of the spec) |
| D5 | A successful mutation logs only when `meta.successMessage` is a **non-empty** string; nothing is invented otherwise | Ticket key decision 3: a generic “saved” copy on every write is noise. The entry is created for the log, the toast carries the caller's sentence |
| D6 | `services/http-events.ts` is a tiny **listener registry** (`setHttpEventListener` / `getHttpEventListener`); `api-client.ts` passes `onEvent: (e) => getHttpEventListener()?.(e)`; the **app** registers the emitter in `main.tsx` | `services → app` is a layer violation (D4 grandfather list is closed). The registry keeps the composition root React-free and the direction `app → services` |
| D7 | `<NotificationHost />` renders in `AdminLayout` as a **sibling of `<main>`** | Every protected page gets the stack + drawer; the login page (public route) does not (ticket key decision 7) |
| D8 | Provider chain becomes `QueryClientProvider → NotificationProvider → SessionProvider`, mounted in `AppProviders` | Ticket key decision 6; the store is a prop, so the order stays explicit |
| D9 | The `QueryClient` moves from `main.tsx` into `app/notifications/app-query-client.ts` (`createAppQueryClient(notifier)`) and stays a **prop** of `<App>` | The cache callbacks need the notifier at construction time; `main.tsx` stays composition only. Defaults (`retry: 1`, `refetchOnWindowFocus: false`) are preserved verbatim |
| D10 | `logNavigation` stays **off**; no navigation logger is shipped | Ticket key decision 8, and AIS-83 D12 deferred it here explicitly. Wiring it while shipping it disabled would be dead code (`knip`); a follow-up ticket turns it on with a real flag |
| D11 | `useApiMutation` gains an optional `mutationKey`, forwarded to `useMutation`, used as the log entry's `detail` | Ticket key decision 2 expects `mutationKey` in `detail`; without the option nothing would ever set it |
| D12 | Redaction is the store's job: entries carry `method`, path, status, duration, `requestId`, `code` — never a header, token or body | `HttpEvent` has no secret field by construction (AIS-109), and `ApiError` carries no body |
| D13 | Failures dedupe themselves: same level + same copy inside the store's window bumps `repeatCount` | A retry storm must not stack ten identical cards (AIS-79 D5/D9) |

## 4. Architecture

```mermaid
flowchart TB
  subgraph services [services - no React, no app import]
    HTTP[api-client.ts] --> REG[http-events.ts registry]
  end
  subgraph app [app/notifications]
    STORE[notification.store.ts single instance + mirror]
    EVENTS[notification-events.logic.ts pure]
    CAPTURE[notification-capture.ts]
    QC[app-query-client.ts]
  end
  subgraph react [@callback/notifications/react]
    PROVIDER[NotificationProvider]
    HOST[NotificationHost]
  end
  MAIN[main.tsx] --> STORE
  MAIN --> REG
  MAIN --> QC
  QC -->|QueryCache onError / MutationCache onSuccess onError| CAPTURE
  CAPTURE --> EVENTS
  CAPTURE -->|emit| STORE
  REG -->|HttpEvent| EVENTS
  PROVIDER -->|store + storage| STORE
  LAYOUT[AdminLayout] --> HOST
  HOST --> PROVIDER
```

## 5. Files

```text
apps/admin/package.json                                   + "@callback/notifications": "workspace:*"
apps/admin/src/app/notifications/
  notification.const.ts                                   HTTP_EVENT_SEPARATOR, MUTATION_SUCCESS_TOAST_DEFAULT …
  notification.interface.ts                               CacheErrorContext, CacheSuccessContext, HttpEventEntry …
  notification-events.logic.ts                            pure: toHttpEntry, toQueryErrorEntry, toMutationErrorEntry,
                                                          toMutationSuccessEntry, toErrorDetail, toHttpDetail
  notification-events.logic.test.ts                       every branch of §7
  notification.store.ts                                   the single store + sessionStorage mirror (+ guarded window read)
  notification-capture.ts                                 createHttpEventEmitter(notifier),
                                                          createQueryCacheHandlers(notifier),
                                                          createMutationCacheHandlers(notifier)
  notification-capture.test.ts                            cache callbacks → store, end to end with a real QueryClient
  app-query-client.ts                                     createAppQueryClient(notifier): QueryClient
apps/admin/src/services/
  http-events.ts                                          listener registry (no React, no app import)
  api-client.ts                                           + onEvent: (event) => getHttpEventListener()?.(event)
apps/admin/src/app/providers/app-providers.tsx            + NotificationProvider (store, storage, includeDetails)
apps/admin/src/app/layout/AdminLayout.tsx                 + <NotificationHost /> as sibling of <main>
apps/admin/src/main.tsx                                   store → notifier → http listener → query client
apps/admin/src/features/api/use-api-mutation.interface.ts + optional mutationKey
apps/admin/src/features/api/use-api-mutation.ts           + mutationKey passthrough
apps/admin/src/test/mocks/
  notification-store.mock.ts                              in-memory store/notifier double for the admin suites
docs/Specs/UI-Architecture.md                             §4.x capture table, §5 global store note, §7 dep row
docs/history/<ts>-ais-84-admin-notification-capture.md
docs/milestones/<ts>-ais-84-admin-notification-capture.milestone.md
```

## 6. Steps

1. **Dependency** — add `@callback/notifications` to `apps/admin/package.json`, `pnpm install`.
2. **Layer seam** — `services/http-events.ts`: a module-level `HttpEventListener | null` with
   `setHttpEventListener(listener)` / `getHttpEventListener()`; `api-client.ts` passes
   `onEvent: (event) => getHttpEventListener()?.(event)`. JSDoc explains *why* the app registers.
3. **Store singleton** — `app/notifications/notification.store.ts`:
   `createNotificationStorage({ storage: readSessionStorage(), schedule: createRafScheduler(readWindow()) })`
   → `createNotificationStore({ initialEntries: storage.load() })`, exported as `notificationStore` +
   `notificationStorage`. `readSessionStorage` is try/catch (blocked storage degrades to memory);
   no bare `window` (module is imported by tests).
4. **Pure events logic** — `notification-events.logic.ts`, one responsibility per function:
   - `toHttpEntry(event: HttpEvent): EmitNotificationInput` — `2xx` → `level: 'system'`,
     `source: 'api'`, `toast: false`, message `"{METHOD} {path} — {status}"`, detail
     `"{durationMs} ms"`; `error` outcome → `level: 'error'`, `source: 'api'`, `toast: false`,
     message from `toErrorMessage`-free copy: `"{METHOD} {path} — {status|hálózati hiba}"`
     (`HTTP_EVENT_NETWORK_LABEL` for `status: null`).
   - `toQueryErrorEntry(error, queryKey): EmitNotificationInput | null` — `toErrorSurface(error)`:
     `silent` → `null`; `field`/`banner` → log only; `page` → `toast: true`. `message` =
     `toErrorMessage(error)`, `detail` = `toErrorDetail(error, queryKey)`.
   - `toMutationErrorEntry(error, mutationKey)` — same classifier, `source: 'api'`, kind
     `mutation.failure`.
   - `toMutationSuccessEntry(meta)` — `null` unless `meta?.successMessage` is a non-empty trimmed
     string; then `level: 'success'`, `source: 'form'`, `toast: true`, `message: successMessage`.
   - `toErrorDetail(error, key)` — string built from `ApiError.status`, `code`, `requestId` and the
     serialised key; never the response body.
   - `toHttpDetail(event)`.
   No React, no I/O, no `import.meta`.
5. **Capture wiring** — `notification-capture.ts`:
   - `createHttpEventEmitter(notifier)` → `(event) => notifier.emit(toHttpEntry(event))`.
   - `createQueryCacheHandlers(notifier)` → `{ onError: (error, query) => … }` — one entry per failure,
     `query.queryKey` becomes the detail; the store's dedupe handles repeats.
   - `createMutationCacheHandlers(notifier)` → `{ onSuccess, onError }`, reading
     `mutation.options.mutationKey` and `mutation.meta` (success copy).
   All three are thin: the decision lives in the pure logic file, so the tests of step 11 stay cheap.
6. **Query client factory** — `app-query-client.ts`:
   ```ts
   export function createAppQueryClient(notifier: Notifier): QueryClient
   ```
   `new QueryClient({ queryCache: new QueryCache(createQueryCacheHandlers(notifier)), mutationCache: new MutationCache(createMutationCacheHandlers(notifier)), defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })`
   — defaults copied from today's `main.tsx`, so retry/refetch behaviour does not change.
7. **Composition root** — `main.tsx`: create the notifier from the singleton store, register the HTTP
   listener, build the client with `createAppQueryClient(notifier)`; keep `configureValidationLocale('hu')`.
8. **Provider chain** — `app-providers.tsx`: `QueryClientProvider → NotificationProvider (store, storage,
   includeDetails={import.meta.env.DEV}) → SessionProvider`. Extend `AppProvidersProps` only if needed
   (the store is imported, not passed, because it must be the same instance the caches write to).
9. **Host** — `AdminLayout.tsx`: `<NotificationHost />` as a sibling of `<main>`, inside the shell so it
   survives navigation; add the note that public routes deliberately have no host.
10. **`mutationKey`** — optional `mutationKey?: QueryKey` on `UseApiMutationOptions`, forwarded to
    `useMutation({ mutationKey, … })`; expose nothing else new.
11. **Tests** (mocks in `apps/admin/src/test/mocks/`, never inline):
    - `notification-events.logic.test.ts`: 2xx → system/log-only; 4xx → error/log-only; `status: null`
      → network label; `silent` → `null`; `field` → log-only; `banner` → log-only; `page` → toast;
      success without meta → `null`; success with blank meta → `null`; success with copy → `toast: true`;
      `detail` contains `requestId` but no body.
    - `notification-capture.test.ts`: a rejected query on a real `QueryClient` lands **one** entry with
      the mapped fields; a rejected mutation does the same and carries the `mutationKey`; a successful
      mutation with `meta.successMessage` produces the success entry; without it, **no** entry; the HTTP
      emitter feeds a 4xx without a toast.
    - `AdminLayout.test.tsx`: the host renders inside the shell with a provider above it (no
      `MissingNotificationProviderError`).
    - Integration (RTL): `QueryClientProvider` + `NotificationProvider(add real store)` + `NotificationHost`,
      one rejected mutation → one error toast visible and the drawer's unseen counter increases.
12. **Docs** — `docs/Specs/UI-Architecture.md`: a §4.x table for the capture layer (which emitter
    produces which level/toast, and the `silent`/`field`/`banner`/`page` rule), the §5 note that the
    global notification store is the **only** global store beside the session store, the §7 dependency
    row for `@callback/notifications` in `apps/admin`, refreshed `**Utolsó frissítés:**` line. Then
    `docs/history/<ts>-ais-84-admin-notification-capture.md` and a milestone (decision-grade: D3
    deviation, the layer seam, the capture matrix).
13. **Jira** — comment the D3/D10 deviations with the verification output; `To Do → In Progress → Done`.
14. **Commit** — `AIS-84: feat(admin): capture queries, mutations and HTTP events in the notification log`.

## 7. Capture matrix (the contract to test)

| Source | Condition | Level | Source field | Toast |
| ------ | --------- | ----- | ------------ | ----- |
| `HttpEvent` | `outcome: 'success'` | `system` | `api` | no |
| `HttpEvent` | `outcome: 'error'` (any status, incl. `null`) | `error` | `api` | no (D3) |
| `QueryCache.onError` | `silent` (abort) | — | — | no entry |
| `QueryCache.onError` | `field` / `banner` | `error` | `api` | no |
| `QueryCache.onError` | `page` | `error` | `api` | **yes** |
| `MutationCache.onError` | `silent` | — | — | no entry |
| `MutationCache.onError` | `field` / `banner` | `error` | `api` | no |
| `MutationCache.onError` | `page` | `error` | `api` | **yes** |
| `MutationCache.onSuccess` | `meta.successMessage` non-empty | `success` | `form` | **yes** |
| `MutationCache.onSuccess` | no meta / blank copy | — | — | no entry |
| `window` `error` / `unhandledrejection` | always (AIS-83, unchanged) | `error` | `runtime` | yes |

## 8. Verification

```powershell
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
pnpm quality:layers
pnpm quality:tokens
pnpm quality:field-errors
pnpm quality:dead-code
pnpm typecheck
```

Manual: log in, open `/api-keys`, stop the API container → a page-level failure shows one toast and the
log gains one `GET … — hálózati hiba` entry; restore it, create a key → success toast, and the drawer's
unseen badge grows on every request.

## 9. Definition of done

- [ ] No form or page calls `notify` to report a *failure*; a new `useMutation` triggers the behaviour
      with no extra code.
- [ ] Network failures (`status: null`) produce an entry, not only HTTP failures.
- [ ] `onEvent` stays optional in the transport and `packages/api-client` is **untouched**.
- [ ] `services` imports nothing from `app/` (layer gate green).
- [ ] Store instance is the one the caches write to and the provider renders (asserted in the
      integration test).
- [ ] `pnpm --filter @callback/admin test|lint|build`, `pnpm quality`, `pnpm typecheck` green.
- [ ] `docs/Specs/UI-Architecture.md` §4.x/§5/§7 updated; history + milestone written; AIS-84 `Done`.

## 10. Out of scope

Router navigation logging (`logNavigation`, D10 — follow-up ticket), retrofitting `ApiKeyForm` to
`useAppForm` (AIS-85), the manual browser checklist (AIS-85), `apps/web`, any change in
`packages/notifications` or `packages/ui`, persisting the drawer's filter/open state.

## 11. Risks / follow-ups

| Risk | Mitigation |
| ---- | ---------- |
| Double success toast once AIS-85 migrates the form (both `useAppForm`'s `notify` and `meta.successMessage` could fire) | D5: only `meta.successMessage` is handled at cache level; the AIS-85 plan must pick exactly one per form — recorded as a follow-up note |
| StrictMode mounts the provider twice, re-subscribing the mirror | Store and storage live outside React, so no duplicate restore; the effect cleanup flushes and unsubscribes |
| Module-scope store touches `sessionStorage` at import time | Guarded `readSessionStorage`/`readWindow` helpers; degrades to memory (AIS-80 D13 behaviour) |
| A retry storm floods the log | `retry: 1` unchanged + store dedupe window bumps `repeatCount` (D13) |
| `knip` flags the new registry exports | They are consumed by `api-client.ts` and `main.tsx` in the same change |
| The HTTP log line duplicates the page error's meaning | It is `system`/`error` with `toast: false` in the log panel only — the visible surface stays the page/banner (D4) |
