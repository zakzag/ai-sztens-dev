# AIS-81 — Toast primitives: stateless presentation, newest-first contract

**Date:** 2026-11-04 · **Status:** implemented
**Plan:** [`docs/plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md`](../plans/2026-11-04--20-59-00-ais-81-toast-toaststack-plan.md:1)
**Change summary:** [`docs/history/2026-11-04--20-25-00-ais-81-toast-toaststack.md`](../history/2026-11-04--20-25-00-ais-81-toast-toaststack.md:1)

## Problem / feature

The notification subsystem (AIS-86) needs a toast layer, but the store (AIS-79) and the React
host with the timers (AIS-83) do not exist yet. AIS-81 therefore had to deliver the *presentation*
alone: `Toast` and `ToastStack` in `packages/ui`, token-only, with no timer, no store and no
storage — otherwise the two later tickets would each invent their own card.

## Design rationale

The ticket text could not be implemented literally on three points. Each was decided before code:

| Point | Ticket said | Built | Why |
| --- | --- | --- | --- |
| `level` type | `level: NotificationLevel` | `ToastLevel` declared in `packages/ui` | `packages/notifications` does not exist; importing it would break `tsc`. AIS-79 aliases the union, so the vocabulary cannot drift |
| Animation | `data-mounted` attribute + CSS transition | Tailwind `starting:` variant + `transition-[transform,opacity]` | A transition needs a state change; `data-mounted` would mean `useState` in the primitive, which the DoD forbids |
| Array order | “max 3 visible, newest on top”, order unstated | `toasts[0]` is the newest (documented in the interface) | The store prepends, so slicing the head is what keeps the newest cards; leaving it unstated would let AIS-83 feed the array backwards and silently trim the wrong end |

Two secondary decisions:

- **Severity is carried by the border accent** (`Alert`/`Banner` recipe), never by the text colour,
  so WCAG contrast does not depend on the accent. `error` is announced as `role="alert"`, every other
  level as `role="status"`.
- **`depth` is a CVA variant set by the stack**, not a page prop: pages pass `ToastItem[]` only.
  The index → depth mapping is a pure function (`toToastDepth`) so no `as` cast appears in JSX.

`ToastProps` **must** `Omit<HTMLAttributes<HTMLDivElement>, 'onPause'>`; the DOM media event of the
same name has a different signature and would otherwise collide with the timer callback.

## Implementation

| File | Change |
| --- | --- |
| `packages/ui/src/components/toast/toast.interface.ts` | `ToastLevel`, `ToastItem`, `ToastProps`, `ToastStackProps` |
| `packages/ui/src/components/toast/toast.const.ts` | `TOAST_MAX_VISIBLE`, `TOAST_DISMISS_LABEL`, `TOAST_STACK_ARIA_LABEL`, `TOAST_STACK_Z_INDEX`, `TOAST_LEVEL_GLYPHS` |
| `packages/ui/src/components/toast/toast.variants.ts` | `toastVariants` (level + depth + `starting:`), `toastLevelChipVariants`, `toastStackVariants` |
| `packages/ui/src/components/toast/toast.logic.ts` | `toToastDepth` |
| `packages/ui/src/components/toast/Toast.tsx` | one card, stateless |
| `packages/ui/src/components/toast/ToastStack.tsx` | live region, trimming, depth |
| `packages/ui/src/index.ts` | explicit exports |
| `packages/ui/test/toast*.test.ts*`, `test/mocks/toast-items.mock.ts` | 31 tests + fixtures |
| `docs/Specs/UI-Architecture.md` | primitives table rows + AIS-81 paragraph |

## Outcome and how to verify

```powershell
pnpm --filter @callback/ui exec vitest run test/toast.test.tsx test/toast-stack.test.tsx test/toast.logic.test.ts
pnpm --filter @callback/ui build
pnpm quality:tokens
rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" packages/ui/src
```

Expected: 31 passing tests, a clean `tsc`, `OK quality:tokens (palette): 0 violations`, and no `rg`
output. Manual check: render `<ToastStack toasts={[...]} onDismiss={fn} />` and confirm the newest
card is the top one, at most three are visible, and hovering does **not** dismiss it (no timer here).

## Follow-ups

- AIS-79: `packages/notifications` must alias `ToastLevel` and prepend to the array.
- AIS-83: owns the 4 s / 6 s / sticky rules, `document.hidden` pausing and the `onPause`/`onResume`
  wiring; the component only reports the events.
- AIS-82 reuses the same token recipes for the log drawer rows.
