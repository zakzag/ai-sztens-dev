# AIS-150 — Resizable log drawer panel (pointer + keyboard, `localStorage`)

**Date:** 2026-11-07 · **Ticket:** AIS-150 · **Parent:** AIS-143 · **Plan:** [`docs/plans/2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md`](../plans/2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md)

## What changed

The log drawer panel was a fixed `w-full max-w-[26rem]` surface. It now has a drag handle on its
**left** edge: the width is adjustable with the pointer **and** the keyboard, stays inside
320–720 px (default **416 px**), and is restored after a reload from `localStorage`.

### `packages/ui`

| File | Change |
| ---- | ------ |
| [`log-drawer.const.ts`](../../packages/ui/src/components/log-drawer/log-drawer.const.ts:1) | `LOG_DRAWER_WIDTH_DEFAULT` (416), `_MIN` (320), `_MAX` (720), `_STEP` (16), `_STEP_LARGE` (64), `LOG_DRAWER_RESIZE_HANDLE_LABEL`, `LOG_DRAWER_WIDTH_CSS_VAR` |
| [`log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:1) | `LogDrawerSizeRange`, `LogDrawerWidthStyle`; `LogDrawerProps` gains `width`, `widthRange`, `isResizing`, `onWidthChange`, `onResizeStart`, `onResizeEnd`, `onWidthReset` |
| [`log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:1) | pure `clampDrawerWidth`, `toWidthFromPointer`, `toWidthFromKey` (4th param = `Shift`), `toWidthStyle` |
| [`log-drawer.variants.ts`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:1) | panel: `w-full md:w-[var(--log-drawer-width)]` + `isResizing` variant (`transition-none`); new `logDrawerResizeHandleVariants`, `logDrawerResizeRailVariants` |
| [`LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:1) | `role="separator"` handle: pointer capture, `pointerup`/`pointercancel`, keyboard, double-click reset |

### `packages/notifications`

| File | Change |
| ---- | ------ |
| [`notification-react.interface.ts`](../../packages/notifications/src/react/notification-react.interface.ts:1) | `LogDrawerController` + `width`/`isResizing`/`widthRange`/`beginResize`/`updateWidth`/`endResize`/`resetWidth`; new `LogDrawerWidthStorage` (+ options); provider/context gain `widthStorage` |
| [`notification-react.const.ts`](../../packages/notifications/src/react/notification-react.const.ts:1) | `LOG_DRAWER_WIDTH_STORAGE_KEY` (`aisztens.logdrawer.width.v1`), `LOG_DRAWER_WIDTH_RANGE` built **from** the `@callback/ui` numbers |
| [`notification-react.logic.ts`](../../packages/notifications/src/react/notification-react.logic.ts:1) | `parseStoredDrawerWidth`, `serializeDrawerWidth` |
| [`log-drawer-width.storage.ts`](../../packages/notifications/src/react/log-drawer-width.storage.ts:1) | new `createLogDrawerWidthStorage` — silent degradation, never throws |
| [`notification.context.tsx`](../../packages/notifications/src/react/notification.context.tsx:1) | guarded `readLocalStorage()` + `useState` lazy init of the width storage |
| [`use-notifications.ts`](../../packages/notifications/src/react/use-notifications.ts:1) | `useLogDrawer` owns the width; one effect persists it only while `isResizing === false` |
| [`NotificationHost.tsx`](../../packages/notifications/src/react/NotificationHost.tsx:1) | forwards the new props |

## Decisions

- **D1** Width state lives in the controller (`useState`), never in `packages/ui` and never in a
  global store (`UI-Architecture.md` §5).
- **D2** `localStorage`, not `sessionStorage`: a UI preference must survive a browser restart.
- **D3** Below `md` the panel is full width **via CSS**; the handle is `hidden md:flex`.
- **D4** The numbers are declared **once**, in `@callback/ui`; `LOG_DRAWER_WIDTH_RANGE` only binds
  them into the shape the controller needs.
- **D5** Persistence happens when the gesture ends (`endResize`, a key press, `resetWidth`) — never
  per `pointermove`.
- **D6** `LogDrawer` needed two callbacks beyond the ticket's prop list (`onResizeStart`,
  `onResizeEnd`): `isResizing` cannot be flipped by `onWidthChange` alone.

## Tests

`packages/ui`: new `log-drawer.logic.test.ts` (19 cases) and a `LogDrawer — resizable panel` block in
`log-drawer.test.tsx` (14 cases); new `test/mocks/pointer-capture.mock.ts` (capture stubs + a
`MouseEvent`-based `dispatchPointerEvent`, because this jsdom build has no `PointerEvent` and drops
`clientX` from `fireEvent.pointerMove`).

`packages/notifications`: new `log-drawer-width-storage.test.ts` (8), `parseStoredDrawerWidth` /
`serializeDrawerWidth` in `notification-react.logic.test.ts` (8), a `drawer width` block in
`use-notifications.test.tsx` (10), a host wiring test, and
`test/mocks/react/log-drawer-width-storage.mock.ts`.

## Result

- `pnpm --filter @callback/ui test` → 416 tests green (56 of them in the two log-drawer suites).
- `pnpm --filter @callback/notifications test` → 228 tests green.
- `pnpm --filter @callback/ui typecheck` and `pnpm --filter @callback/notifications typecheck` green.

## Docs

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) — header banner + `AIS-150`
  changelog paragraph, the `LogDrawer` primitive row (new props + resize contract), a §4.1 paragraph
  on the separator, and a new §5 state-plan row for the drawer width.
- [`docs/milestones/2026-11-07--02-11-00-log-drawer-resizable-panel.milestone.md`](../milestones/2026-11-07--02-11-00-log-drawer-resizable-panel.milestone.md:1) —
  decision-grade record; AIS-154 cross-links it in the parent close-out.
