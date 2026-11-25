# URL-param preservation and the audit row

**Date:** 2026-11-25
**Ticket:** [AIS-181](https://zakzag.atlassian.net/browse/AIS-181) — customer detail: *Tevékenység* and *Napló* tabs
**Plan:** [`2026-11-25--17-38-00-ais-181-customer-activity-and-audit-tabs-plan.md`](../plans/2026-11-25--17-38-00-ais-181-customer-activity-and-audit-tabs-plan.md:1)

---

## 1. Problem / feature

Two things had to land together:

1. **Feature** — the customer detail page's last two tabs: an editable, paged **activity feed** and a
   read-only, filtered, paged **audit ledger** with an expandable before → after diff.
2. **Defect** — the URL hooks of the admin app could not host a paged list on a route that also carries a
   view parameter. This had never been observable, because no such route existed until these tabs.

## 2. Measured evidence

- `useListParams` wrote a **fresh** `URLSearchParams` on every interaction
  (`setSearchParams(toListParamsUrlSearchParams(next, defaults))`), so any parameter the list query did
  not declare was destroyed. On `/customers/:id?tab=activity`, the first pager click dropped `tab` and the
  page rendered *Áttekintés* again.
- Both new tabs page through the **same** `page`/`limit` keys, so keeping the URL across a tab switch would
  open page 3 of a different collection.
- A first fix attempt derived the hook's owned keys from the **parsed defaults**. The existing
  `CustomersPage` reset test failed immediately (`/customers?type=company&status=active&q=pelda` instead of
  `/customers`): `type`, `status`, `source` and `q` are optional **without** a `default()`, so Zod omits
  them from the parsed object, and they were therefore treated as foreign.

## 3. Root cause / design rationale

- The hook never modelled **ownership**: it replaced the whole search string instead of the keys it owns.
  Ownership is a property of the *schema*, not of a parsed value, which is why the names must come from
  `schema.shape` and not from `Object.keys(defaults)`.
- A view switch is not a list write: it invalidates the previous view's list state. Doing that with a
  second `setSearchParams` would create two history entries for one click, so the deletion belongs in the
  **same** write as the tab change.
- For the ledger rows, `DataTable` was rejected: it has no row-expansion contract, and adding one would be a
  primitive change with no second consumer. `LogEntryRow` already *is* the expandable-JSON renderer the
  screen contract forbids duplicating, so the tab reuses it; the only gap was its badge text, which printed
  a severity word („Sikeres”, „Figyelmeztetés”) where an operation name belongs — closed with one optional
  prop, `levelLabel`, whose default keeps every existing caller byte-identical.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `apps/admin/src/features/api/use-list-params.logic.ts` | `mergeListParams` (replace only owned keys) and `toOwnedListParamNames` (from the schema shape, not the defaults) |
| `apps/admin/src/features/api/use-list-params.ts` | the single write merges into the current search params |
| `apps/admin/src/features/api/use-tab-param.{ts,logic.ts,interface.ts}` | `clearParams` + `applyTabWrite`: the tab write deletes the previous view's list keys in one navigation |
| `apps/admin/src/features/customers/use-customer-activities.ts` | feed read + create/update/remove mutations, invalidating the `customers` prefix |
| `apps/admin/src/features/customers/use-customer-audit-logs.ts` | ledger read — **no** mutation, by design |
| `apps/admin/src/entities/customer/customer-activity.mapper.ts` | type → label/variant, `canEdit` (`D-W4`), `updatedAt ?? createdAt` token |
| `apps/admin/src/entities/customer/customer-audit-log.mapper.ts` | before → after diff builder, operation → severity, actor options |
| `apps/admin/src/pages/customers/ui/CustomerActivity*.tsx` (5 files) | feed tab, note form, row, inline editor, delete confirmation |
| `apps/admin/src/pages/customers/ui/CustomerAudit*.tsx` (3 files) | ledger tab, four URL filters, `LogEntryRow` list |
| `apps/admin/src/pages/customers/ui/customer-tab-panels.tsx` | the two placeholders replaced; the page still does not learn how many tabs exist |
| `apps/admin/src/pages/customers/CustomerDetailPage.tsx` | passes `CUSTOMER_TAB_LIST_PARAM_NAMES` to `useTabParam` |
| `packages/ui/src/components/log-drawer/{LogEntryRow.tsx,log-drawer.interface.ts}` | optional `levelLabel` |
| `apps/admin/src/test/mocks/handlers/customers.handlers.ts` | feed/ledger reads join the default MSW set; write handlers stay opt-in |

## 5. Outcome and how to verify

The two tabs are live, `/customers`, `/api-keys` and the notification log behave exactly as before the
hook change, and a paged list can now share a route with a view parameter.

```bash
pnpm --filter @callback/admin test     # 82 files, 905 tests
pnpm --filter @callback/ui test        # 49 files
pnpm quality                           # layers, dead-code, tokens, themes, field-errors, docs
pnpm typecheck
```

Manual: `/customers/:id?tab=activity` → page the feed and confirm `tab=activity` survives; write a note and
see the header's *last activity* refresh; open `?tab=audit`, filter by table/operation/author/date and
reload — the filters come back; expand a row to read the diff; switch tabs from `?tab=activity&page=3` and
confirm `page` is gone from the URL.

## 6. Follow-ups

- The server does not check the activity's author (no admin authentication before AIS-73/74); the
  operator-only edit/delete rule is therefore **client-side** (`D-W4`), documented in the screen contract.
- The ledger's author filter offers only the actors present on the current page — there is no operator
  directory endpoint in the contract.
- `activities.metadata` is not rendered in the feed (the ticket's row content does not ask for it).
