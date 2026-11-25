# AIS-21 — customer edit page + detail header write actions

**Ticket:** [AIS-21](https://zakzag.atlassian.net/browse/AIS-21) — `Admin - impl: admin oldal: cég adatlap (módosítás)`
**Date:** 2026-11-25
**Plan:** [`2026-11-25--15-16-00-ais-21-customer-edit-page-and-header-actions-plan.md`](../plans/2026-11-25--15-16-00-ais-21-customer-edit-page-and-header-actions-plan.md:1)
**Scope decision:** the edit page + form **and** the detail header actions; the tags chip card was deferred to a follow-up ticket.

---

## What was built

| Layer | Files |
| --- | --- |
| feature | `features/customers/use-update-customer.ts`, `use-update-customer-status.ts`, plus the field-path list, the default path-by-code table and the two success messages in `customers.const.ts` / `customers.interface.ts` |
| page (pure) | `pages/customers/customer-edit.logic.ts` — derived edit schema, status schema, record → values, values → payload, country options, read-only summary |
| page | `pages/customers/CustomerEditPage.tsx`, `ui/CustomerEditForm.tsx`, `ui/CustomerDetailHeaderActions.tsx`, `ui/CustomerStatusDialog.tsx`, extended `customers.const.ts` / `customers.interface.ts`, `toCustomerEditRoute()` rebuilt on `CUSTOMER_EDIT_ROUTE_PATH` |
| route | one sibling entry `/customers/:id/edit` in `app/router/route-registry.tsx` |
| mocks | `customersUpdate*` and `customersStatus*` handlers in `test/mocks/handlers/customers.handlers.ts` |
| detail page | `CustomerDetailPage.tsx` — the `actions` slot now renders the badge plus the edit link and the action menu |

## Decisions worth remembering

1. **The stale write is a page-level notice, not a field error.** `409 STALE_WRITE` blames the hidden
   `updatedAt` token, so the form shows a warning `Alert` with a reload button and the record is re-read;
   the `key={updatedAt}` remount is what clears the notice and seeds the new values.
2. **The submit body carries every editable field plus `updatedAt`** (superseding the wave plan's
   “changed fields only”): the form shows the whole record, `''` becomes an explicit `null`, and the
   server's audit writer keeps only the keys that actually changed.
3. **Both header dialogs are non-navigable modals** with a local `useState` open flag (AIS-173 exception),
   consistent with the archive confirmation the list already ships; the detail route's `children` slot
   stays free for AIS-179.
4. **The status change has its own route, mutation and one-field form** — it writes `statusChangedAt`
   server-side and must never ride the field `PATCH`.
5. **The tags chip card is not here.** `updateCustomerSchema` has no `tagIds`; the chip bar needs its own
   card and mutations, so it moved to a follow-up ticket (`attachTag` accordingly stays unwired).

## Verification

```bash
pnpm typecheck                                  # green
pnpm --filter @callback/admin exec vitest run src/pages/customers src/features/customers src/app/router
# 22 files / 216 tests green
```

New test files: `customer-edit.logic.test.ts` (22), `use-update-customer.test.tsx` (7),
`use-update-customer-status.test.tsx` (2), `CustomerEditPage.test.tsx` (11),
`ui/CustomerDetailHeaderActions.test.tsx` (6); `CustomerDetailPage.test.tsx` and
`route-registry.test.ts` were extended.

## Documentation touched

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:3) — the `pages/customers` row's AIS-21
  half, plus the state-plan paragraphs for the edit page and the two non-navigable modals.
- [`docs/Specs/Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:3) — §5 delivered, §10
  file map (including the deferred tag card), refreshed dates.
