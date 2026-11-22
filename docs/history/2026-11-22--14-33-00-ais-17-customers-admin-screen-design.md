# AIS-17 — customers admin screen contract (documentation ticket)

**Date:** 2026-11-22 14:33 (Europe/Budapest)
**Ticket:** AIS-17 `Admin - terv: admin oldal (lista, adatlap)` — subtask of AIS-15
**Branch:** `AIS-14-company-admin`
**Type:** documentation only — no component, no route, no test, no dependency was added

## What was asked

Produce the screen design for the `customers` admin screens from the **existing** `packages/ui`
primitives: name the primitive and the admin pattern behind every element, prove the four states
(loading / empty / error / success) for every view, record the closed decisions `D1`–`D6`, and add the
page's row to the per-page state plan.

The plan for the ticket itself is
[`docs/plans/2026-11-22--14-20-00-ais-17-customers-admin-screen-design-plan.md`](../plans/2026-11-22--14-20-00-ais-17-customers-admin-screen-design-plan.md).

## What the code said before any writing started

Five findings changed the design, and each is recorded in the delivered documents:

| # | Finding | Effect |
| --- | --- | --- |
| F1 | `packages/shared/src/contract/customers/` has no `customers.contract.ts` and the endpoint registry has no `customers.*` operation — the AIS-14 plan (`D-C`) places them in AIS-178 | The screen contract names operations by `operationId`, and AIS-178 is a hard blocker for the five UI tickets |
| F2 | `apps/admin` has no `pages/customers`, `features/customers` or `entities/customer` | The contract now names every file each successor ticket creates (§10 of the new spec) |
| F3 | `customerSchema` has **no** primary contact, but AIS-17 `D1` requires that column | New decision `D9`: AIS-178 adds a derived `primaryContactName` list projection (fallback: drop the column) |
| F4 | The mockup's wizard has 5 steps including `3 Cím & számlázás`, plus billing and subscription cards | Billing is excluded by AIS-16 `D4`/`D9`; the wizard became 4 steps and the contact step was dropped (a contact has its own CRUD) |
| F5 | AIS-17 `D4` (empty-state CTA) contradicts AIS-174 ("the empty state carries **no** action button") | New decision `D8`: documented exception for `/customers`, recorded in `New-Admin-Page.md` §3 |

## Decisions taken (D7–D16)

| # | Decision |
| --- | --- |
| D7 | `pages/customers` (AIS-19) closes both AIS-174 gaps — the server-side search + four filters and the per-row `DropdownMenu` — instead of opening a separate prerequisite ticket |
| D8 | The customers empty state **does** carry a create CTA; documented exception in `New-Admin-Page.md` §3 |
| D9 | `primaryContactName` becomes a derived list projection in AIS-178 |
| D10 | Seven `status` values map onto five badge variants (`entities/customer/customer.mapper.ts`, table-tested) |
| D11 | The create wizard keeps its draft in a **page-local Zustand store**; `zustand` is installed by AIS-19 and `UI-Architecture.md` §7's row flips in that change. The step itself stays in the URL (`?step=`) |
| D12 | The „Cégadatok” tab groups with `Card` + `DescriptionList`, not `FormSection` (that one is a `<fieldset>`) |
| D13 | The contract lives in a new living spec, not inside `UI-Architecture.md` |
| D14 | Detail and edit are **pages** and **sibling** registry entries (they replace the list); contact/user surfaces stay overlays and remain children of the detail entry |
| D15 | The status change is a detail-header action on `PATCH /:id/status`, never an edit-form field |
| D16 | The tab strip is a page part (`ui/CustomerTabs.tsx`), not a new `packages/ui` primitive |

## Files

| File | Change |
| --- | --- |
| `docs/Specs/Customers-Admin-Screens.md` | **new** — the screen contract: routes/URL, list (8 columns, filters, sort, four states), detail (6 tabs × primitives × four states), 4-step wizard + store contract, edit surface, state-plan row, exclusion list, `D1`–`D16`, test matrix, file map |
| `docs/Specs/UI-Architecture.md` | §5 gains the `pages/customers` row (server / URL / one page store / form state); the `zustand` paragraph and the §7 row now name the first page and the ticket that installs it; header date bumped |
| `docs/Specs/New-Admin-Page.md` | §2 records that the two documented gaps are closed on `pages/customers` (AIS-19); §3 gains the customers empty-state CTA exception; header date bumped |
| `docs/Specs/Functional-Specification.md` | the O1 row points at the screen contract; header date bumped |
| `docs/plans/2026-11-22--14-20-00-ais-17-customers-admin-screen-design-plan.md` | `D11` and the wizard section rewritten to the confirmed store decision |

## Verification

```text
pnpm quality:docs      -> OK quality:docs: 0 violations
node --test scripts/quality  -> 81 pass / 0 fail   (see note)
```

`pnpm test:quality` itself fails on this Windows shell before running anything — its glob
(`scripts/quality/*.test.mjs`) arrives unexpanded ("Could not find … \*.test.mjs"), a pre-existing
environment limitation unrelated to this change. Running the same suite through node's own discovery
(`node --test scripts/quality`) executes all 81 gate tests, including the four document-gate rules, and
they pass.

## Follow-ups

- **AIS-178** must add the `customers.*` registry entries, the client service, the controller **and** the
  `primaryContactName` projection (`D9`); the five UI tickets cannot start before it.
- **AIS-19** installs `zustand` and owns the first `<page>.store.ts`, plus the new
  `features/api/use-tab-param.ts` reader (first consumer).
- The tab strip stays a page part (`D16`); promoting it into `packages/ui` is a separate ticket.
