# AIS-113 — the form primitive contract of `@callback/ui`

**Date:** 2026-11-04 15:01 (Europe/Budapest)
**Ticket:** AIS-113 · **Parent:** AIS-103 (Form and validation)
**Plan:** [`2026-11-04--14-46-00-ais-113-ui-form-primitives-plan.md`](../plans/2026-11-04--14-46-00-ais-113-ui-form-primitives-plan.md:1)

## 1. Problem

The admin app had exactly three field components (`Input`, `Textarea`, `Button`) and one hand-written
form (`ApiKeyForm`). Every new form would have re-implemented the same markup: a filled-out label,
an error paragraph with the right `id`, `aria-invalid`, `aria-describedby`, a submit row, and the
focused-first-invalid-field dance. AIS-103 (forms) and the upcoming company pages (AIS-14…22) all
depend on that markup existing **once**. Without it, AIS-115 (`useAppForm`) had nothing to compose
and AIS-85 could not migrate `ApiKeyForm`.

## 2. Evidence

Inventory before the change (`packages/ui/src/components/`): `alert`, `badge`, `banner`, `button`,
`card`, `data-table`, `description-list`, `empty-state`, `input`, `pagination`, `skeleton`,
`spinner`, `status-badge`, `table`, `textarea` — **no** form wrapper, no `select`, no `checkbox`,
no `switch`, no `radio`, no combobox, no date field. The AIS-105 audit recorded the same gap and
ordered it as Wave C2, strictly before AIS-115.

## 3. Design rationale

| Decision                                                                         | Why                                                                                                                        | Rejected alternative                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `FormField` uses a **render prop** (`children: (field) => ReactNode`)            | Stays type-safe under TS strict; nothing is mutated behind the caller's back                                               | `cloneElement` (needs casts, breaks with fragments); hidden context (implicit dependency)                      |
| Two shapes for the child: `id`/`invalid`/`describedBy` **and** `ariaProps`       | Our primitives take props, raw DOM elements take attributes; spreading `invalid` onto `<input>` leaks an invalid attribute | One shape only (either primitive props cannot reach raw inputs, or DOM attributes cannot reach our components) |
| `Select`/`NumberInput`/`DatePicker` reuse `inputVariants`                        | One sunken-control recipe; new fields cannot drift from `Input`                                                            | A second recipe per field type                                                                                 |
| `Switch` = native `checked` input with `role="switch"`                           | Keyboard, form serialisation and react-hook-form work with zero JS state                                                   | `button[role=switch]` + hidden input (two sources of truth)                                                    |
| `Combobox` fully controlled, logic in `combobox.logic.ts`                        | Components render; filtering and index maths stay pure and unit-testable                                                   | Component-owned query state (the form layer then has to fight it)                                              |
| `DatePicker` = thin native `input[type=date]`, `yyyy-mm-dd` strings, no date lib | No second date parser next to `common/date-only.helper.ts`, no new dependency in a UI package                              | `lib/date.ts` conversions + `@callback/shared` import inside `packages/ui`                                     |
| a11y gate with `vitest-axe`, asserting on `results.violations`                   | Ticket DoD; the 0.1 matcher has no working Vitest 3 types, the assertion form does                                         | Custom matcher (type-level break); no a11y gate at all                                                         |

`Input` and `Textarea` were **not** changed (plan D8), so no existing caller broke.

## 4. Implementation

| File                                        | Change                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/form-field/*`   | `FormField` + `FormFieldProps`/`FormFieldControlProps`/`FormFieldAriaProps`                                                                           |
| `packages/ui/src/components/form-section/*` | `FormSection` (`fieldset`/`legend`/description)                                                                                                       |
| `packages/ui/src/components/form-actions/*` | `FormActions` + `form-actions.const.ts` (Hungarian default labels)                                                                                    |
| `packages/ui/src/components/select/*`       | native `Select` + `select.const.ts` (`SELECT_PLACEHOLDER_VALUE`)                                                                                      |
| `packages/ui/src/components/number-input/*` | `NumberInput`                                                                                                                                         |
| `packages/ui/src/components/date-picker/*`  | `DatePicker` (controlled, `yyyy-mm-dd`)                                                                                                               |
| `packages/ui/src/components/checkbox/*`     | `Checkbox` + `checkbox.variants.ts`                                                                                                                   |
| `packages/ui/src/components/switch/*`       | `Switch` + `switch.variants.ts` (peer-styled track)                                                                                                   |
| `packages/ui/src/components/radio-group/*`  | `RadioGroup`, `radio-group.logic.ts` (`nextOptionValue`, `toRadioId`), variants                                                                       |
| `packages/ui/src/components/combobox/*`     | `Combobox`, `combobox.logic.ts` (`filterOptions`, `normalizeQuery`, `nextActiveIndex`, `clampActiveIndex`, `toComboboxOptionId`), `combobox.const.ts` |
| `packages/ui/src/index.ts`                  | explicit exports for every new value/variant/type                                                                                                     |
| `packages/ui/package.json`                  | `vitest-axe` devDependency                                                                                                                            |
| `packages/ui/test/*` (10 new files)         | per-primitive RTL suites, two logic suites, `form-a11y.test.tsx`                                                                                      |
| `packages/ui/test/mocks/*` (3 new files)    | option fixtures, controlled-combobox harness, jsdom axe options                                                                                       |
| `docs/Specs/UI-Architecture.md`             | §4 table (10 rows), §7 `vitest-axe` row, header note                                                                                                  |

Bugs caught by the new tests on the way: combobox arrow-down skipped the first option (clamped vs.
raw index), radio ArrowUp moved down when nothing was selected, `aria-controls` referenced a
listbox that only exists while open.

## 5. Outcome and verification

```powershell
pnpm --filter @callback/ui test      # 30 files green (349 tests)
pnpm --filter @callback/ui build     # tsc --noEmit clean
pnpm quality                         # dependency-cruiser, knip, palette, field-error gates: 0 violations
```

Expected state: any new admin form is written as `FormSection` → `FormField` → primitive →
`FormActions`, and no page file contains a `<label>`, an error `<p id="…-error">` or an
`aria-invalid` attribute again. Keyboard-only usage of `Combobox` and `RadioGroup` is covered by
tests (ArrowUp/Down, Enter, Escape, Space).

## 6. Follow-ups

- **AIS-115** `useAppForm` composes these primitives (unblocked by this ticket).
- **AIS-85** migrates `ApiKeyForm` (after AIS-115, together with the notification story).
- **AIS-117** overlay primitives — sequence the `src/index.ts` export edits to avoid a PR conflict.
- Out of scope on purpose: async/remote combobox search, multi-select, and any date conversion
  helper inside `packages/ui`.

## 7. Post-script — the `pnpm build` failure this ticket surfaced

The ticket touched nothing in `apps/admin`, yet `pnpm build` failed there:

```text
ApiKeyForm.tsx(59,27): error TS2345: Type 'ZodObject<…>' is missing the following properties
  from type 'ZodType<any, any, $ZodTypeInternals<any, any>>': def, type, toJSONSchema, check, …
```

**Diagnosis.** Two zod versions in the graph: the apps use zod **3.25.76**, while `knip@5`
(dev-only) brings zod **4.6.7**, which pnpm hoists into `node_modules/.pnpm/node_modules/zod`.
`@hookform/resolvers` declares `zod` only as a **peer** and has no own copy, so the `import { z }
from 'zod'` inside its `.d.ts` resolved to the hoisted zod 4 — making its constraint
`T extends z.Schema<any, any>` a zod-4 type. Runtime was never affected (Vite bundles zod 3).

**Fix.** `pnpm-workspace.yaml > packageExtensions` injects a real `zod: ^3.24.1` dependency into
`@hookform/resolvers`, so it type-checks against the same zod 3 the app uses; knip keeps its zod 4.
No cast, no `@ts-expect-error`, no app-code change.

**Rejected.** `overrides: { zod: 3.25.76 }` (single-version graph): knip then imports a zod subpath
v3 does not export → `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Verify.** `pnpm install` then `pnpm build` (6/6 projects), `pnpm quality` (4 gates),
`pnpm test` (5 suites), `pnpm -r lint` — all green. Documented also in
[`UI-Architecture.md` §7](../Specs/UI-Architecture.md:1) so the extension is not "simplified" back
into an override.
