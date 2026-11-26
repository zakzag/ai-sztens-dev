# AIS-182 — the new-customer wizard sends exactly one request

**Ticket:** AIS-182 · **Date:** 2026-11-25 · **Area:** `apps/admin` (customers screens)

## Problem / feature

The customers admin needed a create wizard: pick a customer type, fill in name and identifiers, fill in
the registered address, review, submit. AIS-19 had shipped the route, the page store and step 1 only, so
the wizard could not create anything. The ticket also carried an outdated instruction to create the
company **and its first contact** in one pass.

## Evidence that shaped the design

- `POST /api/admin/customers` is the only create endpoint; there is no customer+contact transaction.
  A second request after a successful customer create could only leave a half-created customer behind,
  so the wizard creates the company alone and the operator adds the contact on the detail page.
- `createCustomerSchema` (`.strict()`) requires only `type` and `legalName`; the address, tax number and
  legal form are optional, and `registeredAddressCountry` / `status` have server defaults.
- The wizard's store contract had to stay unchanged (ticket DoD), yet the step strip must not let an
  operator jump to a step whose predecessors are still empty.

## Design rationale

| Decision | Why |
| --- | --- |
| Reachability is **derived** (`toReachableStep(draft)`) instead of stored | the frontier is a function of the draft; storing it would add a second source of truth and break the frozen store contract |
| A step is reachable when **every earlier step passes** `canLeaveStep` | the address is optional, so type + legal name legitimately unlock the review step |
| `useAppForm` on steps **2 and 3** only | step 1's `RadioGroup` is controlled (no `register`-able input), step 4 is a read-only summary; both keep `FormActions` |
| The **review step** sends the request and navigates | a `features` hook must not know the router; the hook stays a thin `useApiMutation` adapter |
| Failures are routed by **path**, not status | the shared `toFieldErrors` + a code→path table give the blamed field; the page maps the field to its step and the step feeds the raw error to `useAppForm.setServerError` |
| `legalForm` is a closed `Select` | the contract is a bounded free text; a closed list stops “Kft” and “kft.” being two spellings of one form |

## Implementation

| File | Change |
| --- | --- |
| `apps/admin/src/lib/optional-format.schema.ts` | `toOptionalFormatSchema` extracted from the edit logic; empty is legal, non-empty defers to the shared schema |
| `apps/admin/src/pages/customers/customers-wizard.logic.ts` | step order, `canLeaveStep`, reachability, payload builder, summary, field→step map, failure routing, step schemas |
| `apps/admin/src/features/customers/use-create-customer.ts` | `useApiMutation` over `customersService.create`, invalidating the `customers` prefix |
| `apps/admin/src/pages/customers/ui/CustomerNameStep.tsx` / `CustomerAddressStep.tsx` / `CustomerReviewStep.tsx` | steps 2, 3 and the review + submit |
| `apps/admin/src/pages/customers/CustomerCreatePage.tsx` | four bodies, derived `reachableStep`, error routing, cancel/reset |
| `apps/admin/src/pages/customers/ui/CustomerWizardStepper.tsx` | steps beyond the frontier render `disabled` |
| `apps/admin/src/pages/customers/customers.const.ts` | legal-form list, field ids, navigation labels, incomplete-draft warning, placeholder |
| `apps/admin/src/pages/customers/customers-wizard.errors.ts` | `CustomersWizardIncompleteError` |
| `apps/admin/src/test/mocks/handlers/customers.handlers.ts` | `POST /customers`: 201, `409` tax conflict, `422`, `500` |

## Outcome and how to verify

The wizard creates one customer, then lands on `/customers/:id?tab=contacts`:

```bash
pnpm --filter @callback/admin exec vitest run src/pages/customers/CustomerCreatePage.test.tsx
```

The page test walks steps 1→4 through the real inputs and asserts, with a request recorder, that
**exactly one** `POST /api/admin/customers` was sent; a `409 CUSTOMER_TAX_NUMBER_CONFLICT` navigates back
to step 2 and renders the tax-number message under the input, while a `500` keeps the operator on the
review step with an `Alert`. A hand-written `?step=4` on an empty draft renders the incomplete-draft
warning instead of a submit.

```bash
pnpm quality && pnpm test:quality && pnpm typecheck
```

## Follow-ups

- The tag chip bar on the **Cégadatok** tab belongs to AIS-193.
- `status` and `source` are not offered by the wizard; the server defaults (a `prospect` from `manual`)
  apply until a follow-up adds them.
