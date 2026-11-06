# AIS-148 — appearance selector as a combobox

**Date:** 2026-11-06
**Ticket:** AIS-148 (follow-up of AIS-147)
**Plan:** [`2026-11-06--21-40-00-ais-148-theme-selector-combobox-plan.md`](../plans/2026-11-06--21-40-00-ais-148-theme-selector-combobox-plan.md)
**Milestone:** [`2026-11-06--21-40-00-ais-148-theme-selector-combobox.milestone.md`](../milestones/2026-11-06--21-40-00-ais-148-theme-selector-combobox.milestone.md)

## What changed

The header's appearance selector is no longer a horizontal, icon-based `RadioGroup` with three
always-visible options. It is a **combobox** (`@callback/ui` `Combobox`): closed it shows only the
appearance the user picked, open it lists all three and stays searchable.

| File                                                                                                                             | Change                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/ui/src/components/combobox/combobox.interface.ts`](../../packages/ui/src/components/combobox/combobox.interface.ts:1) | two optional ports: `onOpen?`, `onClose?`                                                                                               |
| [`packages/ui/src/components/combobox/Combobox.tsx`](../../packages/ui/src/components/combobox/Combobox.tsx:63)                  | `open()` / `close()` report the popup **transition** exactly once; `onClick={open}` reopens a list dismissed with `Escape`              |
| [`packages/ui/test/combobox.test.tsx`](../../packages/ui/test/combobox.test.tsx:111)                                             | +4 tests (open once, close once, silent no-op, reopen on click)                                                                         |
| [`packages/ui/test/mocks/combobox-harness.mock.tsx`](../../packages/ui/test/mocks/combobox-harness.mock.tsx:6)                   | harness forwards the two new ports                                                                                                      |
| [`apps/admin/src/app/layout/layout.const.ts`](../../apps/admin/src/app/layout/layout.const.ts:42)                                | `THEME_SELECTOR_LABEL`, `THEME_SELECTOR_ID`, `THEME_SELECTOR_WIDTH_CLASS`, `THEME_SELECTOR_PLACEHOLDER`; `THEME_OPTION_ICONS` removed   |
| [`apps/admin/src/app/layout/theme-selector.interface.ts`](../../apps/admin/src/app/layout/theme-selector.interface.ts:1)         | `ThemeSelectorState` (`selected` + `query` in one object)                                                                               |
| [`apps/admin/src/app/layout/theme-selector.logic.ts`](../../apps/admin/src/app/layout/theme-selector.logic.ts:1)                 | one private `findThemeOption()` behind `toThemeComboboxOptions()`, `toThemeOption()`, `toThemeLabel()`; `toThemeRadioOptions()` removed |
| [`apps/admin/src/app/layout/ui/ThemeSelector.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.tsx:1)                       | `<label class="sr-only">` + `Combobox`; `onOpen` clears the query, `onClose` restores the selected label                                |
| `theme-selector.logic.test.ts`, `ui/ThemeSelector.test.tsx`, `AdminHeader.test.tsx`                                              | rewritten / updated for the combobox roles (`combobox`, `listbox`, `option`)                                                            |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1)                                                         | combobox row (§4), `app/layout` row (§4.1), header note                                                                                 |

## Decisions worth remembering

- **The filter text is not the selection.** A prefilled input filters the listbox down to that single
  entry, so opening the control would show one option and the user had to clear it by hand.
  `onOpen` drops the text, `onClose` restores the label — the two ports make the contract explicit
  instead of hiding it in the page.
- **`onOpen`/`onClose` report transitions, not states.** They fire only when the popup actually
  changed, so a blur of an already-closed field cannot reset the text a second time.
- **`onClick={open}`** was a real bug found by a test: `Escape` closes the listbox but leaves the
  input focused, so clicking it again fired no `focus` event and the popup never reopened.
- **Icons are gone on purpose.** A listbox option is text-only; the AIS-144 icon assets stay in
  `packages/ui` for `RadioGroup`-based forms (AIS-140 `D9` only rejected `Select` because of icons).
- **The theme is still not applied.** The selector remains a UI contract: local `useState`,
  `onThemeChange` port, no `data-theme`, no storage (AIS-140 `D3`).

## Gates

| Command                              | Result                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| `pnpm --filter @callback/ui test`    | green (combobox 14, form-a11y 6)                         |
| `pnpm --filter @callback/admin test` | green (layout suite, `ThemeSelector` 7, `AdminHeader` 7) |
| `pnpm quality`                       | 0 violations                                             |
