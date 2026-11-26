# AIS-149 — Appearance selector as a plain select box (with icons)

**Date:** 2026-11-06 · **Ticket:** AIS-149 · **Supersedes:** AIS-148 (combobox)

## Goal

The header control must behave like a **select box**, not a combobox: no search field, no
filter text, no open/close state to mirror. Closed it shows the chosen appearance **with its
icon**; opening it lists the three appearances, each with its icon.

## Why the combobox was the wrong shape

`Combobox` filters its list with `inputValue`. Showing the selection in the input reduced the
open list to a single entry, so AIS-148 added `onOpen`/`onClose` ports to clear and restore that
text — three moving parts for a three-item choice. A select has no text at all, so the whole
problem disappears instead of being managed.

## Decisions

| #   | Decision                                                                  | Why                                                                                                                                                               |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | New primitive `SelectMenu` in `packages/ui`                               | A single-choice menu is a new visual concept; it must exist once, not inline in the header                                                                        |
| D2  | Radix `DropdownMenu` + `RadioGroup`/`RadioItem`                           | `menuitemradio` + `aria-checked`, arrow keys, `Escape`, focus return and portalling come free — and the surface/item recipes are the existing `DropdownMenu` ones |
| D3  | The trigger reuses the `Button` `secondary`/`sm` recipe                   | No second button concept; the header keeps one control look                                                                                                       |
| D4  | Trigger named `"<label>: <chosen label>"`                                 | WCAG "label in name": the visible text must be part of the accessible name, and a screen reader still learns what the value belongs to                            |
| D5  | Icons are data (`icon?: ReactNode`), marked `aria-hidden` by the icon set | The name of an option stays the label; the icon never doubles the announcement                                                                                    |
| D6  | `Combobox`'s `onOpen`/`onClose` ports removed, `onClick` reopen kept      | The ports existed only for this selector. The click-to-reopen is a real primitive bug (`Escape` keeps focus, so a second click fired no `focus`), so it stays     |

## Steps

1. `packages/ui/src/components/icon/icons.tsx` + `index.ts` — new `ChevronDownIcon` (Lucide geometry).
2. `packages/ui/src/components/select-menu/` — `select-menu.interface.ts`, `select-menu.const.ts`,
   `select-menu.logic.ts` (`toSelectedOption`, `toTriggerLabel`), `SelectMenu.tsx`.
3. `packages/ui/src/index.ts` — export the component, its constants, logic and types.
4. `packages/ui/test/select-menu.test.tsx` + `test/mocks/select-menu.mock.tsx` — 7 tests.
5. `apps/admin/src/app/layout/` — `layout.const.ts` restores `THEME_OPTION_ICONS`,
   `theme-selector.logic.ts` maps to `SelectMenuOption[]`, `ui/ThemeSelector.tsx` renders `SelectMenu`.
6. `apps/admin/src/test/mocks/overlay-environment.mock.ts` — the Radix shims the admin suite now needs.
7. Tests: `theme-selector.logic.test.ts`, `ui/ThemeSelector.test.tsx`, `AdminHeader.test.tsx`.
8. Docs: `docs/Specs/UI-Architecture.md` (§4 new `SelectMenu` row, §4.1 `app/layout` row, header note).

## Gates

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/ui typecheck
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin lint
pnpm quality
```
