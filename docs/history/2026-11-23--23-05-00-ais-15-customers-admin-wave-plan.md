# AIS-15 customers admin — implementation wave plan (planning chat)

**Date:** 2026-11-23 23:05 (Europe/Budapest) · **Ticket:** AIS-15 `Admin - cég felület` and its subtasks
**Plan written:** [`docs/plans/2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md`](../plans/2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md:1)
**Type:** planning — no code, no test, no dependency was changed by this chat

## What was asked

A plan for **AIS-17 and all of its sibling subtasks** (AIS-19, AIS-20, AIS-21, AIS-179, AIS-181,
AIS-182), using `docs/Specs/`, the existing `docs/plans/` entries and the code as evidence, and asking
instead of inventing wherever the ticket text and the shipped API disagree.

## What was verified (not assumed)

| Check | Result |
| --- | --- |
| AIS-17 deliverable | Shipped 2026-11-22: [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1) (`D1`–`D16`), UI-Architecture §5 row, New-Admin-Page §2/§3, history and milestone. The ticket is board drift, not missing work |
| API | 21 `customers.*` operations in the registry; `customersService` exists in `packages/api-client`; `primaryContactName` (AIS-17 `D9`) is in the list row |
| Admin app | No `pages/customers`, no `features/customers`, no `entities/customer`, no `zustand`; the composition root wires **only** `apiKeysService` |
| Error catalogue | Already total and already carries every `customers` conflict code plus `STALE_WRITE` and `SEMANTIC_VALIDATION_FAILED` |
| Contracts | `createCustomerSchema` / `updateCustomerSchema` have **no** `tagIds`; there is **no** operator-directory operation and **no** `listCustomerUsers` operation |

## The four contradictions and how they were resolved

The user confirmed **all four** recommendations in this chat:

1. **Tags** are not an edit-form field — chip actions on the Cégadatok tab through
   `createTag` / `attachTag` / `detachTag` (`D-W1`).
2. **The responsible-operator filter** is deferred until an operator-directory endpoint exists (`D-W2`).
3. **Contacts and users** read from the detail payload, with no pager and no URL list state (`D-W3`);
   only activity and audit are paginated.
4. **Activity edit/delete** renders only on `authorType === 'operator'` rows, recorded as a client-side
   rule until AIS-73/74 adds authentication (`D-W4`).

Two further decisions were derived from the existing documents rather than invented:

5. The wizard route, the page-local store and the `zustand` install stay with **AIS-19**; AIS-182 fills in
   the four steps and the submit (`D-W5`), which keeps both the screen contract and the ticket text true.
6. The wizard sends **one** `POST /customers` and then opens the contacts tab (`D-W6`), because the API
   offers no customer+contact transaction and the screen contract already dropped the contact step.

## What the plan contains

One file, one section per ticket: A (AIS-17 verify-and-close, nine surgical spec deltas), B (AIS-19 list +
wizard shell + store + `zustand`), C (AIS-20 detail shell + overview/data tabs), D (AIS-21 edit form + the
status/archive actions + tag chips), E (AIS-179 contacts/users overlays), F (AIS-181 activity/audit),
G (AIS-182 wizard steps). Each section lists the exact files, the tests and a DoD; §10 is the shared gate
and the commit titles; §11 lists the six items that need a Jira text change or a follow-up ticket.

## Open items this chat deliberately did not decide

- **Q-4:** AIS-182's description still says the wizard creates the first contact too; it must be edited to
  match `D-W6`.

**CSV export is dropped.** AIS-15's description mentions it, but the user confirmed the list needs no
export for now: the plan carries no CSV step and no CSV follow-up ticket, and the remaining open items are
renumbered `Q-1`–`Q-5`.

## How to verify this entry

```bash
ls docs/plans/2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md
git status -sb
```
