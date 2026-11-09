# AIS-150 follow-up — Log drawer panel resizes on hover (drag-only resize fix)

**Date:** 2026-11-07 · **Ticket:** AIS-150 (regression in the resizable log drawer) ·
**Related:** [`docs/plans/2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md`](2026-11-07--01-45-00-ais-150-log-drawer-resizable-panel-plan.md),
[`docs/history/2026-11-07--02-11-00-ais-150-log-drawer-resizable-panel.md`](../history/2026-11-07--02-11-00-ais-150-log-drawer-resizable-panel.md)

## 1. Problem

Moving the mouse **onto** the drawer's resize strip — without pressing any button — changes the
panel width. The change is not one-off: repeating the approach repeats the step until a bound is
reached, and the accidental value is persisted to `localStorage`, so it survives a reload.

Reported from both directions:

| Approach | Observed run-away |
| --- | --- |
| Cursor comes from the page side (left of the strip) | width grows a few px per approach, **until `LOG_DRAWER_WIDTH_MAX` (720 px)** |
| Cursor comes from inside the panel (right of the strip) | width shrinks a few px per approach, **until `LOG_DRAWER_WIDTH_MIN` (320 px)** |

## 2. Measured evidence

Temporary `console.debug('[log-drawer-resize]', …)` instrumentation in
[`handlePointerMove()`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:164),
reproduced by the user:

| Observation | Value | What it proves |
| --- | --- | --- |
| `pointermove` entries while no button is held | `buttons: 0` | The handler resizes on **hover**, not only during a drag |
| `innerWidth` vs `document.documentElement.clientWidth` | `innerWidth` larger (classic scrollbar, 15–17 px on Windows) | `width = innerWidth - clientX` is **too large** by the scrollbar width |
| `width` / `next` across successive hovers | monotonically growing (or shrinking) | The width is recomputed from the **absolute** cursor x on every hover |
| `handleRect.left` | moves per hover | The panel — not the pointer — is what moved |
| Direction of the run-away | depends on the side the cursor approaches from | Rules out CSS transitions, `translate-x` and rounding artefacts: the cursor's own position is turned into a width, so the divider chases the cursor until a bound stops it |

## 3. Root cause

Two defects combine; neither alone produces the reported behaviour.

1. **No drag gate in the pointer handler.**
   [`handlePointerMove()`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:164) is bound
   as `onPointerMove` and calls `onWidthChange()` on every `pointermove` over the 12 px handle.
   `pointermove` fires on plain hover, so moving the cursor onto the strip already resizes the
   panel. `pointerId` / `buttons` are never inspected and nothing records that a drag started, so
   the handler treats an absolute cursor coordinate as a **drag delta anchor**. Because the divider
   is what moves, the cursor keeps landing on a different part of the strip, and each new hover
   converts the new coordinate into a new width in the same direction — grow-to-`max` from one
   side, shrink-to-`min` from the other.

2. **The pointer→width maths is anchored to the wrong viewport width.**
   [`toWidthFromPointer()`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:77)
   computes `window.innerWidth - clientX`. `window.innerWidth` **includes** the classic vertical
   scrollbar, while the `fixed` panel (`right-0`,
   [`logDrawerPanelVariants`](../../packages/ui/src/components/log-drawer/log-drawer.variants.ts:45))
   ends at `document.documentElement.clientWidth`. Every resulting width is therefore larger than
   the real distance from the cursor to the panel's right edge: the first hop of the run-away is
   `~15–17 px` bigger than the following ones, and a genuine drag would also jump on `pointerdown`
   by the same amount.

Contributing amplifiers (not causal):

- `absolute left-0` on the handle inside a panel with `border-l` adds a ±1 px offset between the
  painted edge and the handle's box.
- The width effect in
  [`useLogDrawer()`](../../packages/notifications/src/react/use-notifications.ts:77) writes to
  storage whenever `isResizing === false`, so every hover-driven value is persisted immediately.

## 4. Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | **Resize only during an active drag.** The component keeps the dragging pointer id in a `useRef`; `pointermove` is ignored unless it carries that id *and* a pressed button | `pointermove` is a hover event too; only a captured pointer with a held button is a drag. This removes the run-away in both directions |
| D2 | **Anchor the width to the pointer's own delta**, not to the viewport's right edge: `next = startWidth - (currentX - startX)` | Immune to the scrollbar mismatch, to the panel's border and to any future offset (a drawer not pinned to `right: 0`). A layout shift under a stationary cursor yields delta `0`, so it cannot feed back into itself — the run-away becomes structurally impossible, not merely gated |
| D3 | `toWidthFromPointer()` is **replaced** by `toWidthFromDrag()` in `log-drawer.logic.ts`; the old symbol is deleted, not kept | Dead code fails `pnpm quality:dead-code` (knip). One pure function, one responsibility; `clampDrawerWidth()` stays the single boundary decision |
| D4 | Drag state lives in the component (`useRef`), **no new props** | The gesture start is known only by the handle; the host keeps owning the width. `LogDrawerProps` stays unchanged, so the AIS-151/AIS-153 sibling work sees no interface churn |
| D5 | A `pointermove` with `buttons === 0` **ends** the drag (`onResizeEnd`) instead of being reported as a width | The button can be released outside the window and no `pointerup` arrives; without this the panel keeps "dragging" on the next hover |
| D6 | A drag starts only on the **primary** button (`event.button === 0`) | A right-click on the strip must not resize; touch/pen report `0` as well, so they keep working |
| D7 | Keyboard resize, double-click reset, clamping and persistence stay untouched | They are not defective, and `useLogDrawer()` already persists exactly once per finished gesture |
| D8 | Fix lives in `packages/ui` only | The bug is in the primitive's gesture handling; the host has no geometry knowledge and must not gain any |

## 5. Steps

1. **`packages/ui/src/components/log-drawer/log-drawer.logic.ts`**
   - Delete `toWidthFromPointer()`.
   - Add `toWidthFromDrag(startX, currentX, startWidth, range): number` →
     `clampDrawerWidth(startWidth - (currentX - startX), range)` with JSDoc explaining the
     delta anchor (leftwards movement widens, `NaN` input falls back through `clampDrawerWidth`).

2. **`packages/ui/src/components/log-drawer/LogDrawer.tsx`**
   - Remove the temporary `debugResize()` helper and its two call sites.
   - Add `const dragAnchor = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)`.
   - `handlePointerDown`: ignore `event.button !== 0`; then `onResizeStart()`, store the anchor,
     `setPointerCapture(event.pointerId)`.
   - `handlePointerMove`: return early unless `dragAnchor.current` matches `event.pointerId`;
     if `event.buttons === 0`, clear the anchor and call `onResizeEnd()`; otherwise call
     `onWidthChange(toWidthFromDrag(anchor.startX, event.clientX, anchor.startWidth, widthRange))`.
   - `handlePointerEnd`: clear the anchor, release the capture, `onResizeEnd()`.
   - Update the component JSDoc: the separator resizes **on drag only**.

3. **`packages/ui/src/index.ts`** — export `toWidthFromDrag` instead of `toWidthFromPointer`.

4. **`packages/ui/test/mocks/pointer-capture.mock.ts`**
   - `PointerDispatchInit` gains `buttons?: number` (default `0`, i.e. hover) and `button?: number`
     (default `0`), both forwarded to the `MouseEvent` init.

5. **`packages/ui/test/log-drawer.logic.test.ts`** — cover `toWidthFromDrag`:
   zero delta, leftwards growth, rightwards shrink, clamp at `min`, clamp at `max`, `NaN` delta →
   clamped `initial`.

6. **`packages/ui/test/log-drawer.test.tsx`** — new behaviour tests:
   - a `pointermove` **without** a preceding `pointerdown` reports nothing (the regression test);
   - a `pointermove` after the drag ended reports nothing;
   - a drag reports `startWidth - (currentX - startX)` and clamps at both bounds;
   - `pointermove` with `buttons: 0` ends the drag instead of reporting a width;
   - a secondary-button `pointerdown` neither starts the drag nor captures the pointer;
   - existing pointer tests are updated to pass `buttons: 1` on the moves.

7. **Documentation**
   - [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) — the `AIS-150` resize
     paragraphs + `**Utolsó frissítés:**` line: drag-only, delta-anchored, and *why* the viewport
     right edge must not be used.
   - `docs/history/<ts>-log-drawer-hover-resize-fix.md` — change narrative.
   - `docs/milestones/<ts>-log-drawer-hover-resize-fix.milestone.md` — required: non-trivial bug
     whose root cause needed a browser-side diagnosis.

## 6. Tests / verification

```powershell
pnpm --filter @callback/ui test
pnpm --filter @callback/ui typecheck
pnpm quality
```

Manual check (must all hold):

1. Open the log drawer, move the cursor slowly onto the strip from the **left** and from the
   **right**, then away — the width does **not** change in either direction.
2. Hover the strip repeatedly from both sides — the width stays constant.
3. Drag the strip left/right — the panel's left edge follows the cursor exactly, no jump on
   `pointerdown`, and no jump when the drag is clamped at `min`/`max`.
4. Release the button outside the window while dragging — the drag ends, the next hover does not
   resize.
5. Arrow keys, `Shift`+arrow, `Home`/`End` and double-click reset behave as before, and the width is
   still restored after a reload.

## 7. Risks

- **Contract change for `@callback/notifications`:** none — `toWidthFromPointer` is not imported
  there (only `clampDrawerWidth` is), as shown by the import lists in
  [`use-notifications.ts`](../../packages/notifications/src/react/use-notifications.ts:2) and
  [`notification-react.logic.ts`](../../packages/notifications/src/react/notification-react.logic.ts:1).
- **`buttons` in jsdom:** this jsdom build cannot construct `PointerEvent`; the existing mock
  dispatches `MouseEvent`s, which carry `buttons`/`button`, so the new guards stay testable.
- **`knip`:** removing the export from `packages/ui/src/index.ts` while keeping the function would
  fail the dead-code gate — hence the export is swapped, not duplicated.
