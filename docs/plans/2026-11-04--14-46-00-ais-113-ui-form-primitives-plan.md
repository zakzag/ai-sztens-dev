# AIS-113 — `packages/ui` form primitives

**Ticket:** AIS-113 (parent AIS-103 "Form és validáció", priority `Highest`)
**Date:** 2026-11-04 14:46 (Europe/Budapest)
**Scope:** `packages/ui` only. No admin page, no `ApiKeyForm` change (that is AIS-85), no `useAppForm` (AIS-115).

---

## 1. Why now / what exists

| Prerequisite                                         | State                                                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens, neomorphic recipes                           | ✅ `packages/ui/src/styles/theme.css`                                                                                                                              |
| `Input`, `Textarea`, `Button` (CVA + ref forwarding) | ✅ AIS-41/61                                                                                                                                                       |
| Shared format schemas (AIS-112)                      | ✅ `packages/shared/src/contract/common/*` — consumed by _callers_, not by `packages/ui`                                                                           |
| Form primitives                                      | ❌ **missing** — verified: `packages/ui/src/components/` has no `form-*`, `select`, `checkbox`, `switch`, `radio-group`, `combobox`, `date-picker`, `number-input` |

Missing primitives block AIS-115 (`useAppForm`), AIS-85 (`ApiKeyForm`), and the AIS-14…22 company pages.

---

## 2. Design decisions

| #       | Decision                                                                                                                                                                        | Reason                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | `FormField` wraps the control through a **render prop**: `children: (field: FormFieldControlProps) => ReactNode`, where `FormFieldControlProps = { id, invalid, describedBy }`. | `cloneElement` needs `as`-casts and breaks TS strict; the render prop keeps the contract explicit and type-safe.                                                        |
| **D2**  | Every control (`Select`, `NumberInput`, `DatePicker`, `Checkbox`, `Switch`, `Combobox`) uses `forwardRef` to the **native** element.                                            | react-hook-form focuses the first invalid field through the ref (`Input` already does this).                                                                            |
| **D3**  | `Select` / `NumberInput` / `DatePicker` reuse `inputVariants` instead of a new recipe.                                                                                          | One sunken-control recipe; `inputVariants` already carries `invalid`, focus ring, disabled.                                                                             |
| **D4**  | `Switch` is a native `<input type="checkbox" role="switch">` visually hidden, plus a token-styled track/thumb driven by `peer-checked:` / `peer-focus-visible:`.                | Registerable with RHF, keyboard and screen-reader correct by default, no JS state.                                                                                      |
| **D5**  | `Combobox` is **fully controlled** (`value`, `inputValue`, `onSelect`, `onInputValueChange`); filtering and the active index live in `combobox.logic.ts` as pure functions.     | Business logic out of JSX (coding standards); the logic is unit-testable without DOM.                                                                                   |
| **D6**  | `DatePicker` stays a thin `input[type="date"]`; `value`/`onChange` are `yyyy-mm-dd` strings. **No** date library, **no** `@callback/shared` import in `packages/ui`.            | Components render (rule §0.1); date conversion belongs to the caller. Avoids a new cross-package dependency and the `lib/date.ts` duplication the ticket text hints at. |
| **D7**  | a11y assertions use **`vitest-axe`** (new devDependency, `toHaveNoViolations`).                                                                                                 | Ticket DoD. New dependency ⇒ recorded in `UI-Architecture.md` §7 in the same change.                                                                                    |
| **D8**  | `Input`/`Textarea` are **not touched**; `FormField` is the mandatory route for new forms, migration of old uses is optional.                                                    | Ticket D1; no breaking change in `packages/ui`.                                                                                                                         |
| **D9**  | User-visible default strings (e.g. the empty `Select` option label, `FormActions` default button labels) live in `<primitive>.const.ts`, not in the component.                  | Coding standards: constants in `.const.ts`.                                                                                                                             |
| **D10** | Explicit exports only in `src/index.ts` (values, variants and types), no `export *`.                                                                                            | Existing convention + knip.                                                                                                                                             |

---

## 3. Files to create

```text
packages/ui/src/components/
  form-field/      form-field.interface.ts   FormField.tsx
  form-section/    form-section.interface.ts FormSection.tsx
  form-actions/    form-actions.interface.ts form-actions.const.ts  FormActions.tsx
  select/          select.interface.ts       select.const.ts        Select.tsx
  number-input/    number-input.interface.ts NumberInput.tsx
  date-picker/     date-picker.interface.ts  DatePicker.tsx
  checkbox/        checkbox.interface.ts     checkbox.variants.ts   Checkbox.tsx
  switch/          switch.interface.ts       switch.variants.ts     Switch.tsx
  radio-group/     radio-group.interface.ts  RadioGroup.tsx
  combobox/        combobox.interface.ts     combobox.logic.ts      combobox.const.ts  Combobox.tsx
```

`packages/ui/src/index.ts` — append the new exports (D10).
`packages/ui/test/setup.ts` — register `vitest-axe` matchers next to `jest-dom`.
`packages/ui/package.json` — `vitest-axe` in `devDependencies`.

### Primitive contracts (short)

| Primitive     | Key props                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `FormField`   | `id` (required), `label` (required), `hint?`, `error?`, `required?`, `children(field)`                                                   |
| `FormSection` | `legend` (required), `description?`, `children` — renders `<fieldset><legend>`                                                           |
| `FormActions` | `submitLabel`, `cancelLabel?`, `onCancel?`, `isSubmitting?`, `align?: 'start' \| 'end'` — `Button` inside (`type="submit"`, `isLoading`) |
| `Select`      | `id`, `options: readonly SelectOption[]`, `placeholder?` + native select attributes                                                      |
| `NumberInput` | `id`, `min?`, `max?`, `step?` + native input attributes                                                                                  |
| `DatePicker`  | `id`, `min?`, `max?`, `value`, `onChange(value: string)`                                                                                 |
| `Checkbox`    | `id`, `label`, `description?`, `error?`                                                                                                  |
| `Switch`      | `id`, `label`, `description?`                                                                                                            |
| `RadioGroup`  | `name`, `legend`, `options: readonly RadioOption[]`, `value`, `onChange`, `orientation?: 'vertical' \| 'horizontal'`                     |
| `Combobox`    | `id`, `options`, `value`, `inputValue`, `onSelect`, `onInputValueChange`, `emptyMessage?`                                                |

`combobox.logic.ts` exports: `filterOptions(options, query)`, `nextActiveIndex(index, direction, count)`, `clampActiveIndex(index, count)` — pure, no React.

---

## 4. Test matrix (`packages/ui/test/`)

| File                     | Covers                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-field.test.tsx`    | label→control association, `aria-describedby` = error/hint id, `aria-invalid`, error wins over hint, ref reaches the DOM node                      |
| `form-actions.test.tsx`  | submit button is `type="submit"`, `isSubmitting` disables + `aria-busy`, cancel callback fires, no cancel without `onCancel`                       |
| `select.test.tsx`        | placeholder option, option list renders, typing/selecting fires `onChange`, `invalid` class, disabled                                              |
| `number-input.test.tsx`  | `min`/`max`/`step` passthrough, invalid class, disabled                                                                                            |
| `date-picker.test.tsx`   | value round-trip as `yyyy-mm-dd`, `min`/`max`, invalid class                                                                                       |
| `checkbox.test.tsx`      | label association, toggle via click **and** keyboard (Space), indeterminate-free contract, error state                                             |
| `switch.test.tsx`        | `role="switch"`, `aria-checked` follows `checked`, keyboard toggle, disabled                                                                       |
| `radio-group.test.tsx`   | `fieldset`/`legend`, one tab stop, arrow-key selection, `value` drives `checked`                                                                   |
| `combobox.logic.test.ts` | filter case/diacritic-free matching, empty query returns all, arrow wrap at both ends, `clampActiveIndex` boundaries (0 / 1 / n)                   |
| `combobox.test.tsx`      | `role="combobox"` + `aria-expanded` + `aria-controls`, `aria-activedescendant`, ArrowDown/Up/Enter/Escape, empty state message, `onSelect` payload |
| `form-a11y.test.tsx`     | `vitest-axe` (`toHaveNoViolations`) on every new primitive in default, error and disabled state                                                    |

Rules honoured: mocks/fixtures (option arrays) in `test/mocks/`, never inline per file; no network, no timers.

---

## 5. Implementation order

1. **Harness** — add `vitest-axe` + matchers to `test/setup.ts`; `test/mocks/form-options.mock.ts`.
2. **`FormField`** (+ `FormFieldControlProps`) and `FormSection` — the contract everything else uses.
3. **`FormActions`** on top of `Button`.
4. **Native trio**: `Select`, `NumberInput`, `DatePicker` (all reusing `inputVariants`, D3).
5. **Binary inputs**: `Checkbox`, `Switch` (D4, peer-based styling).
6. **`RadioGroup`** (fieldset + options array).
7. **`Combobox`**: `combobox.logic.ts` first with its tests, then the component.
8. **`src/index.ts`** exports + `form-a11y.test.tsx` sweep.
9. **Docs**: `UI-Architecture.md` §4 (primitive rows) and §7 (`vitest-axe` row); `docs/history/2026-11-04--<hh-ii-ss>-ais-113-ui-form-primitives.md`; `docs/milestones/2026-11-04--<hh-ii-ss>-ais-113-form-primitive-contract.milestone.md`.

Each step ends with a green `pnpm --filter @callback/ui test` so a broken primitive never piles up.

---

## 6. Verification

```powershell
pnpm --filter @callback/ui test
pnpm --filter @callback/ui build
pnpm quality:tokens
pnpm quality:dead-code
pnpm test:quality
```

Gate expectations: palette gate reports **no** match under `packages/ui/src` (no hex/rgb and no palette utility classes); knip stays clean because every new export is reachable from `src/index.ts`; `pnpm --filter @callback/admin test` unaffected (nothing in `apps/admin` changes).

Manual: render the `form-a11y.test.tsx` fixtures — a keyboard-only pass over `Combobox` and `RadioGroup` must not require a mouse.

---

## 7. Risks / watch items

| Risk                                                           | Mitigation                                                                                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest-axe` peer resolution with `vitest@3` / React 18        | If it refuses to install, fall back to `axe-core` + a 15-line `expectNoViolations` helper in `test/mocks/`, and note the deviation in `UI-Architecture.md` §7.                |
| knip flags primitives that no app uses yet                     | `src/index.ts` is the package entry, so exports count as used; if a false positive appears, add a documented `ignoreExportsUsedInFile` entry rather than removing the export. |
| `peer-checked:` styling for `Switch` is invisible to RTL tests | Assert on `role="switch"` + `aria-checked` state, never on computed colours (`jsdom` has no stylesheet).                                                                      |
| `Combobox` scope creep (async search, multi-select)            | Explicitly out of scope: local options array only; async search belongs to a later ticket.                                                                                    |
| Two PRs touching `packages/ui/src/index.ts`                    | AIS-117 (overlays, Radix) is the parallel workstream — sequence the `index.ts` edits, or merge AIS-117 first.                                                                 |
