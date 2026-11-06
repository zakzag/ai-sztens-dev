# AIS-144 — icon set (Lucide SVG) + `RadioOption.icon`

**Date:** 2026-11-06
**Ticket:** AIS-144 (subtask of AIS-140)
**Plan:** [`docs/plans/2026-11-06--18-15-00-ais-144-icon-set-radio-icon-plan.md`](../plans/2026-11-06--18-15-00-ais-144-icon-set-radio-icon-plan.md)

## What was built

`packages/ui` got an icon vocabulary and `RadioGroup` learned to render an
option icon. No app code changed, and **no npm dependency was added**.

## Changed files

| File                                                              | Change                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/icon/icon.interface.ts` (new)         | `IconProps { className?: string }` — no `size`, no `color`, documented as such.                                      |
| `packages/ui/src/components/icon/icon.const.ts` (new)             | `ICON_BASE_CLASS` (`h-4 w-4 shrink-0`), `ICON_STROKE_WIDTH`, `ICON_VIEW_BOX`.                                       |
| `packages/ui/src/components/icon/icons.tsx` (new)                 | `SunIcon`, `MoonIcon`, `SunsetIcon`, `SettingsIcon`, `ChevronRightIcon`; one shared `ICON_BASE_PROPS` object.        |
| `packages/ui/src/index.ts`                                        | Explicit exports for the five icons + `IconProps`.                                                                  |
| `packages/ui/src/components/radio-group/radio-group.interface.ts` | `RadioOption.icon?: ReactNode` with the decorative-only JSDoc contract.                                             |
| `packages/ui/src/components/radio-group/RadioGroup.tsx`           | Conditional icon render; `aria-hidden` wrapper; no-icon markup untouched.                                          |
| `packages/ui/test/mocks/icon-options.mock.tsx` (new)              | `ICON_RADIO_OPTIONS`, `ICON_RADIO_OPTIONS_WITH_DESCRIPTION` fixtures.                                               |
| `packages/ui/test/icon.test.tsx` (new)                            | Attribute contract for all five icons + `className` merge/override.                                                 |
| `packages/ui/test/radio-group.test.tsx`                           | Eight icon cases (render, aria-hidden, accessible name, click, checked, disabled, keyboard, description layout).    |
| `packages/ui/test/form-a11y.test.tsx`                             | One `axe` case with `ICON_RADIO_OPTIONS`.                                                                           |
| `docs/Specs/UI-Architecture.md`                                   | §4 `RadioGroup` row + icon-set paragraph, §7 "no dependency" note, header date.                                     |

## Decisions worth remembering

1. **Default size class.** Every icon ships `h-4 w-4 shrink-0`, merged with the
   caller class through `cn()`. An SVG carrying only a `viewBox` has no
   intrinsic size and stretches to its container — leaving sizing entirely to
   the caller would have shipped a visual bug. The caller still overrides with
   `h-6 w-6`; the API stays `className`-only.
2. **Conditional wrapper in `RadioGroup`.** The icon + text pair is wrapped in
   an `inline-flex items-center gap-2` span **only when** `option.icon` exists,
   so the no-icon DOM is byte-identical (the existing suite is the proof) and
   `description` keeps its own `block` line.
3. **Icons are decorative.** `aria-hidden="true"` + `focusable="false"` on every
   SVG, plus an `aria-hidden` wrapper in `RadioGroup`. The accessible name of an
   option is the `label` text only — verified by
   `getByRole('radio', { name: 'Világos' })`.
4. **No icon package.** Five inline Lucide SVGs (ISC, source URL in each JSDoc)
   on one 24×24 stroke grid; `packages/ui/package.json` is unchanged and §7 of
   the spec gained a note instead of a row.

## Verification

| Command                            | Result                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| `pnpm --filter @callback/ui test`  | 42 files, 365 tests passed                                        |
| `pnpm typecheck`                   | passed (all workspaces)                                           |
| `pnpm lint`                        | passed (all workspaces)                                           |
| `pnpm quality`                     | layers ✔, knip ✔ (no issues), tokens ✔, field-errors ✔, docs ✔    |

## Follow-ups

- AIS-145 (`Breadcrumb`) consumes `ChevronRightIcon`, AIS-147 (admin header)
  consumes `SunIcon` / `MoonIcon` / `SunsetIcon` / `SettingsIcon`.
- `Select` still cannot carry icons (`SelectOption.label: string` → native
  `<option>`), which is exactly why the theme picker uses `RadioGroup`.
