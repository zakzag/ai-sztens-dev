# AIS-150 — Resizable log drawer panel (pointer + keyboard, 320–720 px, `localStorage`)

**Date:** 2026-11-07 · **Ticket:** AIS-150 · **Parent:** AIS-143 (log drawer details) ·
**Parallel siblings:** AIS-151 (core details field), AIS-152 (`HttpEvent` details), AIS-153 (collapsible row), AIS-154 (parent close-out)

## Goal

The log drawer panel is a fixed `w-full max-w-[26rem]` surface today
([`logDrawerPanelVariants`](packages/ui/src/components/log-drawer/log-drawer.variants.ts:40)). It gets a
drag handle on its **left** edge: the width is adjustable with the pointer **and** the keyboard,
stays inside 320–720 px (default 416 px), and is restored after a reload from `localStorage`.

`LogDrawer` stays **presentational**: it owns no width state and reads no storage. The width lives in
the `useLogDrawer` controller (`@callback/notifications`) — the same place the open/filter/paging
state already lives (`AIS-83 D7`, `UI-Architecture.md` §5).

## Decisions

| #   | Decision                                                                                                             | Why                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Width state lives in `useLogDrawer` (`useState`), never in `packages/ui` and never in a global store                   | `UI-Architecture.md` §5 allows only the session store and the notification store to be global; the panel width is transient page UI owned by one controller                                             |
| D2  | Persistence in `localStorage`, not `sessionStorage`                                                                   | This is a UI **preference**, not session data — it must survive a browser restart (the notification mirror keeps `sessionStorage`, unchanged)                                                           |
| D3  | `md`-below full width is solved by **CSS** (`w-full` + `md:w-[var(--log-drawer-width)]`), not a JS media query        | No resize observer, no matchMedia listener, no hydration flash; the handle itself is `hidden md:flex`, so a viewport without room cannot drag at all                                                    |
| D4  | **Single source of numbers:** `LOG_DRAWER_WIDTH_DEFAULT/MIN/MAX` and both step sizes are declared once in `packages/ui`; `notification-react.const.ts` only builds a range object out of them | The ticket listed both constant sets; duplicating the numbers invites drift. `@callback/ui` is already a dependency of `@callback/notifications`, so the import direction stays legal                    |
| D5  | Width is **persisted only when the gesture ends**: `endResize`, a keyboard change, `resetWidth` — never per `pointermove` | A `setItem` per mousemove is ~60 writes/second of the same key. Implemented with one effect that writes while `isResizing === false`, so mouse, keyboard and reset all share one write path           |
| D6  | `LogDrawer` gets **two extra callbacks** (`onResizeStart`, `onResizeEnd`) beyond the ticket's prop list                | `isResizing` is what suppresses `transition-transform` during a drag, and only the pointer gesture knows when it starts/ends. `onWidthChange` alone cannot flip that state                               |
| D7  | Mocks go to `packages/ui/test/mocks/` and `packages/notifications/test/mocks/` (not `src/test/mocks/`)                | Repo convention (`react.coding-standards.md` §1/§10); the ticket's path does not exist in this repo                                                                                                     |
| D8  | No new error class for the width storage                                                                             | `load`/`save` must degrade silently (blocked/private storage) — the same contract AIS-80 D13 established for the notification mirror. Each `catch` carries a comment saying why it is not rethrown     |
| D9  | `LogEntryRow` is **not touched**                                                                                     | AIS-153 rewrites that file; keeping AIS-150 out of it removes a guaranteed merge conflict                                                                                                              |

## Steps — `packages/ui`

1. **`log-drawer.const.ts`** (numbers only here, never inline):
   `LOG_DRAWER_WIDTH_DEFAULT = 416`, `LOG_DRAWER_WIDTH_MIN = 320`, `LOG_DRAWER_WIDTH_MAX = 720`,
   `LOG_DRAWER_WIDTH_STEP = 16`, `LOG_DRAWER_WIDTH_STEP_LARGE = 64`,
   `LOG_DRAWER_RESIZE_HANDLE_LABEL = 'Naplópanel szélességének állítása'`,
   `LOG_DRAWER_WIDTH_CSS_VAR = '--log-drawer-width'` (shared by the inline style and the variant, so the
   two can never disagree).

2. **`log-drawer.interface.ts`**
   - `export interface LogDrawerSizeRange { readonly min: number; readonly max: number; readonly initial: number }`
   - `export type LogDrawerWidthStyle = CSSProperties & Readonly<Record<typeof LOG_DRAWER_WIDTH_CSS_VAR, string>>`
     (named type — no inline object type, no `as` cast).
   - `LogDrawerProps` gains `width: number`, `widthRange: LogDrawerSizeRange`, `isResizing: boolean`,
     `onWidthChange: (next: number) => void`, `onResizeStart: () => void`, `onResizeEnd: () => void`,
     `onWidthReset: () => void` — all `readonly`.

3. **`log-drawer.logic.ts`** — pure, one responsibility per function:
   - `clampDrawerWidth(value: number, range: LogDrawerSizeRange): number` — non-finite (`NaN`,
     `±Infinity`) → `range.initial` clamped into the range; otherwise `Math.min(max, Math.max(min, value))`.
   - `toWidthFromPointer(clientX: number, viewportWidth: number, range: LogDrawerSizeRange): number` —
     `clampDrawerWidth(viewportWidth - clientX, range)` (panel is pinned to the right edge).
   - `toWidthFromKey(key: string, current: number, range: LogDrawerSizeRange, isShiftPressed = false): number` —
     `ArrowLeft` → `+step` (panel grows leftwards), `ArrowRight` → `-step`, step is
     `LOG_DRAWER_WIDTH_STEP` or `LOG_DRAWER_WIDTH_STEP_LARGE` with `Shift`, `Home` → `min`, `End` → `max`,
     anything else → `current` unchanged. The optional 4th parameter is how `Shift` arrives — the ticket's
     three-argument signature cannot express it.
   - `toWidthStyle(width: number): LogDrawerWidthStyle` — `{ [LOG_DRAWER_WIDTH_CSS_VAR]: \`${width}px\` }`.

4. **`log-drawer.variants.ts`**
   - `logDrawerPanelVariants` → cva with an `isResizing` variant: base loses `max-w-[26rem]`, gets
     `w-full md:w-[var(--log-drawer-width)]`; `isResizing: true` → `transition-none`,
     `isResizing: false` (default) → `transition-transform duration-base ease-neu`.
   - new `logDrawerResizeHandleVariants`: `absolute inset-y-0 left-0 hidden w-3 cursor-col-resize touch-none items-center justify-center md:flex`,
     `transition-shadow duration-fast`, `focus-visible:border-border-focus focus-visible:shadow-focus-ring focus-visible:outline-none`.
   - new `logDrawerResizeRailVariants` (the visible 6 px strip, `aria-hidden`, token classes only:
     `h-full w-1.5 rounded-pill bg-border-hairline` + `group-hover:bg-border-strong`) so the hit target is
     12 px while the visible band stays thin.

5. **`LogDrawer.tsx`**
   - new props destructured; `const widthStyle = toWidthStyle(width)` applied to the `<aside>`.
   - Handle rendered **inside** the panel (panel content already mounts only while open), before the header:
     `role="separator"`, `aria-orientation="vertical"`, `aria-label={LOG_DRAWER_RESIZE_HANDLE_LABEL}`,
     `aria-valuenow={width}`, `aria-valuemin={widthRange.min}`, `aria-valuemax={widthRange.max}`, `tabIndex={0}`.
   - `onPointerDown` → `onResizeStart()` + `event.currentTarget.setPointerCapture(event.pointerId)`;
     `onPointerMove` → `onWidthChange(toWidthFromPointer(event.clientX, window.innerWidth, widthRange))`;
     `onPointerUp` / `onPointerCancel` → `releasePointerCapture` + `onResizeEnd()`.
   - `onKeyDown` → `toWidthFromKey`, `event.preventDefault()` only when the width actually changes.
   - `onDoubleClick` → `onWidthReset()`.

6. **`packages/ui/src/index.ts`** — export the new constants, `clampDrawerWidth`, `toWidthFromPointer`,
   `toWidthFromKey`, `toWidthStyle`, `logDrawerResizeHandleVariants`, `logDrawerResizeRailVariants`,
   and the types `LogDrawerSizeRange`, `LogDrawerWidthStyle`. `packages/ui` still imports **nothing** from
   `@callback/notifications`.

## Steps — `packages/notifications`

7. **`notification-react.interface.ts`**
   - `LogDrawerController` gains `width: number`, `isResizing: boolean`, `widthRange: LogDrawerSizeRange`,
     `beginResize(): void`, `updateWidth(next: number): void`, `endResize(): void`, `resetWidth(): void`.
   - new `LogDrawerWidthStorage { load(): string | null; save(width: number): void }` and
     `LogDrawerWidthStorageOptions { storage?: StorageLike | null; key?: string }` (reuses the existing
     `StorageLike`).
   - `NotificationProviderProps.widthStorage?`, `NotificationContextValue.widthStorage`.

8. **`notification-react.const.ts`**
   - `LOG_DRAWER_WIDTH_STORAGE_KEY = 'aisztens.logdrawer.width.v1'`.
   - `LOG_DRAWER_WIDTH_RANGE: LogDrawerSizeRange` built from the imported `@callback/ui` constants (D4).

9. **`notification-react.logic.ts`** (pure)
   - `parseStoredDrawerWidth(raw: string | null, range): number` — `null`/`''`/`'abc'`/non-finite →
     `range.initial`; `'-5'` → `range.min`; `'99999'` → `range.max`.
   - `serializeDrawerWidth(width: number): string` — round-trips through `parseStoredDrawerWidth`.

10. **new `src/react/log-drawer-width.storage.ts`** — `createLogDrawerWidthStorage(options)`:
    `load()` returns `null` without a storage and on a throwing `getItem`; `save(width)` is a silent no-op
    when the storage is missing or throws (`serializeDrawerWidth` reused, no second serialisation).

11. **`notification.context.tsx`**
    - add `readLocalStorage()` next to `readSessionStorage()` (same guarded pattern).
    - `[widthStorage] = useState(() => injected ?? createLogDrawerWidthStorage({ storage: readLocalStorage() }))`.
    - forward it in the context value + memo deps.

12. **`use-notifications.ts` → `useLogDrawer`**
    - `width` via lazy `useState(() => parseStoredDrawerWidth(widthStorage.load(), LOG_DRAWER_WIDTH_RANGE))`.
    - `isResizing` via `useState(false)`; `beginResize` → `true`, `endResize` → `false`.
    - `updateWidth(next)` → `setWidth(clampDrawerWidth(next, LOG_DRAWER_WIDTH_RANGE))` (no storage write).
    - `resetWidth()` → `setWidth(initial)` (the persistence effect writes it).
    - one `useEffect` writes `widthStorage.save(width)` **only while `isResizing === false`** (D5).
    - the returned `useMemo` object and its dependency list gain all new values.

13. **`NotificationHost.tsx`** — forward `width`, `widthRange`, `isResizing`, `onWidthChange`,
    `onResizeStart`, `onResizeEnd`, `onWidthReset` to `LogDrawer`.

14. **`src/react/index.ts`** — export `createLogDrawerWidthStorage`, `parseStoredDrawerWidth`,
    `serializeDrawerWidth`, `LOG_DRAWER_WIDTH_STORAGE_KEY`, `LOG_DRAWER_WIDTH_RANGE`, and the types
    `LogDrawerWidthStorage`, `LogDrawerWidthStorageOptions`.

## Tests

| File | Cases |
| ---- | ----- |
| `packages/ui/test/log-drawer.logic.test.ts` (new) | `clampDrawerWidth`: below min, above max, exact `320`/`720`, `NaN`, `±Infinity`. `toWidthFromPointer`: middle, far-left `clientX` → `max`, far-right → `min`. `toWidthFromKey`: all four directions, `Shift` variants, `Home`, `End`, unknown key → unchanged, no overshoot at both bounds. `toWidthStyle` → `{ '--log-drawer-width': '416px' }` |
| `packages/ui/test/log-drawer.test.tsx` (extend) | handle exposes `role="separator"` + `aria-orientation` + `aria-valuenow/min/max`; `pointerdown`→`move`→`up` reports `onWidthChange` with the expected value and `onResizeStart`/`onResizeEnd` once each; `ArrowLeft`/`ArrowRight`/`Shift`/`Home`/`End`; `dblclick` → `onWidthReset`; `isResizing` drops `transition-transform` from the panel class list; `width` lands in the `--log-drawer-width` inline style |
| `packages/ui/test/mocks/pointer-capture.mock.ts` (new) | `setPointerCapture`/`releasePointerCapture` stubs for jsdom |
| `packages/notifications/test/react/notification-react.logic.test.ts` (extend) | `parseStoredDrawerWidth`: `null`, `''`, `'abc'`, `'-5'`, `'99999'`, `'Infinity'`; `serializeDrawerWidth` round-trip |
| `packages/notifications/test/log-drawer-width-storage.test.ts` (new) | working storage round-trip; throwing `getItem` → `null`; throwing `setItem` → no throw; missing storage → both no-ops |
| `packages/notifications/test/mocks/react/log-drawer-width-storage.mock.ts` (new) | in-memory fake + throwing variant (never defined inside a test file) |
| `packages/notifications/test/react/use-notifications.test.tsx` (extend) | init from the storage; `updateWidth` clamps and does **not** write while resizing; `endResize` writes the final width; keyboard change writes immediately; `resetWidth` writes the default; `beginResize`/`endResize` flip `isResizing`; no write after unmount |
| `packages/notifications/test/react/notification-host.test.tsx` (extend) | the host forwards width, range, `isResizing` and the four callbacks to `LogDrawer` (assert via the rendered separator) |
| `packages/notifications/test/mocks/react/notification-provider-harness.mock.tsx` (extend) | new `widthStorage` injection option |

## Documentation

- `docs/Specs/UI-Architecture.md` — `LogDrawer` row (new props), the §4.1 note (resize handle: separator
  role, `md`-only, `isResizing` drops the transition), a §5 state-plan row
  “Drawer width → controller `useState` + `localStorage` (`aisztens.logdrawer.width.v1`), not a global
  store”, `**Utolsó frissítés:** 2026-11-07` + an `AIS-150` changelog line.
- `docs/history/<ts>-ais-150-log-drawer-resizable-panel.md` — post-implementation summary.
- `docs/milestones/<ts>-log-drawer-resizable-panel.milestone.md` — decision-grade record (D1–D6);
  AIS-154 cross-links it from the parent close-out.

## Risks and notes

- **Visual change below `md`:** the panel was `max-w-[26rem]` on every viewport, now it is full width under
  `md` and resizable above — intentional per the ticket; the default 416 px keeps today's look on desktop.
- **Merge risk:** AIS-151/AIS-153 touch `log-drawer.interface.ts` and `LogEntryRow.tsx`. AIS-150 keeps its
  changes additive (new props/rows only) and leaves the row component alone (D9).
- **Dead-code gate (knip):** every new `packages/ui` export must be consumed — the constants and logic are
  imported by `@callback/notifications`, the variants by the component itself.
- **Palette gate:** the handle uses token classes only (`border-hairline`, `border-border-strong`,
  `shadow-focus-ring`); no literal, no palette utility, no arbitrary colour.

## Gates

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/notifications test
pnpm --filter @callback/ui typecheck
pnpm --filter @callback/notifications typecheck
pnpm typecheck
pnpm lint
pnpm quality
```

## Definition of Done

- [ ] The panel is draggable on its left edge, width stays within 320–720 px, default 416 px.
- [ ] Keyboard works (`ArrowLeft/ArrowRight` ±16, `Shift` ±64, `Home`/`End`), double click resets,
      the handle is focusable and shows a focus ring.
- [ ] The width survives a reload (`localStorage`); disabled storage silently falls back to the default.
- [ ] Below `md` the panel is full width and the handle is not rendered visible.
- [ ] No transform animation while dragging (`isResizing` drops `transition-transform`).
- [ ] Token classes only; `packages/ui` imports nothing from `@callback/notifications`.
- [ ] Tests added (logic, component, storage, hook) and the gates above are green.
- [ ] `UI-Architecture.md` updated, history entry written, milestone created.
