# Milestone — customer edit page and detail header write actions (AIS-21)

**Date:** 2026-11-25 · **Tickets:** AIS-21 (delivered), AIS-20 (predecessor) · **Plan:**
[`2026-11-25--15-16-00-ais-21-customer-edit-page-and-header-actions-plan.md`](../plans/2026-11-25--15-16-00-ais-21-customer-edit-page-and-header-actions-plan.md:1)

## 1. Problem / feature

The customer detail page (AIS-20) is read-only, and the list row's *Szerkesztés* menu item already
linked to `/customers/:id/edit` — a path no route mounted, so the click fell into the catch-all. AIS-21
had to deliver the edit surface and, with it, the detail header's write actions (*Szerkesztés*,
*Státusz váltása*, *Archiválás*).

## 2. Measured state before the change

| Fact | Value |
| --- | --- |
| `customersService.update` + `updateCustomerSchema` | already shipped (AIS-178/c) — no contract change needed |
| routes matching `/customers/:id/edit` | **0** → the list row menu navigated to the `*` catch-all |
| detail header `actions` slot | the status badge only |
| contract fields the ticket lists | `tagIds` absent, `responsibleOperatorId` removed on 2026-11-24 |

## 3. Root cause / design rationale

The gap was not missing infrastructure — every layer (service, generic hooks, form pattern, error
mapping) existed — but a missing **surface**. Three design questions had no precedent:

1. **Where does a lost update surface?** `STALE_WRITE` blames the hidden `updatedAt` token, so a field
   error would point at no input. Chosen: a page-level warning with a reload action, cleared by the
   `key={updatedAt}` remount the re-read produces.
2. **What travels in a `PATCH`?** The wave plan wanted only changed fields. Rejected: the form displays
   the whole record, `null` must mean “clear it”, the server's audit writer already computes the real
   diff, and `FormActions` has no `disabled` prop to express “nothing changed”. The whole editable set
   plus the token is sent.
3. **Is the status dialog a route?** Every dialog with an address is; nothing links to these two and
   nothing reloads into them. Chosen: the documented AIS-173 exception (local `useState`), which also
   leaves the detail route's `children` slot to AIS-179.

The tags chip card was split out: `updateCustomerSchema` has no `tagIds`, so tags are not form state, and
a chip bar needs its own card plus create/detach mutations — a feature, not a field.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `features/customers/use-update-customer.ts` | field `PATCH` adapter, invalidates the `customers` prefix |
| `features/customers/use-update-customer-status.ts` | status adapter over `PATCH /:id/status` |
| `features/customers/customers.const.ts` | field-path list (visual order), default path-by-code, success copy |
| `pages/customers/customer-edit.logic.ts` | derived edit + status schemas, record → values, values → payload, country options, read-only summary |
| `pages/customers/CustomerEditPage.tsx` | read + five surfaces, `updatedAt`-keyed form, navigation on cancel/success |
| `pages/customers/ui/CustomerEditForm.tsx` | `useAppForm`, four `FormSection`s, stale-write notice + reload |
| `pages/customers/ui/CustomerStatusDialog.tsx` | one-field form over the status route |
| `pages/customers/ui/CustomerDetailHeaderActions.tsx` | edit link, action menu, the two modals |
| `apps/admin/src/pages/customers/CustomerDetailPage.tsx` | `actions` slot: badge + header actions |
| `app/router/route-registry.tsx` | `/customers/:id/edit` as a sibling entry with a resolved crumb |
| `test/mocks/handlers/customers.handlers.ts` | update/status handlers (200, 422, tax conflict, stale, 500) |

## 5. Outcome and how to verify

```bash
pnpm quality && pnpm test:quality
pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
pnpm --filter @callback/admin exec vitest run src/pages/customers src/features/customers src/app/router
```

Manual check on the local stack: open `/customers`, use the row menu's *Szerkesztés* (it now opens the
form instead of the 404 page), save, and confirm the detail page shows the new values; open the edit page
in two tabs, save in one and then in the other — the second must show the reload notice, not a field
error; from the detail header change the status and archive a customer, and confirm both land back on a
consistent page (refreshed detail, respectively the list).

## 6. Follow-ups

- **Tags chip card** on the *Cégadatok* tab (`createTag` / `detachTag`, `attachTag` once a catalogue read
  exists) — its own ticket.
- A data-aware breadcrumb (the crumb currently shows the id) — unchanged from AIS-20 and out of scope.
- „Felelős operátor": the contract has no such field; the Jira text still lists it.
