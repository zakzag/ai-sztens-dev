# Forms and validation — the admin form pattern

**Utolsó frissítés:** 2026-11-05 (AIS-136: `banner` hiba is toastol — a `field` marad az egyetlen toast nélküli szint (§3.1); az `ApiKeyEditForm` megkapta a `notify` portot, a lap sikeres `Alert`-je mellett (§5–§6)) (AIS-85: az `ApiKeyForm` átállt a mintára és a `notify` portra; a `formError` csak a `field`-szintű hiba maradéka — ki beszél a hibáról: §3.1) (AIS-115: megjelent a közös form-minta, `features/forms/use-app-form.ts` — validáció, mezőhiba-leképezés, submit/toast konvenció egy helyen)
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

  {/* `Input`/`Textarea` already bundle label + hint + error + aria (§4.1), so they
      are NOT wrapped in `FormField`: that would render a second label and the
      primitive overrides `aria-describedby` after `...rest`. */}
  <Input
    {...form.register('name')}
    id="name"
    label="Név"
    error={form.errors.name?.message}
  />

  <FormActions
    submitLabel={form.formState.isSubmitting ? 'Mentés…' : 'Mentés'}
    isSubmitting={form.formState.isSubmitting}
  />
</form>
```

`FormField` is for a control that does **not** bring its own label (`Select`, `Combobox`, …), and it
supplies the wiring through its render prop (`field.ariaProps` for raw DOM, `field.invalid` /
`field.describedBy` for our primitives).

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
| **unaddressed issue of a field failure** | the single `formError`, rendered as an `Alert` above the form (AIS-85 `D2`)                                          |
| **page/banner/silent failure**           | **nothing in the form** — the capture toast (AIS-84) or `AppErrorBanner` (AIS-96) owns that surface                  |

Two rules that are easy to get wrong and are enforced by the hook:

1. **Only the first entry focuses** (`shouldFocus: index === 0`). Several
   `shouldFocus: true` calls would each steal focus and the last one would win.
2. **The focus order is the declared `fieldPaths` order**, not the server's
   `issues[]` order — two identical failures always focus the same input.

### 3.1 Who speaks about one failure (AIS-85 `D2`)

`toFormErrorPlan` takes the failure's `toErrorSurface` classification, so the form and the
notification system can never render the same sentence twice:

| Surface  | Field messages | Form `Alert` (`formError`) | Toast (capture)      | Log entry |
| -------- | -------------- | -------------------------- | -------------------- | --------- |
| `field`  | yes            | only the unowned residue   | no                   | yes       |
| `page`   | no             | **no**                     | yes                  | yes       |
| `banner` | no             | **no**                     | **yes** (AIS-136)    | yes       |
| `silent` | no             | no                         | no                   | no        |

Consequence for a form inside the admin shell: a field-addressable failure stays on its input with
focus and **no** toast, a `5xx` shows exactly **one** error toast, and a form never needs a second
error state. A `banner` failure (offline, `401`, `503`) is now toasted **in addition to**
`AppErrorBanner`: the banner shows the persistent condition, the toast marks the moment. Note that
`409 STALE_WRITE` has **no** `fieldMessage` in the catalogue, so the classifier files it under
`page`: the detail page shows its reload `Alert` **and** the capture toasts once — an addressable
input is the only failure that stays silent on the toast channel.

---

## 4. What the hook owns, and what it must never own

| In `useAppForm`                                                   | In the caller                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| resolver wiring, `clearErrors`/`setError`, `reset(defaultValues)` | the schema (derived from `@callback/shared`)             |
| the failure → field plan (`toFormErrorPlan`, ordered, surface-aware) | the ordered `fieldPaths` and the `defaultPathByCode` map |
| the page-level `formError` state (residue only, §3.1)             | the `Alert` copy and title                               |
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

- **AIS-85 delivered the implementation:** `useNotifier()` from `@callback/notifications/react`
  satisfies `FormNotifier` structurally, so a page passes it straight in. The port stays
  one-method: the hook **never** calls `notify.error`, because error toasting belongs to the
  global capture (§3.1).
- **The api-keys writes have exactly one announcement.** The form announces through the port; the
  api-keys mutations carry **no** `meta.successMessage`, so the mutation-cache callback stays silent.
  (`useApiMutation` does not even forward `meta` to `useMutation`, so the two paths cannot
  double-fire by accident.)
- A page that has no notifier yet simply omits `notify` plus `successMessage`, and
  renders its own success affordance if it needs one.
- **`ApiKeyDetailPage` keeps its success `Alert` next to the toast (AIS-136 `AIS136-D1`).** The port
  was added in AIS-136, so the row is now announced twice **on purpose**: the toast marks the moment
  of the save, the `Alert` marks the state of the row that was just saved and survives a dismissed
  toast. Both read the same `API_KEY_EDIT_FORM_SUCCESS_MESSAGE` constant, so the copy cannot drift.
  `ApiKeyForm` stays single-surface: it has no `Alert` at all.

---

## 6. Tests

| File                                                                                             | Covers                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`use-app-form.logic.test.ts`](../../apps/admin/src/features/forms/use-app-form.logic.test.ts:1) | ordering by `fieldPaths`, dropping unowned paths, residue message for `field`, suppression for `page`/`banner`/`silent`                   |
| [`use-app-form.test.tsx`](../../apps/admin/src/features/forms/use-app-form.test.tsx:1)           | valid submit, reset, notification, invalid block, pending, page failure without a duplicate `Alert`, unmapped path, focus order, retry     |
| [`ApiKeyForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx:1)            | the reference slice end to end: one toast **and** one log entry per submit, `409` field-only, `5xx` toast-only, residue `Alert`, invalidation |
| [`ApiKeyEditForm.test.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.test.tsx:1)    | the same contract on the edit form (AIS-136): one success toast + one log entry, and **no** toast for a field-addressable failure          |

The consumer harness ([`test/mocks/app-form-harness.mock.tsx`](../../apps/admin/src/test/mocks/app-form-harness.mock.tsx:1))
builds the form out of the real primitives, so the suite asserts what a page renders.
No test hits the network: the write is always a mock.

---

## 7. Migration status

| Form                              | State                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pages/LoginPage`                 | not react-hook-form based yet; unaffected                                                                    |
| `pages/api-keys/ui/ApiKeyForm`    | **migrated in AIS-85** — `useAppForm` + `useNotifier()`, no `pageError` state, no success `Alert`, `FormActions` |
| `pages/api-keys/ui/ApiKeyEditForm` | `useAppForm` since AIS-131; **notify port since AIS-136** (`useNotifier()`), with the page's success `Alert` deliberately kept (`AIS136-D1`) |
| Every new form                    | must use `useAppForm` (§1) — a hand-wired resolver + `setError` loop is a review finding                     |
