# AIS-17 — the wave decisions are now in the screen contract

**Date:** 2026-11-24 01:52 (Europe/Budapest) · **Ticket:** AIS-17 `Admin - cég felület — képernyőterv`
**Type:** documentation change — no code, no test, no dependency was added or removed
**Plan:** [`2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md`](../plans/2026-11-23--23-05-00-ais-15-customers-admin-implementation-wave-plan.md:1) §3, deltas `A1`–`A9`

## Why this change

AIS-17 already shipped its deliverable on 2026-11-22, so the wave plan turned the ticket into a
**verify-and-close** step: four (plus two derived) decisions of the AIS-15 planning chat had to be
written back into the living screen contract before AIS-19 starts creating the page. A concrete screen
contract that still described a deferred filter, a paged contact list and a tag form field would have
sent AIS-19…182 into work the API cannot support.

## What was edited

| Delta | File | Change |
| --- | --- | --- |
| `A1` | [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:86) §2.1 | The responsible-operator filter row is marked **deferred (`D-W2`)**: no operator-directory operation exists, so the planned `Combobox` has no source; the schema keeps `responsibleOperatorId` so the filter stays additive later |
| `A2` | same, §2.3 | New first bullet: **three contractual filters are implemented** (`type`, `status`, `source`) plus `q`; the fourth is deferred. The §6 state-plan row says "three implemented filters of four" instead of "four filters", and `D7` was aligned the same way |
| `A3` | same, §3.2 + §3.3 | Contacts and users are read from the **detail payload** (`D-W3`): no pager, no URL list state, and the `DataTable isLoading` claim is replaced by the detail's own loading state (the tab has no request of its own) |
| `A4` | same, §3.2 `activity` row | Activity edit/delete render **only** where `authorType === 'operator'` (`D-W4`), recorded as a client-side rule until AIS-73/74 adds authentication |
| `A5` | same, §5 | New table row: tags are **not** a form field (`D-W1`) — `updateCustomerSchema` has no `tagIds`, so `PATCH` never carries them; the chip strip on the Cégadatok tab drives `createTag` / `attachTag` / `detachTag` |
| `A6` | same, §4.4 | New paragraph: the wizard creates **only the company** with **one** `POST /customers` (`D-W6`), then navigates to `/customers/:id?tab=contacts`; AIS-182's description still says otherwise and this file wins (plan `Q-4`) |
| `A7` | same, §10 + §1 | The file map now names the real hooks per ticket (`use-customers-list` / `use-archive-customer`, `use-customer-detail`, `use-update-customer` / `use-update-customer-status` / `use-customer-tags`, `use-customer-contacts` / `use-customer-users`, `use-customer-activities` / `use-customer-audit-logs`, `use-create-customer`), and `use-tab-param` is marked **created by AIS-19**, reused by AIS-20 for `?tab=` |
| `A8` | [`UI-Architecture.md`](../Specs/UI-Architecture.md:964) §5 | The `pages/customers` row now records the three implemented filters, the deferred operator filter and the fact that the contacts/users tabs carry no URL list state; the `D-W1`–`D-W6` extension is named beside the screen contract link |
| `A9` | [`New-Admin-Page.md`](../Specs/New-Admin-Page.md:87) §2 | "the search field and the four contract filters" became **three of the four**, with the deferred one named |

All three documents carry a refreshed `**Utolsó frissítés:** 2026-11-24` header line.

## Two findings worth keeping

1. **`A5` had nothing to delete.** The plan expected a `címkék` field to be removed from the §4.1 step
   list; the shipped contract never listed one (step 3 carries only address fields). The decision was
   therefore recorded where it belongs — as a §5 rule that `PATCH` never carries tags — instead of
   deleting a line that did not exist.
2. **`pnpm test:quality` cannot run on Node 20.** The script passes a quoted glob to `node --test`
   (`"scripts/quality/*.test.mjs"`), and `--test` glob expansion arrived in Node ≥ 21; this machine runs
   `v20.19.2`, so the script fails with *Could not find …\scripts\quality\*.test.mjs*. The fixtures were
   run with the equivalent explicit paths instead:
   `node --test scripts/quality scripts/db scripts/lib/vite-build.logic.test.mjs` → **124 pass, 0 fail**.
   The gap is in the script, not in this change, and is left untouched here.

## Verification (run in this session, all green)

```text
pnpm quality:docs                      -> OK quality:docs: 0 violations
node --test scripts/quality scripts/db \
  scripts/lib/vite-build.logic.test.mjs -> pass 124 / fail 0
pnpm quality                           -> layers ✔ (130 modules), knip ✔, palette ✔,
                                          themes ✔, field-errors ✔, docs ✔
```

`pnpm quality:docs` re-checks exactly what this change could break: every relative link resolves (R1),
every `§N` next to a document link names an existing section (R2), and each `docs/Specs` document keeps
its `**Utolsó frissítés:** YYYY-MM-DD` line (R3).

## Follow-ups

- **`A12` (Jira):** AIS-17 → **Done** with a comment listing the screen contract, the UI-Architecture §5
  row, the two section edits (`§2.3`, `§4.4`) and this entry plus the commit title. It is the same board
  action the AIS-14 R5 handoff already schedules, so both can be done in one pass (`Q-5`).
- **`Q-4`:** AIS-182's description still promises "the company … and its first contact" — it must be
  edited to match `D-W6`; the contract now prefers the Jira text to change, not the screen.
- No milestone was written for this step, and the wave plan says so explicitly: the decision-grade record
  already exists in
  [`2026-11-22--14-33-00-customers-admin-screen-contract.milestone.md`](../milestones/2026-11-22--14-33-00-customers-admin-screen-contract.milestone.md:1),
  and these deltas are corrections to it, recorded here.
- **Next:** AIS-19 (wave plan §4, `B1`–`B23`) remains gated on the AIS-14 merge; until the PR is
  squash-merged, no `apps/admin` slice should start.
