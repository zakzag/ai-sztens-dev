# Customers admin screen contract (AIS-17)

**Date:** 2026-11-22 · **Ticket:** AIS-17 (subtask of AIS-15) · **Contract:** [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md)

## 1. Problem / feature

The `customers` contract landed in AIS-16, but nothing defined **what the admin screens contain**.
Five implementation tickets (AIS-19 list, AIS-20 detail, AIS-21 edit, AIS-179 contacts, AIS-181 audit)
would each have invented their own columns, tabs, routes and state ownership. AIS-17 had to freeze that
design **using only the primitives that already exist**, so those tickets write domain code only.

## 2. Evidence that shaped the design

| Finding | Fact |
| --- | --- |
| No API yet | `packages/shared/src/contract/customers/` has no `customers.contract.ts`; the AIS-14 plan `D-C` puts the registry, client service and controller in **AIS-178** → every UI ticket is blocked on it |
| Missing column | `customerSchema` has no primary contact, yet AIS-17 `D1` requires that column → new derived projection needed |
| No admin code yet | `apps/admin/src/` has no `pages/customers`, `features/customers`, `entities/customer` → the file map had to be part of the contract |
| Mockup drift | The mockup wizard has 5 steps incl. „Cím & számlázás” plus billing/subscription cards, all excluded by AIS-16 `D4`/`D9` and deferred to AIS-176 |
| Rule collision | AIS-174 forbids an action button in the empty state; AIS-17 `D4` requires one → the first real conflict between two closed decisions |

## 3. Rationale

Three choices carry the design:

- **Pages, not overlays, for detail and edit.** `api-keys` uses dialogs because its entity is small. Six
  tabs and a four-section form do not fit a dialog, so `/customers/:id` and `/customers/:id/edit` are
  **sibling** registry entries (they replace the list) with the list as breadcrumb parent — the same
  parent choice `api-keys` already makes, so no new breadcrumb capability was invented. Contacts and
  users stay overlays and therefore children of the detail entry.
- **A page-local store, one, and only for the wizard draft.** The step is URL (`?step=`) and the inputs
  are react-hook-form, but a value must cross step boundaries and react-hook-form seeds
  `defaultValues` on mount only — so the draft needs the page store. `zustand` is installed by AIS-19,
  the §7 dependency row flips there, and the store never holds server data.
- **The scope exclusions are named, not implied.** Billing, IBAN, subscriptions, module/fee columns and a
  `note` field are listed with the ticket that owns each, because the mockup shows all five.

## 4. Implementation

| File | Change |
| --- | --- |
| `docs/Specs/Customers-Admin-Screens.md` | **new** living spec: routes/URL table, 8 list columns, filters and sort, 6 detail tabs × primitives × four states, 4-step wizard + store contract, edit surface, state-plan row, exclusions, `D1`–`D16`, test matrix, file map |
| `docs/Specs/UI-Architecture.md` | §5 row for `pages/customers`; `zustand` paragraph and §7 row now name the page and the installing ticket; date bumped |
| `docs/Specs/New-Admin-Page.md` | §2 assigns the two documented gaps to AIS-19; §3 adds the customers empty-state CTA exception; date bumped |
| `docs/Specs/Functional-Specification.md` | O1 row links the screen contract; date bumped |
| `docs/plans/2026-11-22--14-20-00-ais-17-customers-admin-screen-design-plan.md` | `D11` and the wizard section reflect the confirmed store decision |

No component, route, test or dependency was added.

## 5. Outcome and verification

- The five UI tickets now have one place to read: the spec names every file, every primitive, every
  state, and the `D1`–`D16` decisions, so a reviewer can reject a deviation by pointing at a row.
- Verification: `pnpm quality:docs` → **0 violations**; `node --test scripts/quality` → **81 pass /
  0 fail** (including the four document-gate rules). `pnpm test:quality` cannot run on this Windows
  shell — its glob arrives unexpanded, a pre-existing limitation, worked around as above.
- A future reader can confirm the contract still holds by searching the spec for the element in
  question and checking the primitive it names exists in `packages/ui/src/components`.

## 6. Follow-ups

- **AIS-178** gains a small contract addition: the derived `primaryContactName` list projection (`D9`).
- **AIS-19** installs `zustand`, owns the first `<page>.store.ts`, and creates the generic
  `features/api/use-tab-param.ts` reader whose first consumers are `?step=` and `?tab=`.
- The tab strip is a page part (`D16`); promoting it to `packages/ui` is a separate ticket.
- The status change is a header action on `PATCH /:id/status` (`D15`), not an edit-form field.
