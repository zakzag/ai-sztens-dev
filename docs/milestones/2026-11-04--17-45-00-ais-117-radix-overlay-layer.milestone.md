# AIS-117 — Radix behaviour, our visuals: the overlay layer

**Date:** 2026-11-04 · **Ticket:** AIS-117 (subtask of AIS-104) · **Scope:** `packages/ui`

## 1. Problem / feature

Every page that needs a modal, a confirmation, a side panel, a tooltip or a row-action menu was
going to hand-roll focus traps, `Esc` handling, `aria-modal`, portal placement and
focus restoration. The ticket asked for five shared primitives with that behaviour pre-solved, in
`packages/ui`, without adopting Radix's visual language.

## 2. Measured data / evidence

| Fact measured before the change | Value |
| --- | --- |
| Overlay primitives in `packages/ui` | 0 (25 primitives existed, all hand-rolled) |
| `@radix-ui/*` anywhere in the repo (`*.json` search) | 0 hits |
| Runtime dependencies of `@callback/ui` | 3 (CVA, clsx, tailwind-merge) |
| Dialog / menu / tooltip / `z-*` usage in `apps/admin` | 0 (no consumer exists yet — AIS-22 is first) |

## 3. Root cause / design rationale

The real design question was **which Radix package a "Drawer" is**. The ticket said `popover`.
A drawer hosting a sequential form must trap focus, close on `Esc`, hide the background from
assistive tech and lock scroll; `Popover` is a non-modal, trigger-anchored layer that provides none
of those. Building it on `react-dialog` with a `side` variant satisfies the contract and removes a
package from the dependency list (3 instead of 4) — less code, less bundle.

Two further decisions followed from observed behaviour, not taste:

- **`aria-modal` is set by us.** Radix hides sibling content with `aria-hidden` but never sets
  `aria-modal="true"` (verified in its dist), and the ticket's DoD requires it.
- **Focus restoration is ours.** Radix only returns focus to a `Dialog.Trigger`. Our API opens a
  dialog from a caller-owned button (a table row, a toolbar), so there is no trigger to remember.
  The opener is captured in `onOpenAutoFocus` — fired *before* Radix moves focus into the panel —
  and re-focused in `onCloseAutoFocus`. This is what makes the dialog usable from a list.
- **`ConfirmDialog` returns the decision and nothing else.** It never navigates, never toasts, and
  never closes itself on confirm: the caller closes it when the mutation succeeds, otherwise a
  failed request would erase the question the user just answered. While `isPending`, dismissal is
  blocked entirely.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `packages/ui/package.json` | `@radix-ui/react-dialog`, `-dropdown-menu`, `-tooltip` added to `dependencies` (first runtime deps of the kit) |
| `src/components/dialog/OverlayShell.tsx` | The single modal implementation: portal, backdrop, title/description, close control, body + footer slots, `aria-modal`, opener capture and focus restore |
| `dialog/Dialog.tsx`, `dialog.variants.ts` | Centred raised card; `size` = `sm`/`md`/`lg` |
| `confirm-dialog/ConfirmDialog.tsx` | Composes `Dialog`; footer = ghost cancel + toned confirm; pending blocks dismissal |
| `drawer/Drawer.tsx`, `drawer.variants.ts` | Same shell, edge-pinned panel (`side`: `right`/`left`), scrollable body |
| `tooltip/Tooltip.tsx` | Own `Tooltip.Provider`, `aria-describedby` only — never the accessible name |
| `dropdown-menu/DropdownMenu.tsx` | Data-driven `items: { id, label, onSelect, tone?, disabled? }[]`; empty list renders a disabled "no action" row |
| `src/components/button/Button.tsx` | Converted to `forwardRef` (Radix `asChild` needs a ref-able child); no call site changed |
| `src/index.ts` | Explicit exports for all five primitives, their variants, consts and types |
| `test/*` + `test/mocks/*` | 33 new cases across 6 files; shared jsdom shims, harnesses and axe options |

## 5. Outcome and how to verify

`pnpm --filter @callback/ui test` → 36 files / **282 tests** green (was 30 / 249).
`pnpm quality` → palette 0, field-error 0, layer 0, `knip` clean. `pnpm test` → all packages green.
`pnpm --filter @callback/ui build` → `tsc` clean.

Bundle impact is **0 bytes today**: nothing imports the overlays, so Rollup drops them —
`Select-String -Path apps/admin/dist/assets/index-*.js -Pattern radix` returns 0 hits. The real cost
is measured in AIS-22, the first consumer.

Manual check once a consumer exists: open the dialog from a table row, press `Esc` — the panel must
close and keyboard focus must land back on the row's button.

## 6. Follow-ups

- AIS-22 measures the real bundle delta and is the first `ConfirmDialog` user.
- `apps/admin`'s single chunk is 501.09 kB and already trips Vite's >500 kB warning — a
  pre-existing code-splitting concern, not caused by this ticket.
- Overlay `z-40`/`z-50` are scale utilities, not tokens; a z-token scale would be a design-system
  change (and a palette-gate update).
- `Mégsem` / `Nincs elérhető művelet` defaults are Hungarian like `FORM_ACTIONS_*`; an i18n pass
  would move them into a shared catalogue.
