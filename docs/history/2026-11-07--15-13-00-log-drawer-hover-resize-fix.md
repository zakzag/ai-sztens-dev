# AIS-150 follow-up — log drawer panel resized on hover (fixed)

**Date:** 2026-11-07 · **Ticket:** AIS-150 (regression of the resizable log drawer) ·
**Plan:** [`docs/plans/2026-11-07--15-05-00-log-drawer-hover-resize-fix-plan.md`](../plans/2026-11-07--15-05-00-log-drawer-hover-resize-fix-plan.md) ·
**Milestone:** [`docs/milestones/2026-11-07--15-13-00-log-drawer-hover-resize-fix.milestone.md`](../milestones/2026-11-07--15-13-00-log-drawer-hover-resize-fix.milestone.md)

## Symptom

Moving the mouse **onto** the drawer's resize strip, without pressing any button, changed the panel
width. The step repeated on every approach:

- cursor coming from the page side (left of the strip) → the panel grew, up to
  `LOG_DRAWER_WIDTH_MAX` (720 px);
- cursor coming from inside the panel (right of the strip) → the panel shrank, down to
  `LOG_DRAWER_WIDTH_MIN` (320 px).

Because [`useLogDrawer()`](../../packages/notifications/src/react/use-notifications.ts:77) persists the
width whenever a gesture is not running, the accidental value also survived a reload.

## Root cause

Two defects in `packages/ui` combined:

1. **No drag gate.** `LogDrawer`'s `onPointerMove` handler called `onWidthChange()` on **every**
   `pointermove` over the separator. `pointermove` is a hover event too, so a plain hover converted an
   absolute cursor coordinate into a width, and the moving divider kept re-positioning itself under
   the cursor — hence the repeatable step in whichever direction the cursor came from.
2. **Wrong viewport anchor.** `toWidthFromPointer()` used `window.innerWidth - clientX`.
   `window.innerWidth` counts the classic vertical scrollbar, while a `fixed right-0` panel ends at
   `document.documentElement.clientWidth`. Every step therefore overshot by the scrollbar width
   (~15–17 px on Windows), which is what made the first hop larger than the following ones.

Evidence came from temporary `[log-drawer-resize]` `console.debug` instrumentation in the handler:
`pointermove` entries carried `buttons: 0` (hover, not drag), `innerWidth` was consistently larger
than `document.documentElement.clientWidth`, and the reported `width` grew/shrunk monotonically
across successive hovers while `handleRect.left` moved. The instrumentation was removed with the fix.

## Changes

| File | Change |
| --- | --- |
| [`packages/ui/src/components/log-drawer/log-drawer.logic.ts`](../../packages/ui/src/components/log-drawer/log-drawer.logic.ts:65) | `toWidthFromPointer()` **replaced** by `toWidthFromDrag(startX, currentX, startWidth, range)` = `clampDrawerWidth(startWidth - (currentX - startX))`; the geometry is now anchored to the pointer's travel, so neither the scrollbar nor a layout shift can feed back into it |
| [`packages/ui/src/components/log-drawer/log-drawer.interface.ts`](../../packages/ui/src/components/log-drawer/log-drawer.interface.ts:74) | new `LogDrawerDragAnchor` (`pointerId`, `startX`, `startWidth`) — the shape the component keeps in a `useRef` |
| [`packages/ui/src/components/log-drawer/LogDrawer.tsx`](../../packages/ui/src/components/log-drawer/LogDrawer.tsx:117) | drag gate: only the primary button starts a drag, `pointermove` resizes only for the owning `pointerId` with a pressed button, `buttons === 0` ends the drag (button released outside the window), `handlePointerEnd` clears the anchor; JSDoc updated |
| [`packages/ui/src/index.ts`](../../packages/ui/src/index.ts:308) | exports `toWidthFromDrag` instead of `toWidthFromPointer` (no dead export for knip) |
| [`packages/ui/test/mocks/pointer-capture.mock.ts`](../../packages/ui/test/mocks/pointer-capture.mock.ts:17) | `PointerDispatchInit` gains `buttons`/`button`, so a test can distinguish a hover (`0`) from a drag (`1`) and a secondary click (`2`) |
| [`packages/ui/test/log-drawer.logic.test.ts`](../../packages/ui/test/log-drawer.logic.test.ts:68) | `toWidthFromDrag` coverage: zero delta, widen/shrink, position independence, both clamps, non-finite coordinates |
| [`packages/ui/test/log-drawer.test.tsx`](../../packages/ui/test/log-drawer.test.tsx:383) | regression tests: hover reports nothing, a move after the drag ended reports nothing, delta-based width, clamping, `buttons: 0` ends the drag, foreign `pointerId` ignored, secondary button ignored |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1) | header `**Utolsó frissítés:**` line, a follow-up changelog paragraph, and the §4 `LogDrawer` resize contract rewritten to the drag-only, delta-anchored behaviour |

Unchanged on purpose: `LogDrawerProps` (no new props — the drag anchor is component-local),
keyboard resize, double-click reset, the `localStorage` persistence flow, and `useLogDrawer`.

## Verification

```powershell
pnpm --filter @callback/ui test        # 426 tests, 45 files — green
pnpm --filter @callback/ui typecheck   # green
pnpm quality                           # layers, knip, tokens, field-errors, docs — green
```

Manual check: hovering the strip from either side no longer changes the width; a real drag moves the
panel's left edge with the cursor without a jump on `pointerdown`; releasing the button outside the
window ends the drag; arrows/`Shift`/`Home`/`End`/double-click and the persisted width still work.
