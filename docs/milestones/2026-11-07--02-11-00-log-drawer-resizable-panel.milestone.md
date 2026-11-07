# Milestone — resizable log drawer panel (AIS-150)

**Date:** 2026-11-07 · **Ticket:** AIS-150 (parent AIS-143) · **Plan:** `docs/plans/2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md`

## 1. Problem / feature

The admin log drawer ([`LogDrawer`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:1)) was a
fixed-width panel (`w-full max-w-[26rem]`). A stack trace, a request URL or a long message did not fit,
and there was no way to widen the panel. The feature: a drag handle on the panel's left edge, an
adjustable width between 320 and 720 px (default 416 px), keyboard control, and a width that survives
a reload.

## 2. Measured data / evidence

- Before: the only width class was `max-w-[26rem]` = 416 px, on every viewport.
- The panel must stay **non-modal** (AIS-82 D3) and must never cover the page it annotates, so the
  upper bound is a product decision, not a viewport calculation.
- jsdom in this repo has **no `PointerEvent` constructor**: `fireEvent.pointerMove(el, { clientX })`
  drops the init, the handler sees `clientX: undefined`, and the geometry falls back to the default
  width. Two pointer tests failed that way before the test harness switched to a bubbling
  `MouseEvent` with a patched `pointerId`.

## 3. Root cause / design rationale

| # | Decision | Why |
| - | -------- | --- |
| D1 | Width state in the `useLogDrawer` controller (`useState`), not in `packages/ui`, not in a global store | `UI-Architecture.md` §5 allows only the session and notification stores to be global; the width is transient page UI owned by one controller. The primitive stays presentational |
| D2 | `localStorage`, not `sessionStorage` | A width is a UI preference: it must survive a browser restart. The log mirror keeps `sessionStorage` — the two storages are deliberately separate collaborators |
| D3 | Below `md`: full width, solved by CSS (`w-full md:w-[var(--log-drawer-width)]`), handle `hidden md:flex` | No `matchMedia` listener, no resize observer, no first-paint flash — and a viewport without room cannot drag at all |
| D4 | The numbers (416/320/720/16/64) are declared **once**, in `packages/ui` | `@callback/notifications` already depends on `@callback/ui`, so importing them is legal and the geometry can never drift from the stored value |
| D5 | Persist only when a gesture **ends** | `updateWidth` runs on every `pointermove`; a `setItem` per move would be ~60 writes/second of the same key. One effect writes while `isResizing === false`, so drag, keyboard and reset share one path |
| D6 | Two callbacks beyond the ticket: `onResizeStart`, `onResizeEnd` | `isResizing` is what removes `transition-transform` during a drag, and only the pointer gesture knows when it starts and ends |
| D7 | No new error class for the width storage | `load`/`save` must degrade silently (blocked/private storage) — the AIS-80 D13 contract. Every `catch` carries a comment saying why it is not rethrown |

## 4. Solution / implementation

- [`log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:1) — width
  constants + handle label + `--log-drawer-width` property name.
- [`log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:1) —
  `LogDrawerSizeRange`, `LogDrawerWidthStyle`, seven new `LogDrawerProps`.
- [`log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:1) — pure
  `clampDrawerWidth` (non-finite → `initial`), `toWidthFromPointer` (right-edge panel),
  `toWidthFromKey`, `toWidthStyle`.
- [`log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:1) —
  CSS-variable width, `isResizing` variant, separator + rail recipes (12 px target, 6 px band).
- [`LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:1) — pointer capture,
  `pointercancel`, keyboard, double-click reset, `aria-valuenow/min/max`.
- [`notification-react.interface.ts`](../../packages/notifications/src/react/notification-react.interface.ts:1)
  / [`notification-react.const.ts`](../../packages/notifications/src/react/notification-react.const.ts:1)
  / [`notification-react.logic.ts`](../../packages/notifications/src/react/notification-react.logic.ts:1)
  — controller ports, `LOG_DRAWER_WIDTH_RANGE`, storage key, parse/serialise.
- [`log-drawer-width.storage.ts`](../../packages/notifications/src/react/log-drawer-width.storage.ts:1)
  — new injectable `StorageLike` adapter.
- [`notification.context.tsx`](../../packages/notifications/src/react/notification.context.tsx:1),
  [`use-notifications.ts`](../../packages/notifications/src/react/use-notifications.ts:1),
  [`NotificationHost.tsx`](../../packages/notifications/src/react/NotificationHost.tsx:1) — provider
  wiring, hook state, host props.

## 5. Outcome and how to verify

The panel drags from its left edge, clamps to 320–720 px, remembers the width, and is keyboard
operable. Below `md` it is full width with no visible handle.

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/notifications test
pnpm typecheck
pnpm quality
```

Manual check: open the drawer in the admin app, drag the left edge (the panel must not animate against
the pointer), press `ArrowLeft`/`ArrowRight`/`Shift`/`Home`/`End`, double-click the handle, then reload
— the width must come back. Inspect `localStorage['aisztens.logdrawer.width.v1']`. Shrink the viewport
below `md`: the panel fills the screen and the handle disappears.

## 6. Follow-ups

- AIS-151/AIS-153 (sibling tickets) rewrite `log-drawer.interface.ts` and `LogEntryRow.tsx`; AIS-150
  stayed additive and left the row component untouched to keep the merge clean.
- AIS-154 (parent close-out) carries the aggregated QA checklist and the manual resize checks.
