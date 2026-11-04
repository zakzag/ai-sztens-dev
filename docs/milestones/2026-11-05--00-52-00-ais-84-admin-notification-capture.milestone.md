# AIS-84 — Global notification capture in the admin SPA

**Date:** 2026-11-05 · **Ticket:** AIS-84 (subtask of AIS-86) · **Area:** `apps/admin`

## 1. Problem / feature

Until now every failure had to be *rendered by the code that caused it*: a page showed
`PageErrorState`, the banner showed offline/401/503, a form marked its own fields — and nothing left a
trace. The requirement was the opposite: **any** request, failure or announced write must reach the
toast stack and the log panel without a single `notify(...)` call in a form or a page, otherwise the
first forgotten call makes the system incomplete.

## 2. Evidence

- `packages/api-client` already exposed `HttpEvent` + optional `onEvent` (AIS-109), emitted on the
  network, non-2xx and parse-failure paths — so the transport needed no change.
- `@callback/notifications/react` (AIS-83) already provided `NotificationProvider` + `NotificationHost`;
  `apps/admin` had **no** dependency on the package.
- `services` must not import `app/` (`.dependency-cruiser.rules.cjs`, `no-service-to-higher-layer`),
  and `QueryClient` was created inline in `main.tsx` without any cache callbacks.

## 3. Design rationale (the two decisions that matter)

**D3 — the transport event is logged, never toasted.** An `HttpEvent` carries `method`, `path`,
`status`, `durationMs`, `outcome` — deliberately no header, token or body. It therefore also carries no
error `code` and no `issues[]`, so it cannot choose the accurate Hungarian copy (that lives in the
`code → copy` catalogue) and cannot respect `toErrorSurface`. Toasting there would put two cards on
screen for every failed write. The caches own the toast because they hold the `ApiError`.

**D4 — visibility stays a single decision.** The pre-existing classifier is reused verbatim:
`silent` → no entry, `field` → log only (the form marks the input), `banner` → log only (the banner is
persistent), `page` → log **and** toast. One failure, one visible surface.

Alternatives rejected: a `notify` call per form (the ticket's own argument — one forgotten call and the
feature is broken); toasting at the transport (double cards, wrong copy); creating the store inside the
provider (requests sent before the first render would be lost).

## 4. Implementation

| File | Change |
| ---- | ------ |
| `apps/admin/src/services/http-events.ts` (+ `.interface.ts`) | one-listener registry; the composition root reads it per request, so `services` never imports `app/` |
| `apps/admin/src/services/api-client.ts` | `onEvent: (event) => getHttpEventListener()?.(event)` |
| `apps/admin/src/app/notifications/notification.store.ts` | the single store + guarded `sessionStorage` mirror (injected store is not seeded by the provider) |
| `…/notification-events.logic.ts` (+ `.const.ts`, `.interface.ts`) | pure mapping: HTTP attempt, query failure, mutation failure, mutation success, detail builder |
| `…/notification-capture.ts` | `createHttpEventEmitter`, `createQueryCacheHandlers`, `createMutationCacheHandlers` |
| `…/app-query-client.ts` (+ `.const.ts`) | `createAppQueryClient(store)` with the unchanged `retry: 1`, no refetch on focus |
| `apps/admin/src/main.tsx` | locale → register HTTP listener → build client → render |
| `apps/admin/src/app/providers/app-providers.tsx` | `QueryClientProvider → NotificationProvider → SessionProvider` |
| `apps/admin/src/app/layout/AdminLayout.tsx` | `<NotificationHost />` as a sibling of `<main>` |
| `apps/admin/src/features/api/use-api-mutation.ts` (+ interface) | optional `mutationKey`, used as the failure detail |
| `docs/Specs/UI-Architecture.md` | §4.1.3 capture matrix + wiring order, §5 “exactly two global stores”, §7 dependency row |

Capture matrix, tests and the deviation log: [`docs/plans/2026-11-05--00-20-00-ais-84-admin-notification-capture-plan.md`](../plans/2026-11-05--00-20-00-ais-84-admin-notification-capture-plan.md).

## 5. Outcome and verification

```powershell
pnpm --filter @callback/admin test        # 384 passed / 37 files
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin build       # green; if esbuild reports a %TEMP% lock, point TEMP/TMP at a repo-local folder
pnpm quality                              # layers, dead-code, tokens, field-errors — 0 violations
```

Manual: open `/api-keys`, stop the API → one page-level toast plus one `GET /api-keys — hálózati hiba`
log entry; restore it and create a key → success toast, and the drawer's unseen badge grows with every
request.

## 6. Follow-ups

1. `logNavigation` (ticket key decision 8) — follow-up ticket, behind an explicit flag.
2. AIS-85 must choose **one** success channel per form: `useAppForm`'s `notify` or
   `meta.successMessage`; both together would double the success toast.
3. The committed `pnpm-lock.yaml` is invalid (two YAML documents) and needs a repair ticket.
