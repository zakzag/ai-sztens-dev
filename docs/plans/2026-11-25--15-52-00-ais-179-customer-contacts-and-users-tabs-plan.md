# AIS-179 — customer contacts and users tabs (implementation plan)

**Ticket:** [AIS-179](https://zakzag.atlassian.net/browse/AIS-179) — `Admin - impl: cég adatlap — Kapcsolattartók és felhasználók tabok`
**Story:** [AIS-15](https://zakzag.atlassian.net/browse/AIS-15) `Admin - cég felület`
**Date:** 2026-11-25
**Wave plan:** [`2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md`](2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md:205) §7 (section E)
**Screen contract:** [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:178) §3.2 / §3.3
**Predecessors:** AIS-20 (detail shell, `b9136a8`'s ancestor `a179867`), AIS-21 (`b9136a8`)
**Follow-up created by this session:** [AIS-193](https://zakzag.atlassian.net/browse/AIS-193) — the deferred tag chip card (`D-W1`), which no ticket covered until now.

---

## 0. What this plan describes

The two detail tabs that AIS-20 left as placeholders — **Kapcsolattartók** (`?tab=contacts`) and
**Felhasználók** (`?tab=users`) — including their write surfaces. Both tabs are children surfaces of
the detail page: overlays mounted through the detail route's `children` slot, never new pages.

## 1. Measured starting state

| # | Finding | Consequence |
| --- | --- | --- |
| F1 | [`customer-tab-panels.tsx`](../../apps/admin/src/pages/customers/ui/customer-tab-panels.tsx:41) is a **total** `Record<CustomerTab, …>`; `contacts` and `users` currently map to `CustomerTabPlaceholder` | The ticket replaces two values in this file; `CustomerDetailPage` never learns how many tabs exist |
| F2 | `customerDetailSchema` already carries `contacts[]` and `customerUsers[]` ([`customers.schema.ts`](../../packages/shared/src/contract/customers/customers.schema.ts:261)) | No extra request, no contract change (`D-W3`): both tabs read the **detail** cache |
| F3 | `CustomersService` already exposes `createContact` / `updateContact` / `removeContact` / `inviteCustomerUser` / `updateCustomerUser` / `removeCustomerUser` ([`customers.interface.ts`](../../packages/api-client/src/customers/customers.interface.ts:181)) | The ticket writes no `packages/api-client` code |
| F4 | `createContactSchema`, `updateContactSchema`, `inviteCustomerUserSchema`, `updateCustomerUserSchema` exist and are `.strict()` | Form schemas are **derived** from them; the form never invents a wire shape |
| F5 | `CONTACT_ROLE_VALUES` (`primary`, `technical`, `alerting`), `CUSTOMER_USER_ROLE_VALUES` (`owner`, `admin`, `member`, `viewer`), `CUSTOMER_USER_STATUS_VALUES` (`invited`, `active`, `inactive`) and `CUSTOMER_USER_MANAGED_STATUS_VALUES` exist in the contract | Labels/badges are `Record`s over these closed unions: a new value fails the build |
| F6 | `CustomerDetailViewModel` has **no `id`** and no contact/user lists ([`customer.interface.ts`](../../apps/admin/src/entities/customer/customer.interface.ts:85)) | The mapper and the view model are extended; the tab props gain nothing new because the id travels inside the view model |
| F7 | `CustomerTabPanelProps` receives only `customer` ([`customers.interface.ts`](../../apps/admin/src/pages/customers/customers.interface.ts:145)) | Unchanged: tabs render the **view model**, so no tab can fetch |
| F8 | The detail route entry already renders `<Outlet/>` and has a free `children` slot ([`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:156)) | Four `children` entries, all `navLabel: null` |
| F9 | `useApiMutation`, `useApiDetail`, `useAppForm`, `useEntityDialog` already exist and are used by AIS-21 | The new hooks are adapters, the dialogs are the AIS-155 pattern |
| F10 | `VALID_CUSTOMER_DETAIL` in `@callback/shared` is the fixture the MSW detail handler serves | Contact/user fixtures come from the same object, so the tab tests and the contract tests read one truth |

## 2. Decisions

| Id | Decision | Why |
| --- | --- | --- |
| **D1** | The view model gains `id`, `contacts` and `customerUsers`; the mapper gains `toContactViewModels()` and `toCustomerUserViewModels()` | One place decides how a `null` position, an empty role set or an `invited` status looks; the tab stays markup and its test needs no React |
| **D2** | Neither tab has a pager, an URL list state or a list request | `D-W3`: the detail payload is complete, and the contract has no `listCustomerUsers` |
| **D3** | Roles are **three booleans** in the form (`isPrimary`, `isTechnical`, `isAlerting`), converted to `roles[]` by a pure function | `react-hook-form` array fields need `useFieldArray`; three checkboxes + one converter is simpler, testable, and keeps the closed role union as the single source |
| **D4** | Both tabs are **route-based overlays** (`/contacts/new`, `/contacts/:contactId/edit`, `/users/invite`, `/users/:userId/edit`) | Screen contract §1: these surfaces have an address, so the URL owns "is it open" (the AIS-173 exception applies only to confirmations) |
| **D5** | Contact **archive** and customer-user **revoke** are `ConfirmDialog`s with a local `useState` flag | A confirmation has no address; a `/delete` route would only add registry entries (AIS-173) |
| **D6** | The edit dialogs mount their form only after the record is known and key it by `updatedAt` | `useAppForm` seeds `defaultValues` on mount only — the AIS-172 pattern, which is what makes `409 STALE_WRITE` re-seed the inputs |
| **D7** | Conflict codes are routed to controls: `CUSTOMER_PRIMARY_CONTACT_CONFLICT` → the role checkbox group, `CUSTOMER_USER_EMAIL_CONFLICT` → the e-mail input, `CUSTOMER_OWNER_CONFLICT` → the role select, `CUSTOMER_USER_IN_USE_CONFLICT` → an `Alert` in the dialog | A conflict the operator cannot fix at any input must not masquerade as a field error |
| **D8** | `CUSTOMER_USER_IN_USE_CONFLICT` and the revoke action exist only for `status === 'invited'` | The API revokes **pending invitations** only; showing the action elsewhere would promise a write the server refuses |
| **D9** | The `customerUserId` link on a contact is a `Select` over the customer's own users plus a “Nincs” option | The contract enforces that the user belongs to the same customer (`422 SEMANTIC_VALIDATION_FAILED` otherwise); the select makes the valid set obvious |

## 3. Layer-by-layer work

### 3.1 `entities/customer`

| File | Change |
| --- | --- |
| `customer.interface.ts` | `ContactRoleBadge`, `CustomerContactViewModel`, `CustomerContactViewModels`, `CustomerUserViewModel`, `CustomerUserViewModels`; `CustomerDetailViewModel` gains `id`, `contacts`, `customerUsers` |
| `customer.const.ts` | `CONTACT_ROLE_LABELS`, `CONTACT_ROLE_BADGE_VARIANT`, `CUSTOMER_USER_ROLE_LABELS`, `CUSTOMER_USER_STATUS_LABELS`, `CUSTOMER_USER_STATUS_BADGE_VARIANT`, `CONTACT_COLUMNS`, `CUSTOMER_USER_COLUMNS`, the “belépő” / “nincs szerepkör” / active-copy constants |
| `customer.mapper.ts` | `toContactViewModels()`, `toCustomerUserViewModels()`; `toCustomerDetailViewModel()` fills the three new fields |

### 3.2 `features/customers`

| File | Change |
| --- | --- |
| `customers.interface.ts` | Result types for the six mutations |
| `customers.const.ts` | Success copy of the six writes, the per-form field-path lists and the default path-by-code tables |
| `use-customer-contacts.ts` | `useCreateContactMutation`, `useUpdateContactMutation`, `useRemoveContactMutation` — `useApiMutation` over the service, `invalidateKeys: [CUSTOMERS_QUERY_KEYS.all]` |
| `use-customer-users.ts` | `useInviteCustomerUserMutation`, `useUpdateCustomerUserMutation`, `useRemoveCustomerUserMutation`, same invalidation |

### 3.3 `pages/customers`

| File | Change |
| --- | --- |
| `customers.const.ts` | Four route paths + param names, four route builders, the two tab-to-URL helpers, dialog titles/labels, field ids and labels, empty-state copy, tab column copy |
| `customers.interface.ts` | Form value types, dialog props, tab props owners |
| `customer-contact.logic.ts` | `customerContactFormSchema`, `toCustomerContactFormValues()`, `toCreateContactInput()`, `toUpdateContactInput()`, `toContactRoleOptions()` |
| `customer-user.logic.ts` | `customerUserInviteFormSchema`, `customerUserEditFormSchema`, `toCustomerUserInviteFormValues()`, `toCustomerUserEditFormValues()`, `toInviteCustomerUserInput()`, `toUpdateCustomerUserInput()`, `toCustomerUserOptionList()` |
| `ui/CustomerContactsTab.tsx` | `DataTable` over the view model, row actions (edit link, archive), empty state with the create CTA, per-row confirm dialog |
| `ui/CustomerUsersTab.tsx` | `DataTable` over the view model, invite CTA, edit link, revoke action for `invited` rows, empty state |
| `ui/ContactCreateDialog.tsx`, `ui/ContactEditDialog.tsx` | Route overlays; the edit one reads the contact from the **detail** cache and keys the form by `updatedAt` |
| `ui/CustomerUserInviteDialog.tsx`, `ui/CustomerUserEditDialog.tsx` | Same pattern; the edit one offers only `active` / `inactive` |
| `ui/customer-tab-panels.tsx` | `contacts: CustomerContactsTab`, `users: CustomerUsersTab` |
| `app/router/route-registry.tsx` | Four `children` entries under the detail entry |

### 3.4 Mocks and tests

| File | Content |
| --- | --- |
| `test/mocks/handlers/customers.handlers.ts` | `contacts*` and `customerUsers*` handlers: success, `409` conflicts, `422`, `500`, `404` |
| `entities/customer/customer.mapper.test.ts` | role badges, empty roles, `customerUserId` marker, invited/active status variants, `null` position/e-mail |
| `pages/customers/ui/customer-contact.logic.test.ts` | schema rejections (empty name, bad e-mail, bad phone), role boolean → array, `''` → omitted payload key, update payload carries `updatedAt` |
| `pages/customers/ui/customer-user.logic.test.ts` | invite/edit schemas, managed status allow-list, payload builders |
| `features/customers/use-customer-contacts.test.tsx` | create/update/remove: success, error surface, invalidation |
| `features/customers/use-customer-users.test.tsx` | invite/update/remove: same |
| `pages/customers/ui/CustomerContactsTab.test.tsx` | rows, role badges, empty state + CTA, edit link, archive confirm |
| `pages/customers/ui/CustomerUsersTab.test.tsx` | rows, status badge, invite CTA, revoke only on `invited` |
| `pages/customers/ui/ContactCreateDialog.test.tsx` | validation, success closes, `409` on the role control |
| `pages/customers/ui/ContactEditDialog.test.tsx` | seeds from the cache, `updatedAt` sent, stale write re-reads |
| `pages/customers/ui/CustomerUserInviteDialog.test.tsx` | e-mail conflict on the e-mail field |
| `pages/customers/ui/CustomerUserEditDialog.test.tsx` | role conflict on the role control, managed status options |
| `app/router/route-registry.test.ts` | four new children resolve, none of them in the nav |

### 3.5 Documentation

- [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:178) — §3.2 marks the two tabs delivered, §3.3 gains the empty-state and conflict rows, §10 file map refreshed, header date bumped.
- [`UI-Architecture.md`](../Specs/UI-Architecture.md:1) — the `pages/customers` state-plan row names the four overlay routes and states that neither tab has list state.
- `docs/history/<ts>-ais-179-customer-contacts-and-users-tabs.md`
- `docs/milestones/<ts>-ais-179-customer-contacts-and-users-tabs.milestone.md`

## 4. Verification

```bash
pnpm quality                 # layers, dead-code, palette, themes, field-errors, docs
pnpm test:quality
pnpm typecheck && pnpm lint
pnpm --filter @callback/admin test
```

Manual check (local stack): `/customers/:id?tab=contacts` → add a contact with two roles → it appears
without a reload; set `primary` on a second contact → the conflict lands on the role group; archive a
contact → it disappears; `/customers/:id?tab=users` → invite with an existing e-mail → the conflict
lands on the e-mail input; a row in `invited` shows *Meghívó visszavonása*, an `active` row does not.

## 5. Out of scope

- The tag chip card → [AIS-193](https://zakzag.atlassian.net/browse/AIS-193).
- Invitation e-mail delivery and accepting an invitation → AIS-73 / AIS-74 (auth).
- Any `packages/shared`, `packages/api-client` or `packages/ui` change: this ticket is admin-UI only.
