# AIS-115 — `useAppForm` (shared form pattern: validation, field errors, submit/toast convention)

**Ticket:** AIS-115 (parent AIS-103 "Form és validáció", priority `High`, Subtask)
**Date:** 2026-11-04 16:31 (Europe/Budapest)
**Scope:** `apps/admin/src/features/forms/**` + tests + docs. **No** `ApiKeyForm.tsx` change (that is AIS-85), **no** `packages/ui` change, **no** notification implementation (AIS-84/85), no new npm dependency.

---

## 1. Why now / what already exists

| Prerequisite                                            | State                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIS-111 — one failure → form mapping                    | ✅ [`field-errors.logic.ts`](../../apps/admin/src/lib/field-errors.logic.ts:1) — `toFieldErrors(error, { fieldPaths, defaultPathByCode })` → `{ fields, form }`                         |
| AIS-111 — error code catalogue + copy                   | ✅ [`api-error-code.const.ts`](../../apps/admin/src/lib/api-error-code.const.ts:1), [`error-message.const.ts`](../../apps/admin/src/lib/error-message.const.ts:1)                       |
| AIS-113 — form primitives                               | ✅ `FormField` (render prop, `error`/`hint`), `FormSection`, `FormActions` (`isSubmitting` → `disabled` + `aria-busy`)                                                                  |
| AIS-114 — generic API hooks                             | ✅ [`use-api-mutation.ts`](../../apps/admin/src/features/api/use-api-mutation.ts:1) — `mutateAsync` **rejects with the raw error**, `isPending`, `isSuccess`, `successMessage`, `reset` |
| AIS-112 — schema derivation + Hungarian validation copy | ✅ `apiKeyFormSchema` in [`api-keys.logic.ts`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:1), `VALIDATION_ERROR_MAP`                                                         |
| Notification system                                     | ❌ **does not exist** — no `notify`/`toast` symbol anywhere under `apps/admin/src` (verified by search)                                                                                 |
| `useAppForm`                                            | ❌ missing — every new form still repeats the `ApiKeyForm` wiring (resolver, `setError` loop, page-error `useState`, reset)                                                             |

The duplication is already visible: `ApiKeyForm` owns ~40 lines of infrastructure that has nothing to do with API keys.

---

## 2. Design decisions

| #       | Decision                                                                                                                                                                                                      | Reason                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1**  | The hook takes `schema`, `defaultValues`, `fieldPaths`, `submit` **from the caller**. It contains no domain knowledge (no field names, no copy, no business rule).                                            | Ticket D1. `toFieldErrors` already takes the target; the hook is only the composition point.                                                                       |
| **D2**  | `notify` is an **injected, optional port**: `notify?: FormNotifier \| null` where `FormNotifier = { success(message: string): void }`. Omitted/`null` ⇒ the hook stays silent. Never imports a toast library. | Ticket D2. AIS-84 has not landed; injection keeps the two tickets independent and testable (`test/mocks/form-notifier.mock.ts`).                                   |
| **D3**  | Deterministic focus: field errors are applied in the **declared `fieldPaths` order**, and only the **first** entry gets `{ shouldFocus: true }`.                                                              | Ticket D3. Multiple `setError(..., { shouldFocus: true })` calls fight each other and the last one wins — the `ApiKeyForm` loop has exactly that latent bug today. |
| **D4**  | A field-addressable failure produces **no** notification; only the page-level `formError` (Alert) speaks. Success is the only `notify.success` call site; the hook never calls `notify.error`.                | Ticket D4 + AIS-84's global capture owns error toasting; two competing error messages on one screen is the failure mode to avoid.                                  |
| **D5**  | The error → text/field decision stays in `lib/field-errors.logic.ts`; the hook only _applies_ the result. `use-app-form.ts` must not contain `instanceof ApiError`, `.code ===` or `error.status ===`.        | `quality:field-errors` gate (`scripts/quality/field-error-gate.const.mjs`): only `*.logic.ts` may branch on an error.                                              |
| **D6**  | Ordering/isolation of the mapping result lives in a pure function `toFormErrorPlan(mapping, fieldPaths)` in `use-app-form.logic.ts` — ordered `entries`, dropped unknown paths, `formMessage`.                | Rule §5: decisions in pure `*.logic.ts`, the hook only orchestrates; fully unit-testable without React.                                                            |
| **D7**  | The hook exposes a **narrow** `formState: { isSubmitting, isDirty, isValid }` instead of the raw RHF proxy.                                                                                                   | Simple named type, no RHF internals in consumer types, no proxy-refresh surprises in tests.                                                                        |
| **D8**  | Submit clears `formError` and `clearErrors()` **before** calling `submit`, and calls `reset(defaultValues)` **after** success — before `notify.success` and `onSuccess`.                                      | A stale server error must not survive a retry; the order guarantees the toast never announces state React has not applied yet.                                     |
| **D9**  | `setServerError(error: unknown)` is exported separately from the internal catch, for callers that submit outside `handleSubmit`. Same mapping, same focus rule.                                               | The ticket's return type requires it; one implementation serves both paths.                                                                                        |
| **D10** | `useAppForm` is a **features** hook, consumed only by pages. The consumer renders `FormField` (AIS-113) and spreads `register(path)` onto the control; the hook never renders markup.                         | Layer map: `features` has no JSX.                                                                                                                                  |

---

## 3. Contract

```ts
// apps/admin/src/features/forms/use-app-form.interface.ts
export type FieldPath<FV extends FieldValues> = Extract<Path<FV>, string>;

export interface FormNotifier {
  /** Shows the success message; AIS-84 provides the implementation. */
  readonly success: (message: string) => void;
}

export interface AppFormState {
  readonly isSubmitting: boolean;
  readonly isDirty: boolean;
  readonly isValid: boolean;
}

export interface UseAppFormOptions<FV extends FieldValues> {
  readonly schema: ZodType<FV>; // derived from a @callback/shared request schema
  readonly defaultValues: FV;
  readonly fieldPaths: readonly FieldPath<FV>[]; // visual order = focus order
  readonly submit: (values: FV) => Promise<unknown>;
  readonly defaultPathByCode?: Readonly<Record<string, FieldPath<FV>>>;
  readonly notify?: FormNotifier | null;
  readonly successMessage?: string;
  readonly onSuccess?: () => void;
}

export interface UseAppFormResult<FV extends FieldValues> {
  readonly register: UseFormRegister<FV>;
  readonly handleSubmit: UseFormHandleSubmit<FV>;
  readonly errors: FieldErrors<FV>;
  readonly formState: AppFormState;
  readonly formError: string | null;
  readonly reset: () => void;
  readonly setServerError: (error: unknown) => void;
  readonly clearFormError: () => void;
}
```

`use-app-form.logic.ts` (pure, no React):

```ts
export interface FormErrorEntry<F extends string> {
  readonly path: F;
  readonly message: string;
}
export interface FormErrorPlan<F extends string> {
  readonly entries: readonly FormErrorEntry<F>[];
  readonly formMessage: string | null;
}
export function toFormErrorPlan<F extends string>(
  mapping: FieldErrorMapping<F>,
  fieldPaths: readonly F[],
): FormErrorPlan<F>;
```

Behaviour: `entries` follow `fieldPaths` order, contain only paths present in `mapping.fields`, at most one entry per path; `formMessage = mapping.form`.

---

## 4. Files to create

```text
apps/admin/src/features/forms/
  use-app-form.interface.ts          types above + FormNotifier + AppFormState + FormErrorPlan
  use-app-form.logic.ts              toFormErrorPlan (pure)
  use-app-form.const.ts              APP_FORM_FIELD_ERROR_TYPE = 'server'
  use-app-form.ts                    the hook (RHF + zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP }) + toFieldErrors)
  use-app-form.logic.test.ts
  use-app-form.test.tsx

apps/admin/src/test/mocks/
  form-notifier.mock.ts              createFormNotifierMock() → vi.fn + typed FormNotifier
  app-form.fixture.ts                harness zod schema, defaults, field paths, ApiError factory reuse
```

`handleSubmit` wiring (the frozen submit convention):

| Step        | Behaviour                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| validate    | `handleSubmit` + `zodResolver` — an invalid form **never** reaches `submit`; the Hungarian message is already on the field |
| pending     | `formState.isSubmitting` → consumer passes it to `FormActions isSubmitting` (`disabled` + `aria-busy` + pending label)     |
| success     | `reset(defaultValues)` → `notify?.success(successMessage)` → `onSuccess?.()`                                               |
| field error | `toFormErrorPlan(toFieldErrors(...))` → `setError(path, { type: 'server', message }, { shouldFocus })`, first entry only   |
| page-level  | `mapping.form` → `formError`, rendered by the caller as `<Alert variant="danger">` above the form                          |

---

## 5. Test matrix

| File                         | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-app-form.logic.test.ts` | order follows `fieldPaths` (not object insertion); unknown paths dropped; duplicates collapse; fields-only ⇒ `formMessage === null`; form-only ⇒ empty `entries`; both empty                                                                                                                                                                                                                                                                                                                                                                                                        |
| `use-app-form.test.tsx`      | **valid** → `submit` called once with parsed values, reset to defaults, `notify.success(successMessage)`, `onSuccess` called; **invalid** → `submit` not called, `errors.<path>.message` is Hungarian; **`ApiError` with `issues[]`** → field error, `formError === null`, `notify` silent; **unmapped path** → `formError` set, no field error; **non-`ApiError` (500 / offline)** → `formError` from `toErrorMessage`; **no `notify`** → no throw, silence; **`isSubmitting`** true during flight, false after; **`setServerError`** outside `handleSubmit` uses the same mapping |

Rules honoured: mocks/fixtures live in `src/test/mocks/**` only, no network, no fake timers, `submit` always a mock.

---

## 6. Implementation order

1. `use-app-form.interface.ts` + `use-app-form.const.ts` — freeze the contract.
2. `use-app-form.logic.ts` + its tests (pure, red→green before any React).
3. `test/mocks/form-notifier.mock.ts`, `test/mocks/app-form.fixture.ts`.
4. `use-app-form.ts` (resolver → submit → catch → plan → `setError`), then `use-app-form.test.tsx`.
5. Docs: new living spec `docs/Specs/Forms-and-Validation.md` (pattern, submit table, D1–D4, notify port, "ApiKeyForm migrates in AIS-85"); update `docs/Specs/UI-Architecture.md` §4.3 (link to the new spec) and §6 recipe step 3.
6. `docs/history/2026-11-04--<hh-ii-ss>-ais-115-use-app-form-pattern.md` + `docs/milestones/2026-11-04--<hh-ii-ss>-ais-115-use-app-form-pattern.milestone.md` (D1–D4 must survive the chat).

Each step ends with a green `pnpm --filter @callback/admin test`.

---

## 7. Verification

```powershell
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
pnpm quality:field-errors
pnpm quality:layers
pnpm quality:dead-code
```

Gate expectations: `quality:field-errors` reports **no** finding under `apps/admin/src/features/forms/**` (all error branching stays in `lib/field-errors.logic.ts` / `use-app-form.logic.ts`); `quality:layers` shows no upward import (`features → lib` only); knip stays clean because every exported type is part of the hook's public signature; `packages/ui` and `ApiKeyForm.tsx` stay untouched, so their tests are unaffected.

---

## 8. Risks / watch items

| Risk                                                           | Mitigation                                                                                                                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Several `setError(..., { shouldFocus: true })` fight for focus | D3: only the first planned entry gets `shouldFocus`; assert in `use-app-form.test.tsx` that the first invalid input is `document.activeElement`.                           |
| `handleSubmit` swallows rejections                             | The `try/catch` lives **inside** the async callback, so the rejection is caught where the mapping runs; a test asserts a rejecting `submit` is mapped, not left unhandled. |
| `reset()` clears field errors but not our `formError`          | `formError` is page state (`useState`), cleared explicitly on submit start and on success (D8).                                                                            |
| AIS-84 lands with a different notifier shape                   | `FormNotifier` is a one-method interface; AIS-85 adapts it. Do **not** widen it to `error`/`info` before that ticket exists.                                               |
| Consumers keep hand-wiring the page `Alert` copy               | Title/copy constants stay in `lib/error-message.const.ts`; the doc's code sample is the single reference implementation.                                                   |
| Scope creep into `ApiKeyForm`                                  | Ticket forbids it: the reference migration is AIS-85. `ApiKeyForm.tsx` must show a zero diff in this PR.                                                                   |
