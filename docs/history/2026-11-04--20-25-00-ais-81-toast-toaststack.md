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
| D1 | `ToastLevel` is declared in `packages/ui` | `packages/notifications` does not exist yet (AIS-79); that ticket aliases this union instead of re-declaring it |
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
