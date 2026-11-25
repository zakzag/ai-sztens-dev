# AIS-179 — customer contacts and users tabs (+ the missing AIS-193 ticket)

**Ticket:** [AIS-179](https://zakzag.atlassian.net/browse/AIS-179) — `Admin - impl: cég adatlap — Kapcsolattartók és felhasználók tabok`
**Story:** [AIS-15](https://zakzag.atlassian.net/browse/AIS-15) `Admin - cég felület`
**Date:** 2026-11-25
**Plan:** [`2026-11-25--15-52-00-ais-179-customer-contacts-and-users-tabs-plan.md`](../plans/2026-11-25--15-52-00-ais-179-customer-contacts-and-users-tabs-plan.md:1)
**Milestone:** [`2026-11-25--16-04-00-ais-179-customer-contacts-and-users-tabs.milestone.md`](../milestones/2026-11-25--16-04-00-ais-179-customer-contacts-and-users-tabs.milestone.md:1)
**Follow-up created:** [AIS-193](https://zakzag.atlassian.net/browse/AIS-193) — the deferred tag chip bar

---

## Starting point

The session opened with "what is the next development step?". The measured state was: clean tree, HEAD
`b9136a8` (AIS-21), and the two tabs of the customer detail still mapped to `CustomerTabPlaceholder` in
[`customer-tab-panels.tsx`](../../apps/admin/src/pages/customers/ui/customer-tab-panels.tsx:1). The wave
plan puts AIS-179 and AIS-181 after AIS-20, and AIS-182 (the wizard) after AIS-179 — so AIS-179 was the
critical path.

Two gaps were found on the way:

1. the AIS-21 change record says the tag chip card "moved to a follow-up ticket", but **no such ticket
   existed** (a JQL search for `summary ~ "címke" OR summary ~ "tag"` returned nothing) — created as
   **AIS-193** at the start of this session;
2. nothing in `packages/shared`, `packages/api-client` or `packages/ui` had to change: the contact,
   login-user, activity and audit contracts and service operations were already delivered by AIS-178.

## What was built

| Layer | Files |
| --- | --- |
| entity | `customer.interface.ts` (`ContactRoleBadge`, `CustomerContactViewModel(s)`, `CustomerUserViewModel(s)`, and `id`/`contacts`/`customerUsers` on `CustomerDetailViewModel`); `customer.const.ts` (`CONTACT_ROLE_LABELS`, `CONTACT_ROLE_BADGE_VARIANT`, `CUSTOMER_USER_ROLE_LABELS`, `CUSTOMER_USER_STATUS_LABELS`, `CUSTOMER_USER_STATUS_BADGE_VARIANT`, `CONTACT_COLUMNS`, `CUSTOMER_USER_COLUMNS`, the login-user/role/active copy); `customer.mapper.ts` (`toCustomerContactViewModel(s)`, `toCustomerUserViewModel(s)`) |
| feature | `use-customer-contacts.ts` (create/update/remove), `use-customer-users.ts` (invite/update/remove), the six success messages, the three field-path lists and the three default path-by-code tables, six result types |
| page logic | `customer-contact.logic.ts` (schema with optional e-mail/phone refinements, role booleans → `roles[]`, create/update payload builders, user select options), `customer-user.logic.ts` (invite + edit schemas, managed-status allow-list, payload builders) |
| page UI | `CustomerContactsTab`, `CustomerUsersTab`, `CustomerContactForm`, `CustomerUserInviteForm`, `CustomerUserEditForm`, `ContactCreateDialog`, `ContactEditDialog`, `CustomerUserInviteDialog`, `CustomerUserEditDialog`, `ContactArchiveDialog`, `CustomerUserRevokeDialog`; the two placeholders in `customer-tab-panels.tsx` replaced |
| route | four `children` entries under the detail entry in [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:1) |
| mocks | `customersContact*` / `customersUser*` handlers (success, `409` primary-contact / e-mail / owner conflict, `409 STALE_WRITE`, `data: null` for both deletes) |

## Decisions worth remembering

1. **The detail view model owns the lists.** `toCustomerDetailViewModel` now carries `id`, `contacts` and
   `customerUsers`, so a tab receives final strings and badges and never fetches — the `D-W3` rule ("no
   pager, no URL list state") became structurally impossible to violate.
2. **Roles are three booleans in the form.** `isPrimary` / `isTechnical` / `isAlerting` are converted by
   `toContactRoles()` into the contract's `roles[]`; this avoids `useFieldArray` and keeps the closed role
   union as the single source (`D3`).
3. **Empty means different things in the two directions.** On create an empty optional input is
   *omitted*; on update it becomes an explicit `null`, because "absent" in a `PATCH` means "leave it".
   This is asserted in `customer-contact.logic.test.ts`.
4. **Conflicts land on the control that can fix them** (`D7`): primary-contact conflict → the role
   checkbox group, e-mail conflict → the e-mail input, owner conflict → the role select. The role group's
   error is one `<p role="alert">` under the checkboxes, because three `Checkbox`es cannot each carry the
   same message.
5. **The revoke action exists only on an `invited` row** (`D8`): the API revokes pending invitations and
   answers `422` for anything else, so an `active` row gets the edit link instead.
6. **The four write surfaces are route children, the two destructive ones are not.** Creating, editing
   and inviting have addresses; archiving a contact and revoking an invitation are confirmations and keep
   their open flag in the tab's `useState` (AIS-173 exception).

## Verification

```bash
pnpm --filter @callback/admin typecheck        # green
pnpm lint                                     # green
pnpm quality                                  # layers, dead code, tokens, themes, field errors, docs — green
pnpm --filter @callback/admin test -- --run src/entities/customer src/pages/customers src/app/router
# 74 files / 800 tests green
```

New test files: `entities/customer/customer-contact.mapper.test.ts` (13),
`pages/customers/customer-contact.logic.test.ts` (12), `pages/customers/customer-user.logic.test.ts` (11),
`pages/customers/ui/CustomerContactsTab.test.tsx` (7), `pages/customers/ui/CustomerUsersTab.test.tsx` (5).
Two pre-existing tests were updated, not weakened: `CustomerDetailPage.test.tsx` now asserts the `users`
tab's invite CTA instead of the placeholder, and `route-registry.test.ts` now pins the four overlay
children of the detail entry.

## Documentation touched

- [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:3) — header date, §3.2 rows marked
  delivered, §10 file map plus a "Delivered by AIS-179" record.
- [`UI-Architecture.md`](../Specs/UI-Architecture.md:3) — header date and a §5 paragraph on the two tabs,
  the four overlay routes and the confirmation exception.
