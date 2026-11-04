# AIS-113 — `packages/ui` form primitives

**Date:** 2026-11-04 15:01 (Europe/Budapest)
**Ticket:** AIS-113 (parent AIS-103, priority `Highest`)
**Plan:** [`docs/plans/2026-11-04--14-46-00-ais-113-ui-form-primitives-plan.md`](../plans/2026-11-04--14-46-00-ais-113-ui-form-primitives-plan.md:1)
**Milestone:** [`docs/milestones/2026-11-04--15-01-00-ais-113-form-primitive-contract.milestone.md`](../milestones/2026-11-04--15-01-00-ais-113-form-primitive-contract.milestone.md:1)

## What was delivered

Ten form primitives in `packages/ui/src/components/`, plus the a11y gate and the docs update.
Nothing in `apps/admin` changed: `Input`, `Textarea` and `ApiKeyForm` are untouched
(the `ApiKeyForm` migration is AIS-85, `useAppForm` is AIS-115).

| Primitive     | Folder          | Notes                                                                              |
| ------------- | --------------- | ---------------------------------------------------------------------------------- |
| `FormField`   | `form-field/`   | label + hint + error + `aria-invalid`/`aria-describedby` wiring, render-prop child |
| `FormSection` | `form-section/` | `<fieldset>` + `<legend>` field group                                              |
| `FormActions` | `form-actions/` | `type="submit"` button + optional cancel, `isSubmitting` state                     |
| `Select`      | `select/`       | native select, reuses `inputVariants`, disabled placeholder option                 |
| `NumberInput` | `number-input/` | native `input[type=number]`                                                        |
| `DatePicker`  | `date-picker/`  | controlled native `input[type=date]`, `yyyy-mm-dd` strings                         |
| `Checkbox`    | `checkbox/`     | native checkbox + label + optional description                                     |
| `Switch`      | `switch/`       | native checkbox with `role="switch"`, `peer-*` styled track                        |
| `RadioGroup`  | `radio-group/`  | controlled `<fieldset>` group, pure `nextOptionValue` for arrow keys               |
| `Combobox`    | `combobox/`     | controlled ARIA combobox, pure `combobox.logic.ts`                                 |

Supporting files:

- `packages/ui/src/index.ts` — explicit exports for every new value, variant and type.
- `packages/ui/package.json` — new devDependency `vitest-axe` (`^0.1.0`).
- `packages/ui/test/*` — 10 new test files, 100 new cases (30 files / 349 tests total in the package).
- `packages/ui/test/mocks/` — `form-options.mock.ts`, `combobox-harness.mock.ts`,
  `axe-options.mock.ts` (all fixtures/mocks live here, never inside a test file).
- `docs/Specs/UI-Architecture.md` — §4 primitive table (10 new rows), §7 dependency table
  (`vitest-axe`) and the AIS-113 note in the header.

## Decisions that differ from the first draft of the plan

1. **`FormField` gained a fourth value, `ariaProps`.** Spreading `{ id, invalid, describedBy }`
   onto a raw `<input>` writes an `invalid="false"` attribute to the DOM. The render prop now
   hands out `id`/`invalid`/`describedBy` for our primitives **and** a DOM-safe
   `ariaProps = { id, 'aria-invalid', 'aria-describedby' }` for raw elements.
2. **No `packages/ui/src/lib/date.ts`.** `DatePicker` stays a thin native wrapper with a
   `yyyy-mm-dd` string contract (plan decision **D6**); conversions belong to the caller, so no
   duplicate of `common/date-only.helper.ts` and no new cross-package dependency.
3. **No `toHaveNoViolations` matcher.** `vitest-axe@0.1` has no working type augmentation for
   Vitest 3, so `test/form-a11y.test.tsx` asserts on `results.violations` through a local
   `expectNoViolations()` helper — same gate, type-safe, and the failure output prints the
   offending node. `color-contrast` is disabled in jsdom (`AXE_JSDOM_OPTIONS`) because jsdom has
   no canvas; every structural/ARIA rule stays enabled.

## Bugs the tests caught during implementation

- `Combobox` computed the next active index from the **clamped** index, so the first ArrowDown
  highlighted the second option. Fixed by feeding the raw `activeIndex` to `nextActiveIndex`.
- `RadioGroup`'s "nothing selected yet" branch moved _down_ on ArrowUp. Fixed with an explicit
  `direction === 1 ? -1 : 0` base index.
- `aria-controls` on a closed combobox pointed at a listbox that does not exist yet (axe
  `aria-valid-attr-value`); it is now only emitted while open.

## Verification

```powershell
pnpm --filter @callback/ui test    # 30 files, all green
pnpm --filter @callback/ui build   # tsc --noEmit clean
pnpm quality                       # layers + knip + palette + field-error gates all green
```

## Build fix found after the ticket (same session)

`pnpm build` failed in `apps/admin` on untouched code:

```text
src/pages/api-keys/ui/ApiKeyForm.tsx(59,27): error TS2345:
  Type 'ZodObject<…>' is missing the following properties from type
  'ZodType<any, any, $ZodTypeInternals<any, any>>': def, type, toJSONSchema, check, and 20 more.
```

Root cause — two zod versions and an implicit peer resolution:

- `knip@5` (repo root, dev-only) depends on **zod 4.6.7**; pnpm hoists it into
  `node_modules/.pnpm/node_modules/zod`.
- `@hookform/resolvers@3.10.0` declares `zod` only as a **peer** and its `zod` entry has no own
  copy, so `import { z } from 'zod'` in its `.d.ts` resolved to that zod 4 → `z.Schema` became
  zod 4's `$ZodType`, which a zod 3 `ZodObject` can never satisfy.
- Runtime was always fine (Vite bundles the app's zod 3); only `tsc` broke.

Fix in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml:1), not in app code and with **no casts**:

```yaml
packageExtensions:
  '@hookform/resolvers':
    dependencies:
      zod: ^3.24.1
```

Rejected alternative: `overrides: { zod: 3.25.76 }` — it makes knip resolve a zod 3 subpath it does
not export (`ERR_PACKAGE_PATH_NOT_EXPORTED`). The same file documents both so nobody "simplifies"
the extension back into an override.

Verification after `pnpm install`: `pnpm build` (all six projects), `pnpm quality`, `pnpm test`
(five suites) and `pnpm -r lint` all green.

## Follow-ups

- **AIS-115** (`useAppForm`) is now unblocked: it composes `FormField` + `FormActions` and maps
  server field errors through `toFieldErrors`.
- **AIS-85** migrates `ApiKeyForm` onto `FormField`/`FormActions` (after AIS-115).
- **AIS-117** (overlay primitives) is the other parallel UI workstream; sequence the
  `src/index.ts` edits so two PRs do not touch the same export block.
- `Combobox` is local-options only — async search and multi-select are deliberately out of scope.
