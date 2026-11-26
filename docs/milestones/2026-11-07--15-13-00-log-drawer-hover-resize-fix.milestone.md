# Milestone — log drawer panel resized on hover (AIS-150 follow-up)

**Date:** 2026-11-07 · **Ticket:** AIS-150 (regression of the resizable log drawer) ·
**Plan:** [`docs/plans/2026-11-07--15-05-00-log-drawer-hover-resize-fix-plan.md`](../plans/2026-11-07--15-05-00-log-drawer-hover-resize-fix-plan.md) ·
**History:** [`docs/history/2026-11-07--15-13-00-log-drawer-hover-resize-fix.md`](../history/2026-11-07--15-13-00-log-drawer-hover-resize-fix.md)

## 1. Problem / feature

The log drawer's resize separator (AIS-150) reacted to **hovering**, not only to dragging: moving the
mouse onto the strip changed the panel width by a few pixels, repeatably, until a bound was reached.
Direction depended on the side the cursor came from — grow to `LOG_DRAWER_WIDTH_MAX` (720 px) from
the page side, shrink to `LOG_DRAWER_WIDTH_MIN` (320 px) from inside the panel. The wrong value was
persisted and survived a reload.

## 2. Measured data / evidence

Temporary `[log-drawer-resize]` `console.debug` instrumentation in `handlePointerMove`, reproduced
by the user in the admin app:

| Observation | Reading | Conclusion |
| --- | --- | --- |
| `buttons` on a `pointermove` over the strip | `0` | The handler resized on hover, not during a drag |
| `window.innerWidth - document.documentElement.clientWidth` | ~15–17 px | The width maths included the classic scrollbar |
| `width` across successive hovers | monotonic grow / shrink | The absolute cursor position was converted into a width |
| `getBoundingClientRect().left` of the handle | moved per hover | The panel, not the pointer, was moving |
| Direction of the run-away | depended on approach side | Ruled out CSS transition / rounding artefacts |

## 3. Root cause

Two defects combined; each was harmless alone.

1. **No drag gate.** `onPointerMove` called `onWidthChange()` for every `pointermove` over the
   handle. `pointermove` is a hover event, so a plain hover turned an absolute cursor coordinate into
   a width, and the divider kept repositioning itself under the cursor — the step repeated in the
   direction the cursor had come from.
2. **Wrong viewport anchor.** `toWidthFromPointer()` computed `window.innerWidth - clientX`.
   `window.innerWidth` counts the classic vertical scrollbar, but a `fixed right-0` panel ends at
   `document.documentElement.clientWidth`, so every step overshot by the scrollbar width — which is
   why the first hop was larger than the following ones.

Alternatives considered: (a) keep the edge-anchored formula and only add a `buttons` check — rejected,
because the drag would still jump by the scrollbar width on `pointerdown`; (b) read the panel's own
`getBoundingClientRect()` per move — rejected as more state for no extra benefit, and it still breaks
when the panel is not pinned to `right: 0`; (c) CSS-only `resize`/`cursor` tricks — rejected, they
cannot clamp to the 320–720 px policy or persist a preference.

## 4. Solution / implementation

The width is now derived from the pointer's **travel** and is only reported while the separator's own
drag is running.

| File | Change |
| --- | --- |
| `packages/ui/src/components/log-drawer/log-drawer.logic.ts` | `toWidthFromPointer()` replaced by `toWidthFromDrag(startX, currentX, startWidth, range)` = `clampDrawerWidth(startWidth - (currentX - startX))` |
| `packages/ui/src/components/log-drawer/log-drawer.interface.ts` | new `LogDrawerDragAnchor` (`pointerId`, `startX`, `startWidth`) |
| `packages/ui/src/components/log-drawer/LogDrawer.tsx` | drag anchor in a `useRef`; primary button only; move resizes only for the owning `pointerId` with a pressed button; `buttons === 0` ends the drag; diagnostics removed |
| `packages/ui/src/index.ts` | exports `toWidthFromDrag` (no dead export) |
| `packages/ui/test/mocks/pointer-capture.mock.ts` | pointer init gains `buttons` / `button` |
| `packages/ui/test/log-drawer.logic.test.ts` | delta geometry: zero delta, widen/shrink, position independence, both clamps, non-finite input |
| `packages/ui/test/log-drawer.test.tsx` | 7 regression tests (hover, ended drag, foreign pointer, released button, secondary button, delta width, clamping) |
| `docs/Specs/UI-Architecture.md` | header date, follow-up changelog paragraph, §4 resize contract rewritten |

`LogDrawerProps`, keyboard resize, double-click reset and the `localStorage` persistence flow are
unchanged, so the AIS-151/AIS-153 sibling work is unaffected.

## 5. Outcome and how to verify

Hovering the strip from either side no longer changes the width, and a drag moves the panel's left
edge exactly with the cursor.

```powershell
pnpm --filter @callback/ui test        # 45 files / 426 tests green
pnpm --filter @callback/ui typecheck
pnpm quality                           # layers, knip, tokens, field-errors, docs
```

Manual: open the log drawer, approach the strip from both sides and away (width must not change);
drag left/right (no jump on press, no jump at a bound); release the button outside the window (drag
ends, next hover does nothing); arrows, `Shift`+arrows, `Home`/`End`, double-click and the width after
a reload still behave as before.

## 6. Follow-ups

- Notification store / drawer tests in `@callback/notifications` were not touched — the controller
  contract did not change; only the primitive's gesture handling did.
- A stale, too-wide persisted preference (`aisztens.logdrawer.width.v1`) from the buggy build is
  clamped on read, so no migration is needed; the value simply stays where the user last dragged it.
