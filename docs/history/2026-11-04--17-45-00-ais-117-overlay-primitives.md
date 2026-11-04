# AIS-117 — overlay primitives with Radix behaviour

**Ticket:** AIS-117 (subtask of AIS-104) · **Date:** 2026-11-04 17:45 (Europe/Budapest)
**Plan:** [`2026-11-04--17-10-00-ais-117-overlay-primitives-plan.md`](../plans/2026-11-04--17-10-00-ais-117-overlay-primitives-plan.md:1)
**Milestone:** [`2026-11-04--17-45-00-ais-117-radix-overlay-layer.milestone.md`](../milestones/2026-11-04--17-45-00-ais-117-radix-overlay-layer.milestone.md:1)

## What was built

Five overlay primitives in `packages/ui`, all behaviour-on-Radix / visuals-on-tokens:

| Primitive       | Files                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| `Dialog`        | `dialog/{Dialog.tsx, dialog.interface.ts, dialog.const.ts, dialog.variants.ts}` + the internal `dialog/OverlayShell.tsx` (shared modal markup) |
| `ConfirmDialog` | `confirm-dialog/{ConfirmDialog.tsx, .interface.ts, .const.ts}`                              |
| `Drawer`        | `drawer/{Drawer.tsx, .interface.ts, .const.ts, .variants.ts}`                               |
| `Tooltip`       | `tooltip/{Tooltip.tsx, .interface.ts, .const.ts, .variants.ts}`                             |
| `DropdownMenu`  | `dropdown-menu/{DropdownMenu.tsx, .interface.ts, .const.ts, .variants.ts}`                  |

`src/index.ts` exports every component, variant function, const and type explicitly (no `export *`);
`OverlayShell` stays internal.

## Deviations from the ticket text (and why)

1. **`Drawer` is a `Dialog` with a `side` variant, not a `Popover`** (ticket D4 asked for
   `@radix-ui/react-popover`). A drawer that hosts a sequential form must trap focus, close on
   `Esc`, hide the background from AT and lock scroll — exactly the `Dialog` contract. `Popover`
   is non-modal and would have lost all of it. Net effect: **3 Radix packages instead of 4**.
2. **`Dialog` sets `aria-modal="true"` itself.** Radix hides sibling content via `aria-hidden`
   but does not set `aria-modal`; the ticket DoD asks for it.
3. **Focus restoration is implemented in `OverlayShell`,** because Radix only restores focus to a
   `Dialog.Trigger` and our API opens dialogs from caller-owned buttons (table rows, toolbars).
   The opener is captured in `onOpenAutoFocus` (fired before Radix moves focus in) and re-focused
   in `onCloseAutoFocus`.
4. **`Button` is now a `forwardRef` component.** Radix `asChild` slots (dialog close, tooltip and
   menu triggers) merge refs and would have warned and broken on a ref-less function component.
   Purely additive — no call site changed.
5. **`ConfirmDialog` blocks `Esc`/cancel while `isPending`,** so a request in flight cannot
   dismiss the question it belongs to.

## Tests

| File                          | Cases |
| ----------------------------- | ----- |
| `test/dialog.test.tsx`        | 7 — closed/open, `aria-modal`, `aria-labelledby`, `Esc`, close button, backdrop click, focus returned to the opener, `size` variant |
| `test/confirm-dialog.test.tsx`| 6 — confirm calls `onConfirm` once and leaves the dialog open, cancel, `Esc` as cancel, pending disables + blocks dismissal, `primary`/`danger` tone |
| `test/drawer.test.tsx`        | 4 — right/left edge, scrollable body, `Esc` + focus restore |
| `test/tooltip.test.tsx`       | 4 — no panel before interaction, `aria-describedby` + unchanged accessible name, hover, `disabled` |
| `test/dropdown-menu.test.tsx` | 7 — closed, named menu with 3 items, mouse selection returns the id and closes, keyboard selection skips the disabled item, disabled item never fires, `danger` tone, empty label |
| `test/overlay-a11y.test.tsx`  | 5 — `vitest-axe` over `document.body` with every overlay open (WCAG A/AA rule sets) |

Shared fixtures/shimss live in `test/mocks/`: `overlay-user.mock.ts` (`ResizeObserver`,
`IntersectionObserver`, pointer-capture and `scrollIntoView` shims + `pointerEventsCheck: 0`),
`overlay-harness.mock.tsx` (controlled harnesses and label fixtures) and
`overlay-axe-options.mock.ts` (WCAG-only `runOnly`, because portal content sits outside landmarks).

## Verification (all green)

```text
pnpm --filter @callback/ui test     36 files / 282 tests   (was 30 / 249)
pnpm --filter @callback/ui build    tsc clean
pnpm --filter @callback/admin build 501.09 kB / 149.16 kB gzip
pnpm quality                        0 palette, 0 field-error, 0 layer, knip clean
pnpm test                           all packages green (api: 39 suites / 433 tests)
```

**Bundle impact: 0 bytes** — `grep radix` on `apps/admin/dist/assets/index-*.js` returns 0 hits,
because no page imports an overlay yet. The real cost lands with AIS-22, the first consumer.

## Docs

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1): new §4.0 overlay table, §3.3
  rule 5 (body portal, `z-40`/`z-50`, no z token), §7 Radix rows + the measured 0-byte delta.
- This entry and the milestone.

## Follow-ups

- AIS-22: first consumer (`ConfirmDialog` for "process emails"); measure the real bundle delta then.
- The admin chunk is 501.09 kB and already triggers Vite's >500 kB warning — code-splitting is a
  separate, pre-existing concern, not caused by this ticket.
- Cancel (`Mégsem`) and the empty-menu (`Nincs elérhető művelet`) defaults are Hungarian, matching
  `FORM_ACTIONS_*`; an i18n pass would move them into the shared catalogue.
