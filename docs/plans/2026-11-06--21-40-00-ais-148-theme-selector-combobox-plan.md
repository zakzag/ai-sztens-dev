# AIS-148 — Appearance selector as a combobox

**Date:** 2026-11-06 · **Ticket:** AIS-148 (follow-up of AIS-147, AIS-140 `D3`/`D9`)

## Goal

Replace the three-option, icon-based `RadioGroup` in the admin header with a **combo box**
that shows only the chosen appearance while closed, and keep everything else (the
`onThemeChange` port, "no theme is applied", no storage) exactly as AIS-147 shipped it.

## Decisions taken before coding

| #   | Decision                                                                 | Why                                                                                                                                                            |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Use the existing `Combobox` primitive instead of `DropdownMenu`/`Select` | It is the design-system combo box; its popup uses the overlay token recipe, so the header stays on-brand (a native `<select>` popup is OS-rendered)            |
| D2  | The combobox's filter text is **not** the selection                      | A prefilled input would filter the list to that single entry; the primitive filters by `inputValue`                                                            |
| D3  | Extend the primitive with `onOpen` / `onClose` **transition** ports      | The component must clear the text on open and restore the label on close; without a close signal the "only the selection is visible" contract is unenforceable |
| D4  | One `ThemeSelectorState` object (`selected` + `query`)                   | The reset is then one atomic `setState`, not two updates that can disagree                                                                                     |
| D5  | Drop `THEME_OPTION_ICONS` and `toThemeRadioOptions`                      | A listbox option is text-only; the AIS-144 icons stay available for `RadioGroup` in forms                                                                      |

## Implementation steps

1. `packages/ui/src/components/combobox/combobox.interface.ts` — `onOpen?`, `onClose?`.
2. `packages/ui/src/components/combobox/Combobox.tsx` — `open()` helper (fires `onOpen` only on a
   closed → open transition), `close()` fires `onClose` only on open → closed, plus `onClick={open}`
   so a click reopens a list dismissed with `Escape`.
3. `packages/ui/test/mocks/combobox-harness.mock.tsx`, `packages/ui/test/combobox.test.tsx` —
   harness ports and four new tests (open once, close once, silent no-op, reopen on click).
4. `apps/admin/src/app/layout/layout.const.ts` — `THEME_SELECTOR_LABEL`, `THEME_SELECTOR_ID`,
   `THEME_SELECTOR_WIDTH_CLASS`, `THEME_SELECTOR_PLACEHOLDER`; icons map removed.
5. `apps/admin/src/app/layout/theme-selector.interface.ts` — `ThemeSelectorState`.
6. `apps/admin/src/app/layout/theme-selector.logic.ts` — one private `findThemeOption()` behind
   `toThemeComboboxOptions()`, `toThemeOption()`, `toThemeLabel()`.
7. `apps/admin/src/app/layout/ui/ThemeSelector.tsx` — `<label class="sr-only">` + `Combobox`,
   `onOpen` clears the query, `onClose` restores the selected label.
8. Tests: `theme-selector.logic.test.ts`, `ui/ThemeSelector.test.tsx`, `AdminHeader.test.tsx`.
9. Docs: `docs/Specs/UI-Architecture.md` (§4 combobox row, §4.1 `app/layout` row, header note).

## Gates to run

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/ui typecheck
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin lint
pnpm quality
```

## Acceptance

- Closed header control shows one value; open it lists all three appearances.
- `Escape` / blur / select restore the committed label; typing never changes the selection.
- No `data-theme`, no storage write, no navigation — asserted by the existing tests.
