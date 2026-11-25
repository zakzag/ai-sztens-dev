# AIS-182 — the new-customer wizard: steps 2–4 and the submit

**Ticket:** AIS-182 `Admin - impl: új ügyfél varázsló` (parent: AIS-15)
**Plan:** [`2026-11-25--20-52-00-ais-182-customer-wizard-steps-and-submit-plan.md`](../plans/2026-11-25--20-52-00-ais-182-customer-wizard-steps-and-submit-plan.md:1)
**Milestone:** [`2026-11-25--21-40-00-ais-182-customer-wizard-submit.milestone.md`](../milestones/2026-11-25--21-40-00-ais-182-customer-wizard-submit.milestone.md:1)

## What was missing and what was built

AIS-19 shipped the wizard's **shell** (route, page store, provider, step strip, step 1). AIS-182 filled
in the three remaining steps, the step logic and the one write of the wizard.

| Area | Change |
| --- | --- |
| Shared helper | `lib/optional-format.schema.ts` — `toOptionalFormatSchema` extracted from `customer-edit.logic.ts`, so the wizard and the edit form share one “empty is allowed, non-empty is checked by the contract” rule |
| Wizard logic | `pages/customers/customers-wizard.logic.ts` — `nextStep`, `previousStep`, `canLeaveStep`, `toReachableStep`/`isStepReachable`/`isDraftComplete`, `toNameValues`/`toAddressValues`, `toCreateCustomerPayload`, `toWizardSummary`, `toWizardStepOfField`, `toWizardServerError`, plus the two step schemas derived from `createCustomerSchema` |
| Feature hook | `features/customers/use-create-customer.ts` — `useApiMutation` over `customersService.create`, invalidating the whole `customers` prefix |
| Step bodies | `ui/CustomerNameStep.tsx`, `ui/CustomerAddressStep.tsx`, `ui/CustomerReviewStep.tsx`; step 1 moved into `CustomerCreatePage.tsx` |
| Page | `CustomerCreatePage.tsx` rewritten: four bodies, the derived `reachableStep`, the server-error routing, the submit |
| Stepper | `ui/CustomerWizardStepper.tsx` gained `reachableStep`; a step beyond the draft's frontier renders `disabled` |
| Copy and ids | `customers.const.ts`: `CUSTOMER_LEGAL_FORM_OPTIONS`, `CUSTOMER_WIZARD_FIELD_IDS`, the Tovább/Vissza/Létrehozás labels, the incomplete-draft warning, the placeholder |
| Errors | `CustomersWizardIncompleteError` (a draft too incomplete to build a body) |
| Tests | `customers-wizard.logic.test.ts`, `use-create-customer.test.tsx`, `CustomerWizardStepper.test.tsx`, the extended `CustomerCreatePage.test.tsx`, `lib/optional-format.schema.test.ts`; four new `POST /customers` MSW handlers |

## Decisions taken during implementation

1. **The step frontier is derived, not stored.** The request was “the strip may only jump up to the
   highest reached step”, while the ticket's DoD keeps the store contract AIS-19 created. Both hold if
   reachability is computed: `toReachableStep(draft)` returns the last step whose predecessors all pass
   `canLeaveStep`. Because the address is optional in the contract, a draft with a type and a legal name
   already unlocks the review step — which is correct: nothing else is required to create a customer.
2. **`useAppForm` on steps 2 and 3 only.** Step 1's `RadioGroup` is controlled and has no
   `register`-able input, and step 4 has no input at all; wrapping either in a form would have added a
   resolver without a field. Screen contract §4.1 now states this scope instead of “one form per step”.
3. **The review step sends the request, the hook never navigates.** A `features` hook must not know the
   router (`react.coding-standards.md` §2), so `useCreateCustomerMutation` stays navigation-free and the
   jump to `/customers/:id?tab=contacts` happens after the write resolves.
4. **Failures are routed by path, not by status.** `toWizardServerError` runs the shared `toFieldErrors`
   with the create field paths and the code → path table, then maps the blamed path to its step. The
   step hands the raw error to `useAppForm.setServerError`, so the field copy and the first-error focus
   stay in the hook; a failure no input can fix keeps the review step and renders as a residue `Alert`.
5. **The legal form is a closed select** (`CUSTOMER_LEGAL_FORM_OPTIONS`): the contract stores a bounded
   free text, but the seven Hungarian forms cannot be spelled two ways by an operator. The empty option
   is a real `<option>` so the field can be cleared again.

## Verification

```bash
pnpm --filter @callback/admin exec vitest run src/pages/customers src/features/customers/use-create-customer.test.tsx src/lib/optional-format.schema.test.ts
pnpm typecheck
pnpm quality && pnpm test:quality
```

The page test walks the wizard through the real inputs and asserts the `D-W6` guarantee with a request
recorder: after a successful submit **exactly one** `POST /api/admin/customers` was sent, the address
became `/customers/<id>?tab=contacts`, and the `409` case navigated back to step 2 with the tax-number
message under the input.

## Follow-ups

- The tag chip bar on the **Cégadatok** tab is still AIS-193.
- `createCustomerSchema` keeps `status` and `source` optional; the wizard does not offer them, so the
  server defaults apply (a new customer is a `prospect` from `manual`).
