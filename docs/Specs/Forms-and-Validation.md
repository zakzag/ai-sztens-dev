# Forms and validation — the admin form pattern

**Utolsó frissítés:** 2026-11-04 (AIS-115: megjelent a közös form-minta, `features/forms/use-app-form.ts` — validáció, mezőhiba-leképezés, submit/toast konvenció egy helyen)
**Status:** living document — describes the _current_ state of form handling in `apps/admin`.
**Authority:** [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1) §5 (business logic),
§6 (three state buckets), §9 (error handling) and [`UI-Architecture.md`](./UI-Architecture.md:1) §4.3.
Where this document and the rule set disagree, the rule set wins and this document is the bug.

---

## 1. The rule in one sentence

Writing a form must not require writing validation, error-routing or feedback logic:
the page declares its **schema**, its **field paths** and its **submit**, and
[`useAppForm()`](../../apps/admin/src/features/forms/use-app-form.ts:1) does the rest.

```ts
const form = useAppForm<ApiKeyFormValues>({
  schema: apiKeyFormSchema, // derived from the shared request schema
  defaultValues: API_KEY_FORM_DEFAULTS,
  fieldPaths: API_KEY_FIELD_PATHS, // visual order = focus order
  defaultPathByCode: DEFAULT_FIELD_PATH_BY_CODE,
  submit: (values) => createApiKey(toCreateApiKeyInput(values)),
  notify, // optional port, see §5
  successMessage: API_KEY_FORM_SUCCESS_MESSAGE,
});
```

```tsx
<form onSubmit={form.handleSubmit} noValidate>
  {form.formError !== null ? (
    <Alert variant="danger">{form.formError}</Alert>
  ) : null}

  <FormField id="name" label="Név" error={form.errors.name?.message}>
    {(field) => (
      <Input {...form.register('name')} {...field.ariaProps} label="Név" />
    )}
  </FormField>

  <FormActions
    submitLabel="Mentés"
    isSubmitting={form.formState.isSubmitting}
  />
</form>
```

---

## 2. Validation copy

The sentence a user sees never comes from the admin app and never from the server's
`issue.message`:

| Layer               | Source                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (blocking)   | the zod schema + `VALIDATION_ERROR_MAP` (`@callback/shared`) — `configureValidationLocale('hu')` in [`main.tsx`](../../apps/admin/src/main.tsx:1) (and in `test/setup.ts`) |
| Client (per field)  | `ERROR_CODE_CATALOGUE[code].fieldMessage` in [`lib/api-error-code.const.ts`](../../apps/admin/src/lib/api-error-code.const.ts:1)                                           |
| Client (page level) | `toErrorMessage()` in [`lib/error-message.ts`](../../apps/admin/src/lib/error-message.ts:1)                                                                                |
| Server              | `details[]` is developer-facing English; **never rendered**                                                                                                                |

A form schema is **derived** from the shared request schema (`.omit` / `.extend`), so
a limit or a pattern changed on the server cannot silently disagree with the form.

---

## 3. The submit convention (frozen)

| Step            | Behaviour                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **validate**    | `handleSubmit` runs `zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP })`; an invalid form never reaches `submit`            |
| **pending**     | `formState.isSubmitting` → `FormActions isSubmitting` (button `disabled` + `aria-busy`, label switches to pending)               |
| **success**     | `reset(defaultValues)` → `notify.success(successMessage)` → `onSuccess()` (plan `D8`: the announcement never precedes the reset) |
| **field error** | `toFieldErrors` (AIS-111) → `toFormErrorPlan` → `setError(path, { type: 'server', message }, { shouldFocus })`                   |
| **page error**  | whatever the mapping could not address becomes the single `formError`, rendered as an `Alert` above the form                     |

Two rules that are easy to get wrong and are enforced by the hook:

1. **Only the first entry focuses** (`shouldFocus: index === 0`). Several
   `shouldFocus: true` calls would each steal focus and the last one would win.
2. **The focus order is the declared `fieldPaths` order**, not the server's
   `issues[]` order — two identical failures always focus the same input.

A failure that landed on a field produces **no** notification; the page `Alert` is the
only thing that speaks. Error toasting belongs to the global capture (AIS-84).

---

## 4. What the hook owns, and what it must never own

| In `useAppForm`                                                   | In the caller                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| resolver wiring, `clearErrors`/`setError`, `reset(defaultValues)` | the schema (derived from `@callback/shared`)             |
| the failure → field plan (`toFormErrorPlan`, ordered)             | the ordered `fieldPaths` and the `defaultPathByCode` map |
| the page-level `formError` state                                  | the `Alert` copy and title                               |
| submit sequencing and `isSubmitting`                              | the write itself (`useApiMutation().mutateAsync`)        |

The hook contains **no** field name, **no** Hungarian sentence and **no** business rule.
It also never branches on `error.status` / `error.code`: that decision is
`lib/field-errors.logic.ts`'s, which is what the `quality:field-errors` gate enforces.

---

## 5. The notification port (AIS-84 boundary)

```ts
export interface FormNotifier {
  readonly success: (message: string) => void;
}
```

`notify` is **injected and optional**. Omitting it (or passing `null`) makes the hook
silent, so the pattern shipped before the notification system existed and the two
tickets could not block each other.

- AIS-84/85 supplies the implementation and adapts it to this one-method interface;
  the port is deliberately **not** widened to `error`/`info` before that ticket.
- A page that has no notifier yet simply omits `notify` plus `successMessage`, and
  renders its own success affordance if it needs one.

---

## 6. Tests

| File                                                                                             | Covers                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [`use-app-form.logic.test.ts`](../../apps/admin/src/features/forms/use-app-form.logic.test.ts:1) | ordering by `fieldPaths`, dropping unowned paths, page-level message coexisting with fields                         |
| [`use-app-form.test.tsx`](../../apps/admin/src/features/forms/use-app-form.test.tsx:1)           | valid submit, reset, notification, invalid block, pending, 5xx, unmapped path, focus order, retry, `setServerError` |

The consumer harness ([`test/mocks/app-form-harness.mock.tsx`](../../apps/admin/src/test/mocks/app-form-harness.mock.tsx:1))
builds the form out of the real primitives, so the suite asserts what a page renders.
No test hits the network: the write is always a mock.

---

## 7. Migration status

| Form                           | State                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `pages/LoginPage`              | not react-hook-form based yet; unaffected                                                               |
| `pages/api-keys/ui/ApiKeyForm` | still the hand-wired reference implementation; **migrates in AIS-85** together with the notification UI |
| Every new form                 | must use `useAppForm` (§1) — a hand-wired resolver + `setError` loop is a review finding                |
