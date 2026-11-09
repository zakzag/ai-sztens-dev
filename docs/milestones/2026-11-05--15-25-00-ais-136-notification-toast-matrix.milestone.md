# AIS-136 — the notification toast matrix and the persistent drawer handle

**Date:** 2026-11-05 · **Ticket:** AIS-136 · **Scope:** `packages/ui`, `apps/admin`, `docs/Specs`
**Status:** done — unit and wiring tests green, manual browser checklist open

## 1. Problem

The notification subsystem (AIS-79…AIS-85) was complete but three behaviours stopped it from being
*automatic*:

1. `LogDrawer` rendered its edge handle only while **collapsed**, so once opened the only ways back
   were the `✕` in the header and `Escape`.
2. `toFailureEntry` set `toast: surface === 'page'`, so `banner` failures (`401`, `503`, offline)
   were log-only: the user saw the banner but no announcement of the moment the failure happened.
3. A render crash reached `PageErrorState` and `console.error` only — no log entry, no toast, so a
   component failure stayed invisible to anyone not looking at that page.
4. `ApiKeyEditForm` had no `notify` port, so a successful `PATCH` produced no toast and no log entry.

## 2. Measured data

```text
packages/ui/src/components/log-drawer/LogDrawer.tsx:77    {isOpen ? null : (<button …>)}   ← handle only while collapsed
apps/admin/src/app/notifications/notification-events.logic.ts:279   toast: surface === 'page'
apps/admin/src/app/error/AppErrorBoundary.tsx:48           componentDidCatch → console.error only
apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.tsx:41     useAppForm({…}) without `notify`
```

Existing tests pinned the old behaviour, which is why they changed in this story:
`notification-events.logic.test.ts` (“logs without a toast when the banner already speaks”),
`notification-capture.test.ts` (banner without a toast), `log-drawer.test.tsx` (handle only when closed).

## 3. Root cause / design rationale

The visibility rule was written when a *banner* failure already had a speaker, so a second surface
looked like duplication. That reasoning holds for a **field** error — the input keeps focus and shows
the message — but not for a banner: the banner expresses a persistent *condition* (offline, expired
session, maintenance) that survives a dismissed toast, while the toast marks the *moment*. Both are
needed, so the rule became a total function of the surface.

The drawer handle could not simply be rendered inside the panel: the collapsed panel is
`pointer-events-none`, so a handle inside it would be unclickable in exactly the state that needs it.
It is therefore a sibling **after** the panel. It also never moves (`right-0`): moving it next to the
open panel needs a viewport-dependent offset and can push it off-screen on a narrow viewport, so the
open panel reserves a right gutter instead.

`AppErrorBoundary` is a class component, so it cannot use a hook; the DI rule forbids importing the
store singleton inside it. The port is injected by `App.tsx`, which keeps the boundary testable
without a store and makes the `import.meta.env.DEV` stack decision a build-time constant.

## 4. Solution / implementation

| File | Change |
| ---- | ------ |
| `packages/ui/src/components/log-drawer/log-drawer.const.ts` | handle glyphs, caption, header-close label |
| `packages/ui/src/components/log-drawer/log-drawer.logic.ts` | `toLogDrawerHandleLabel(unseenCount, isOpen)` |
| `packages/ui/src/components/log-drawer/log-drawer.variants.ts` | `isOpen` handle variant, `LOG_DRAWER_HANDLE_GUTTER` on header/list/footer |
| `packages/ui/src/components/log-drawer/LogDrawer.tsx` | one always-mounted handle, panel first, gutter respected |
| `packages/ui/src/components/log-drawer/log-drawer.interface.ts` | `onToggle`: both directions; badge state-independent |
| `packages/ui/src/index.ts` | exports renamed/added |
| `apps/admin/src/app/notifications/notification-events.logic.ts` | `toFailureToast(surface)`, used by `toFailureEntry` |
| `apps/admin/src/app/notifications/runtime-error.ts` *(new)* | `createRuntimeErrorEmitter(store, includeDetails)` |
| `apps/admin/src/app/error/AppErrorBoundary.tsx` + `.interface.ts` | injected `onError` port, guarded call |
| `apps/admin/src/App.tsx` | emitter built once from `notificationStore` |
| `apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.tsx` | `useNotifier()` + success message |
| `docs/Specs/UI-Architecture.md`, `Forms-and-Validation.md`, `API-Convention.md`, `New-Admin-Page.md` | matrix, handle, never-wire-per-page |

Owner decision **AIS136-D1**: the detail page keeps its success `Alert` **and** gains the toast —
two intentional success surfaces. The ticket's “no toast for a stale write” could not hold: `409
STALE_WRITE` has no `fieldMessage`, so it classifies as `page` and toasts; the inline-only case is a
`422` with `issues[]`.

## 5. Outcome and how to verify

* One arrow handle in both states, `aria-expanded` + `aria-controls`, flipping glyph and name, badge
  in both states; `✕` and `Escape` still close; panel stays non-modal.
* `field` → log only; `banner` / `page` → log **and** toast; `silent` → nothing; render crash →
  `PageErrorState` + one `runtime` entry + one toast.

```bash
pnpm --filter @callback/ui test              # 344 passed
pnpm --filter @callback/notifications test   # 201 passed
pnpm --filter @callback/admin test           # 409 passed
pnpm lint && pnpm typecheck && pnpm quality  # all green
```

Manual (no admin e2e harness): the eight-step browser checklist is recorded in
[`docs/history/2026-11-05--15-25-00-ais-136-admin-notification-polish.md`](../history/2026-11-05--15-25-00-ais-136-admin-notification-polish.md).

## 6. Follow-ups

* The manual checklist still has to be walked through against `pnpm dev` before the ticket closes.
* `AppErrorBanner` (tier 3) and the new toast coexist by design (`D2`); if a future design review
  wants one surface back, remove the toast for `banner` — never the banner, which owns the
  “log in again” action.
* `AIS-135` (the `new-resource` scaffold) must **not** generate notification wiring in pages: the host
  lives in `AdminLayout`, the store in `app/notifications`.
