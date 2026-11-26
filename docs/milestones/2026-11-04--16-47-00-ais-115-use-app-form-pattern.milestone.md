# AIS-115 — one form pattern for the admin app (`useAppForm`)

**Date:** 2026-11-04 16:47 (Europe/Budapest)
**Ticket:** AIS-115 (sub-task of AIS-103 "Form és validáció")
**Spec:** [`docs/Specs/Forms-and-Validation.md`](../Specs/Forms-and-Validation.md:1) · **Plan:** [`2026-11-04--16-31-00-ais-115-app-form-pattern-plan.md`](../plans/2026-11-04--16-31-00-ais-115-app-form-pattern-plan.md:1)

## 1. Problem / feature

Every new admin form had to re-implement the same five things by hand: the zod resolver with the
shared error map, the server-failure → field mapping, the page-level error state, the reset on
success, and the success feedback. `ApiKeyForm` carried ~40 lines of that plumbing, none of it
domain-specific.

## 2. Measured data / evidence

- `apps/admin/src` contained **zero** occurrences of `notify`/`toast` — the notification system
  (AIS-84) did not exist, so any solution had to be shippable without it.
- `ApiKeyForm.tsx` (prior state) owned `useForm`, `zodResolver`, a `setError` loop over
  `API_KEY_FIELD_PATHS`, one `useState` for the page error and the `reset` on success.
- The old loop passed `{ shouldFocus: true }` for **every** mapped field, so with two invalid
  fields the last `setError` won the focus — a latent bug, not a style issue.

## 3. Design rationale

| Decision                                                           | Why                                                                                                                                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notify` is an **injected optional port** (`FormNotifier.success`) | AIS-84 had not landed; injection keeps the two tickets independent and the behaviour assertable now (`null` ⇒ silent).                                                             |
| The hook owns no field name, no copy, no rule                      | The caller passes `schema`, ordered `fieldPaths`, `submit` — the same information `toFieldErrors` (AIS-111) already needs.                                                         |
| Error **decisions** stay in `lib/field-errors.logic.ts`            | The `quality:field-errors` gate allows branching on `error.code` only in `*.logic.ts`; the hook just applies the result.                                                           |
| Only the **first** planned entry focuses                           | Consecutive `shouldFocus: true` calls each steal focus; the declared order plus a single focus flag makes the outcome deterministic. Ordering lives in the pure `toFormErrorPlan`. |
| `handleSubmit` is the **ready** handler                            | Exposing react-hook-form's curried function would let a page bypass the validate → submit → reset → notify order.                                                                  |
| A field-addressable failure produces **no** notification           | Error toasting belongs to the global capture (AIS-84); two competing error messages on one screen is the failure mode to avoid.                                                    |

## 4. Implementation

| File                                                                                           | Change                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`use-app-form.ts`](../../apps/admin/src/features/forms/use-app-form.ts:1)                     | **new** — the hook: resolver → submit → `reset` → `notify.success` → `onSuccess`; catch → `toFieldErrors` → `setError` |
| [`use-app-form.logic.ts`](../../apps/admin/src/features/forms/use-app-form.logic.ts:1)         | **new** — `toFormErrorPlan(mapping, fieldPaths)`: ordered entries, unowned paths dropped                               |
| [`use-app-form.interface.ts`](../../apps/admin/src/features/forms/use-app-form.interface.ts:1) | **new** — options/result/port types                                                                                    |
| [`use-app-form.const.ts`](../../apps/admin/src/features/forms/use-app-form.const.ts:1)         | **new** — `APP_FORM_FIELD_ERROR_TYPE = 'server'`                                                                       |
| tests + mocks                                                                                  | **new** — 6 logic tests, 12 hook tests, fixture, consumer harness, notifier mock, deferred helper                      |
| [`docs/Specs/Forms-and-Validation.md`](../Specs/Forms-and-Validation.md:1)                     | **new** living spec (contract, submit convention, migration status)                                                    |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1)                               | §4.4 added, §5/§6 updated, header dated                                                                                |

Untouched on purpose: `ApiKeyForm.tsx` (migrates in **AIS-85**), `packages/ui`, the transport.

## 5. Outcome and how to verify

A new form now needs only a schema, the ordered field paths and a submit call; loading, error,
focus and feedback behaviour are identical across pages.

```powershell
pnpm --filter @callback/admin test        # 285 tests / 31 files green
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build       # tsc --noEmit + vite build
pnpm quality                              # layers, knip, palette, field-errors → 0 violations
```

Manual check on a page using the pattern: submit an invalid form (three Hungarian messages, no
request), submit a duplicate (message under the named input, no page `Alert`, no toast), submit a
5xx (single page `Alert` from `toErrorMessage`), then retry successfully (alert gone, fields reset,
one success notification).

## 6. Follow-ups

- **AIS-85** migrates `ApiKeyForm` to the pattern and wires the notification implementation to
  `FormNotifier` — do **not** widen the port to `error`/`info` before that ticket exists.
- A later ticket may add a `FormButton`/`FormSection` composition helper once three production
  forms exist; today the harness is the reference and the spec's code sample is the recipe.
