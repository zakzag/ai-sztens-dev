# Milestone — appearance selector becomes a combobox (AIS-148)

## Problem / feature

AIS-147 shipped the admin header with a horizontal `RadioGroup` appearance selector: three
labelled options with decorative icons always visible in a `h-14` band. The requirement was a
compact **combo box** that shows **only the last selected appearance** while closed.

## Measured data / evidence

The primitive decides the shape of the solution: `Combobox` filters its option list with
`filterOptions(options, inputValue)`. With the selected label in the input (`value="Sötét"`),
opening the control produced exactly **one** option:

```text
× opens the three appearances on focus and marks the selected one
  → expected [ 'Sötét' ] to deeply equal [ 'Világos', 'Sötét', 'Ambient' ]
```

A second failure showed that after `Escape` the input keeps focus, so a click fired no `focus`
event and the listbox never reopened.

## Root cause / design rationale

- **A prefilled input is a filter, not a value.** A combobox whose text equals the selection
  cannot list the alternatives; the text must be dropped while the popup is open and restored
  when it closes. That needs a signal for both transitions — the primitive only had `onSelect`.
- **Alternatives considered.** (a) `DropdownMenu` — better visuals (icon + check rows) but it is a
  row-action menu; single-select semantics (`menuitemradio`) plus icon/label support would have
  meant a new primitive. (b) Native `Select` — simplest, but the popup is OS-rendered and breaks
  the neomorphic overlay language; AIS-140 `D9` had rejected it only because `<option>` cannot
  carry an SVG icon, a constraint that disappeared with the icons. (c) `Combobox` — chosen: it is
  the design-system combo box, its popup already uses the overlay token recipe, and its filtering
  is what makes a search field useful even for three entries.
- **State stays local.** The theme is still applied nowhere (AIS-140 `D3`), so the selector keeps a
  local `useState` with a single object (`ThemeSelectorState`) holding both the selection and the
  query — the restore is one atomic update.

## Solution / implementation

| File                                                                                | Change                                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/combobox/combobox.interface.ts`                         | `onOpen?`, `onClose?` ports, documented as **transition** reports                                             |
| `packages/ui/src/components/combobox/Combobox.tsx`                                  | `open()`/`close()` helpers fire a port only on a real state change; `onClick={open}` reopens a dismissed list |
| `packages/ui/test/combobox.test.tsx`, `test/mocks/combobox-harness.mock.tsx`        | +4 tests, harness forwards both ports                                                                         |
| `apps/admin/src/app/layout/layout.const.ts`                                         | `THEME_SELECTOR_LABEL`/`_ID`/`_WIDTH_CLASS`/`_PLACEHOLDER`; `THEME_OPTION_ICONS` removed                      |
| `apps/admin/src/app/layout/theme-selector.interface.ts`                             | `ThemeSelectorState`                                                                                          |
| `apps/admin/src/app/layout/theme-selector.logic.ts`                                 | `findThemeOption()` behind `toThemeComboboxOptions()`, `toThemeOption()`, `toThemeLabel()`                    |
| `apps/admin/src/app/layout/ui/ThemeSelector.tsx`                                    | `sr-only` `<label>` + `Combobox`; `onOpen` clears, `onClose` restores                                         |
| `theme-selector.logic.test.ts`, `ui/ThemeSelector.test.tsx`, `AdminHeader.test.tsx` | adapted to `combobox` / `listbox` / `option` roles                                                            |
| `docs/Specs/UI-Architecture.md`                                                     | §4 combobox row, §4.1 `app/layout` row, dated header note                                                     |

## Outcome and how to verify

The header band holds one control: closed it reads e.g. `Sötét`, focused it lists `Világos`,
`Sötét`, `Ambient` with the current one marked `aria-selected`, and `Escape` / blur / pick restores
the chosen label. Nothing is applied to the document and nothing is persisted.

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/admin typecheck
pnpm quality
```

Manual check: `pnpm dev`, open `/api-keys`, click the `Megjelenés` field — the list must show all
three appearances even though the field showed a value a moment earlier, and the field must be
back to the chosen label after `Escape`.

## Follow-ups

- The combobox is text-first: a pointer-only user still sees a text field rather than a
  button-with-chevron. A dedicated select-style trigger would be a new primitive, not a variant.
- The theme is still a UI contract (AIS-140 `D3`): `onThemeChange` remains a no-op until the
  theming story lands.
