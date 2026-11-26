# AIS-179 — the customer detail's contacts and users tabs

**Ticket:** [AIS-179](https://zakzag.atlassian.net/browse/AIS-179) · **Story:** [AIS-15](https://zakzag.atlassian.net/browse/AIS-15)
**Date:** 2026-11-25 · **Plan:** [`2026-11-25--15-52-00-ais-179-customer-contacts-and-users-tabs-plan.md`](../plans/2026-11-25--15-52-00-ais-179-customer-contacts-and-users-tabs-plan.md:1)
**Follow-up created in the same session:** [AIS-193](https://zakzag.atlassian.net/browse/AIS-193) (tag chip bar)

## 1. Feature

Two of the four placeholder tabs of `/customers/:id` became real: **Kapcsolattartók** (`?tab=contacts`)
and **Felhasználók** (`?tab=users`), each with its full write surface. The remaining two belong to
AIS-181.

## 2. Measured starting point

| Finding | Consequence |
| --- | --- |
| `customer-tab-panels.tsx` was a total `Record<CustomerTab, …>` with four placeholders | The ticket replaced two entries; `CustomerDetailPage` was not touched |
| `customerDetailSchema` already carried `contacts[]` and `customerUsers[]` | No new request, no contract change (`D-W3`) |
| `CustomersService` already exposed the contact and customer-user operations | No `packages/api-client` work |
| No Jira ticket existed for the deferred tag chip card | Created **AIS-193** before any code was written |

## 3. Design rationale

- **One view model, not two reads.** `toCustomerDetailViewModel` now fills `id`, `contacts` and
  `customerUsers`, so the tabs render the mapper's output. Alternative rejected: a per-tab list query —
  the contract has no `listCustomerUsers` operation, and a second request would have made "no pager"
  a convention instead of a structural fact.
- **Roles as three booleans.** `react-hook-form` array fields need `useFieldArray`; three checkboxes plus
  `toContactRoles()` are simpler, and the closed role union stays the only vocabulary.
- **Asymmetric empty handling.** Create omits an empty optional field; update sends `null`, because in a
  `PATCH` an absent key means "leave it". Getting this backwards would silently keep a cleared e-mail.
- **Addresses where a surface can be linked, `useState` where it cannot.** Create/edit/invite are route
  children of the detail entry (reloadable, linkable); the archive and revoke confirmations are not
  (AIS-173).
- **Revoke only on `invited`.** The API revokes pending invitations only; an action on an `active` row
  would promise a `422`.

## 4. Implementation

| Area | Change |
| --- | --- |
| `entities/customer/customer.interface.ts` | `ContactRoleBadge`, `CustomerContactViewModel(s)`, `CustomerUserViewModel(s)`; detail view model gains `id`, `contacts`, `customerUsers` |
| `entities/customer/customer.const.ts` | role/status label and badge tables, both tab column tables, login-user and active copy |
| `entities/customer/customer.mapper.ts` | `toCustomerContactViewModel(s)`, `toCustomerUserViewModel(s)`; extended detail mapper |
| `features/customers/use-customer-contacts.ts` | create / update / remove adapters, `invalidateKeys: [CUSTOMERS_QUERY_KEYS.all]` |
| `features/customers/use-customer-users.ts` | invite / update / remove adapters, same invalidation |
| `features/customers/customers.const.ts` | six success messages, three field-path lists, three path-by-code tables |
| `pages/customers/customer-contact.logic.ts` | form schema, role conversion, create/update payloads, user select options |
| `pages/customers/customer-user.logic.ts` | invite + edit schemas (managed statuses only), payloads |
| `pages/customers/ui/*` | two tabs, three forms, four route overlays, two confirmations |
| `pages/customers/customers.const.ts` | four route paths, four builders, tab-to-URL helper, dialog copy, field ids |
| `app/router/route-registry.tsx` | four `children` of the detail entry |
| `test/mocks/handlers/customers.handlers.ts` | contact and login-user handlers incl. the three conflicts |

## 5. Outcome and how to verify

```bash
pnpm quality && pnpm lint && pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin test -- --run src/entities/customer src/pages/customers src/app/router
# 74 files / 800 tests green
```

Manual check on the local stack: `/customers/:id?tab=contacts` → add a contact with two roles, it appears
without a reload; mark a second contact `primary` → the conflict appears under the role group;
`Archiválás` asks first, then the row disappears; `/customers/:id?tab=users` → invite with an existing
e-mail → the message lands on the e-mail input; an `invited` row offers *Meghívó visszavonása*, an
`active` row offers *Szerkesztés*; opening `/customers/:id/contacts/new` directly and reloading keeps the
window open.

## 6. Follow-ups

- **AIS-193** — the tag chip bar on the *Cégadatok* tab (`createTag` / `attachTag` / `detachTag`).
- **AIS-181** — the activity and audit tabs; they replace the last two placeholder entries and need no
  change here.
- **AIS-182** — the wizard navigates to `?tab=contacts` after creating a customer, which now exists.
- Invitation delivery and acceptance (AIS-73 / AIS-74); until then a created user stays `invited` and its
  contact link is the operator's decision, not an e-mail flow.
- A `Contact` whose `customerUserId` is set is not preselected in the edit form (the wire value is not part
  of the view model yet); selecting the same user again is a no-op write, so the gap is cosmetic.
