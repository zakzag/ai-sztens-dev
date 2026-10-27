# Frontend notification + live log system — architecture decision

**Date:** 2026-10-22 · **Status:** plan agreed, implementation pending
**Plan:** [`docs/plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md`](../plans/2026-10-22--15-40-00-frontend-notification-and-log-system-plan.md:1)

## 1. Problem / feature

Every page of the admin SPA needs one place to report outcomes: form submits, API failures and
runtime errors. Today each form invents its own feedback (inline `Alert` + local state), nothing
is retained, and there is no way to see what the app actually did. The request was a global
notification system where notifications **and** system messages live in a single, UI-independent
store, rendered as bottom-right stacked toasts plus a hidden, arrow-activated live log drawer with
"load older" pagination.

## 2. Evidence / current state

| Fact | Consequence |
|---|---|
| No toast library, no `zustand` installed | No state model to reuse; the store is ours to define |
| `ApiKeyForm` reports success via `mutation.isSuccess` + `Alert` | Feedback dies with the component; nothing is logged |
| `QueryClient` is created in `main.tsx` | One place can observe every mutation/query globally |
| `services/api-client.ts` is the only composition root | HTTP telemetry can be injected without React in `packages/api-client` |
| `apps/web` uses raw `slate-*` classes, no token import | It cannot host token-styled UI yet |

## 3. Design rationale (alternatives considered)

| Option | Why rejected / chosen |
|---|---|
| **In-house store + in-house UI (chosen)** | The log store is required in every option; a library would add a *second* authoritative toast list that must be reconciled on dismiss/clear. Sonner is itself an observer store plus one subscriber, so the pattern is identical — only animation polish differs |
| Sonner as renderer | Excellent stacking motion (~11 KB), but mirrored state and markup styled by class overrides instead of `packages/ui` recipes |
| `react-hot-toast` | Tiny and headless, but linear layout; the stack CSS would be written by us anyway |
| `react-toastify` | ~42 KB, mandatory CSS import, palette-driven defaults |

Layout: a new framework-free `packages/notifications` package (core + React bindings, React as a
peer) so the store is importable from non-React code, while `packages/ui` keeps its documented
contract — presentational primitives only. Import direction stays one-way:
`apps → notifications(react) → notifications(core)`, `notifications(react) → ui`, and `ui` never
imports notifications.

Agreed behaviour: 3 visible toasts, 4 s success/info, 6 s warning, sticky error, hover and
tab-hidden pause, 2 s duplicate suppression; drawer with 20 entries initially, +50 per load,
level filters, clear, `Escape` close, non-modal.

Capture is three-tiered and additive: explicit `notify.*` calls, global TanStack Query cache
callbacks, an HTTP `onEvent` hook, plus `error`/`unhandledrejection` listeners. The log mirrors to
`sessionStorage` (cap 200, toasts never persisted) and is restored synchronously at provider mount;
secrets (`authorization`, `token`, `password`, `apiKey`, `secret`) are redacted on every path.

## 4. Implementation (planned work items)

| File / area | Change |
|---|---|
| `packages/notifications` | New package: interfaces, consts, pure logic, observer store, injected storage adapter, React provider/hooks/facade/host |
| `packages/ui/src/components/toast/*`, `.../log-drawer/*` | New presentational `Toast`, `ToastStack`, `LogDrawer`, `LogEntryRow` with CVA variants |
| `packages/api-client/src/http-client.interface.ts` | Optional `onEvent?: (event: HttpEvent) => void` (no React) |
| `apps/admin/src/main.tsx` | Provider + `QueryCache`/`MutationCache` callbacks |
| `apps/admin/src/App.tsx` | `<NotificationHost />` inside `ProtectedLayout` |
| `apps/admin/src/services/api-client.ts` | Inject `onEvent` into `createHttpClient` |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx` | Emit toasts instead of the inline success `Alert` |
| `docs/Specs/UI-Architecture.md` | Primitive rows, dependency table, page state plan, notification section |

## 5. Outcome and how to verify

Once implemented: one toast stack and one log drawer on every admin route, both fed by the same
store; failures from any current or future form appear without per-form wiring; the log survives a
reload.

```bash
pnpm --filter @callback/notifications test
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" apps/admin/src
```

Manual: submit the API key form twice (success + 409) → two stacked toasts, error sticky; hover a
toast → its timer pauses; open the edge tab → both entries, newest first, unseen badge reset;
reload → log restored, no toasts resurrected; trigger a 500 → error toast plus an `api` entry with
status, query-stripped URL and duration, nothing sensitive.

## 6. Follow-ups

- `apps/web`: mount the provider after that app is migrated to `@callback/ui` tokens.
- Navigation logging exists behind `logNavigation: false` — enable only if requested.
- No momentum swipe-to-dismiss, no log export/copy, no severity-based log filtering persistence.
- Apply-log entries are capped at 500 in memory / 200 on disk; a longer history needs a server-side
  sink.
