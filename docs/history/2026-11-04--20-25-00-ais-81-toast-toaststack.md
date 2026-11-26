# AIS-81 — `Toast` + `ToastStack` primitives in `packages/ui`

**Date:** 2026-11-04 20:25 (Europe/Budapest)
**Ticket:** AIS-81 (subtask of AIS-86) · **Plan:** [`docs/plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md`](../plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md)
**Follow-ups:** AIS-83 (host + timers), AIS-79 (store), AIS-82 (`LogDrawer`)

## What changed

Two presentational primitives, no store and no timer:

| File | Change |
| --- | --- |
| `packages/ui/src/components/toast/toast.interface.ts` | `ToastLevel`, `ToastItem`, `ToastProps` (`Omit<HTMLAttributes, 'onPause'>`), `ToastStackProps` with the newest-first contract in JSDoc |
| `packages/ui/src/components/toast/toast.const.ts` | `TOAST_MAX_VISIBLE = 3`, `TOAST_DISMISS_LABEL`, `TOAST_STACK_ARIA_LABEL`, `TOAST_STACK_Z_INDEX = 'z-60'`, `TOAST_LEVEL_GLYPHS` |
| `packages/ui/src/components/toast/toast.variants.ts` | `toastVariants` (level accent + `depth` + `starting:` transition), `toastLevelChipVariants`, `toastStackVariants`, `ToastVariants`, `ToastDepth` |
| `packages/ui/src/components/toast/toast.logic.ts` | `toToastDepth(index)` — pure index → depth mapping, so no `as` cast is needed in the stack |
| `packages/ui/src/components/toast/Toast.tsx` | One card: glyph chip, message, `×N` `Badge`, clamped `detail` with `title`, labelled close `Button`, pointer enter/leave forwarding |
| `packages/ui/src/components/toast/ToastStack.tsx` | `null` when empty, `slice(0, TOAST_MAX_VISIBLE)`, depth per position, `role="region"` live region |
| `packages/ui/src/index.ts` | explicit exports of both components, the variants, the constants, the logic and the types |
| `packages/ui/test/toast.test.tsx`, `toast-stack.test.tsx`, `toast.logic.test.ts` | 31 tests |
| `packages/ui/test/mocks/toast-items.mock.ts` | `buildToastItem` / `buildToastItems` fixtures (repo rule: no mocks inside test files) |
| `docs/Specs/UI-Architecture.md` | two rows in the primitives table + the AIS-81 paragraph |

## Decisions

| # | Decision | Why |
| - | -------- | --- |
| D1 | `ToastLevel` is declared in `packages/ui` | `packages/notifications` did not exist yet (AIS-79). AIS-79 later chose the opposite of what this plan assumed: it declares its own `NotificationLevel` union and the two vocabularies are pinned by tests on both sides |
| D2 | Entry animation = Tailwind `starting:` + `transition-[transform,opacity]` | A `data-mounted` flip would need `useState`, which the DoD forbids in the primitive |
| D3 | `ToastStackProps.toasts` is newest-first | The store prepends; slicing the head is what keeps the **newest** cards when the list overflows |
| D5 | Level accent follows the `Alert`/`Banner` border recipe | Contrast never depends on the accent colour alone |
| D6 | `depth` is set by the stack, not by pages | Layout knowledge stays in one place; pages only pass `ToastItem[]` |
| D7 | `TOAST_STACK_Z_INDEX = 'z-60'` | Sits above `DIALOG_CONTENT_Z_INDEX` (`z-50`); the literal lives in `.const.ts` per AIS-117 D5 |

## Deviations from the plan

| Plan | Built | Why |
| --- | --- | --- |
| `toastDepthOf` naming discussed in the spec draft | `toToastDepth` in `toast.logic.ts` | Matches the repo's `to<Thing>` naming for pure mappers and keeps the file listed in the plan's spirit (no cast in the component) |
| Plan §5 listed only `toastVariants` / `toastStackVariants` | also `toastLevelChipVariants` and `TOAST_LEVEL_GLYPHS` | The glyph chip is a visual concept of its own; inlining its classes in `Toast.tsx` would have broken the "build it once in `packages/ui`" rule |

## Verification

```text
pnpm --filter @callback/ui exec vitest run test/toast*.test.ts*   → 31 passed (3 files)
pnpm --filter @callback/ui build                                  → tsc clean
pnpm quality:tokens                                               → 0 violations
```

The palette `rg` from the ticket returns nothing; the components contain no `useState`,
`useEffect`, `setTimeout` or storage access.

## Close-out (2026-11-04 22:55)

The feature was already in the tree when AIS-81 was picked up again, but the ticket was still
`To Do` and two drifts had appeared after AIS-79 landed:

| Drift | Fix |
| --- | --- |
| `toast.interface.ts` claimed AIS-79 **aliases** `ToastLevel` (`type NotificationLevel = ToastLevel`) | JSDoc rewritten: the notifications core declares its own union (AIS-79 D1) and the two are kept in sync by pinned tests. The D1 row above corrected the same way |
| Both `notification.interface.ts` and [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md) promised the `TOAST_LEVEL_GLYPHS` keys were asserted in a test — no such test existed | `toast.test.tsx` now pins the five levels, and `TOAST_MAX_VISIBLE === 3` (mirror of `NOTIFICATION_MAX_VISIBLE_TOASTS`) |

Verification on the close-out run:

```text
pnpm --filter @callback/ui test      → 315 passed (39 files), toast.test.tsx 19 tests
pnpm --filter @callback/ui build     → tsc clean
pnpm quality:tokens                  → 0 violations
pnpm quality:dead-code               → knip clean
```

Plan: [`docs/plans/2026-11-04--22-46-00-ais-81-toast-primitives-closeout-plan.md`](../plans/2026-11-04--22-46-00-ais-81-toast-primitives-closeout-plan.md).
No `format:check` gate exists in the repo yet, so only the touched lines were kept Prettier-shaped
instead of reformatting the whole files.
