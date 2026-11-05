# 2026-11-05 00:52 — AIS-84: admin notification capture (QueryCache/MutationCache + HTTP `onEvent`)

## What was built

The admin SPA now produces log entries and toasts **without any page or form calling `notify`**:

| Area | Change |
| ---- | ------ |
| Transport consumer | `services/http-events.ts` — a one-listener registry (`setHttpEventListener` / `getHttpEventListener`) that the composition root passes to `createHttpClient({ onEvent })`. The registry exists because `services` may not import `app/` (`no-service-to-higher-layer`) |
| Single store | `app/notifications/notification.store.ts` — the one `NotificationStore` + its guarded `sessionStorage` mirror, created outside React so the cache callbacks and the HTTP listener can write **before** the first render |
| Pure mapping | `app/notifications/notification-events.logic.ts` (+ `.const.ts`, `.interface.ts`) — `toHttpEntry`, `toQueryErrorEntry`, `toMutationErrorEntry`, `toMutationSuccessEntry`, `toErrorDetail`, `readSuccessMessage` |
| Adapters | `app/notifications/notification-capture.ts` — `createHttpEventEmitter`, `createQueryCacheHandlers`, `createMutationCacheHandlers` |
| Query client | `app/notifications/app-query-client.ts` — `createAppQueryClient(store)`, same defaults as before (`retry: 1`, `refetchOnWindowFocus: false`) |
| Composition | `main.tsx`: locale → HTTP listener → query client → render; `AppProviders`: `QueryClientProvider → NotificationProvider → SessionProvider`; `AdminLayout`: `<NotificationHost />` as a sibling of `<main>` |
| Feature hook | `useApiMutation` accepts an optional `mutationKey`, used as the failure entry's `detail` |

## Decisions (detail in the plan file)

- **D3 — the transport event is log-only.** `HttpEvent` has a status but no code/`issues[]`, so it can
  neither pick the right Hungarian copy nor respect `toErrorSurface`. Toasting there would double every
  failed write. The query/mutation caches own the toast.
- **D4 — visibility is unchanged:** `silent` → no entry, `field`/`banner` → log only,
  `page` → log **and** toast.
- **D5 —** a successful mutation toasts only when `meta.successMessage` is a non-empty string.
- **D10 —** `logNavigation` stayed out of scope (ticket key decision 8); a follow-up ticket turns it on
  behind a flag rather than shipping a permanently disabled logger.

## Tests

New: `notification-events.logic.test.ts` (20), `notification-capture.test.ts` (10),
`notification-capture.integration.test.tsx` (2 — real store + provider + host: a failed query shows an
error toast and leaves an unseen entry). `AdminLayout.test.tsx` gained two cases (host mounted, missing
provider throws). Mocks: `notification-store.mock.ts`, `notification-provider.mock.tsx`; the shared
render helpers (`app-router.mock.tsx`, `render-with-providers.tsx`) now include the notification
provider, so a component test inherits the production order.

## Verification

```text
pnpm --filter @callback/admin test          384 passed (37 files)
pnpm --filter @callback/admin lint          clean
pnpm --filter @callback/admin typecheck     clean
pnpm --filter @callback/admin build         green (483 modules)
pnpm quality                                layers / dead-code / tokens / field-errors — 0 violations
```

## Environment notes (not code)

- The committed `pnpm-lock.yaml` is **already broken** (`two YAML documents`); pnpm reports
  `Ignoring broken lockfile` and resolves fresh. It was left as it is — fixing it is a separate task.
- `apps/admin`'s dependency addition forced a full `node_modules` reinstall; the running dev stack had
  to be stopped because it held `esbuild.exe` / `lightningcss` / `rollup` native binaries open
  (`EPERM`). The dev stack was **not** restarted afterwards.
- `vite build` failed once with `esbuild ... Temp ... Access is denied` (a Windows/AV lock on
  `%TEMP%`). Re-running with `TEMP`/`TMP` pointed at a repo-local folder made it green — no code
  change was involved.
- `ApiKeyForm.test.tsx` typed garbage twice in full-suite runs (`Va`, `v`, `psik -ssttaaggien-g42`)
  and passed in isolation and in the final full run: a pre-existing `userEvent.type` timing flake, not
  a behavioural regression of this change.

## Follow-ups

1. Router navigation logging (behind a flag).
2. AIS-85 must pick **one** success channel per form: either `useAppForm`'s `notify` or
   `meta.successMessage`, never both, otherwise the success toast appears twice.
3. Repair `pnpm-lock.yaml`.
