# AIS-14 R4 — the story-level milestone

**Date:** 2026-11-23 23:47 (Europe/Budapest)
**Branch:** `AIS-14-company-admin` — HEAD after this chat: `a2ab1a8`
**Ticket:** AIS-14 (Story)
**Type:** documentation only

## What this chat produced

[`docs/milestones/2026-11-23--21-20-00-ais-14-customer-data-layer.milestone.md`](../milestones/2026-11-23--21-20-00-ais-14-customer-data-layer.milestone.md:1)
— the **story-level** record the closeout plan §6 asks for. It is deliberately not a repeat of the
three existing slice milestones (`customers API`, `slice e`, `slice f`); those narrate one increment
each, this one states the decisions that outlive them.

### Structure (the six mandatory sections)

| § | Content |
| --- | --- |
| 1 Problem | the admin had no customer master data; the "one `note` column" shortcut would produce a record that cannot be filtered, audited or attributed |
| 2 Rationale | the four-schema split with the composite foreign keys that make cross-customer references impossible; invariants classified by constraint name (`409`/`422`, unknown `23505` stays `500`); append-only ledger; `updatedAt` as a compared token; no `note`, no billing; and the **rejected** alternative of one Nest module per child |
| 3 Implementation map | one line per layer: `schema.ts` + `0005`–`0007`, `packages/shared` contract (21 operations), the six `apps/api/src/customers/*` feature folders, `apps/api/src/audit`, `packages/api-client/src/customers`, and the docs |
| 4 Evidence | the R1 numbers (3059 unit / 18 e2e suites / 140 e2e tests, quality 0 violations) **and** the five defects the sweep found, because they are the most transferable lesson of the increment |
| 5 How to verify | the exact `db:migrate` + serial e2e command sequence, with the Node ≥ 24.9 and the ledger-purge prerequisites |
| 6 Known limitations | `system` actor until AIS-73/74 (`D6`, not backfillable), duplicate `customerNumber` unit-only (`D3`), no UI yet (AIS-15/AIS-179 → AIS-19), no subscriptions (AIS-176), no OpenAPI baseline (AIS-99) |

Length: ~700 words, English, table-heavy — the milestone is project memory, not a narrative.

## Verification

```text
node scripts/quality/docs-gate.mjs  -> OK quality:docs: 0 violations
```

## Follow-ups

- **R5:** push, open the PR with the R2 body, merge with the same title, then the Jira pass:
  `AIS-178` → `Done`, `AIS-14` → `Done` with the DoD text replaced by the
  [`API-Convention.md`](../Specs/API-Convention.md:312) §4.3.1 convention and this milestone linked,
  `AIS-17` → `Done` on the strength of [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1).
- After the merge, AIS-19 (`céglista`) is the first AIS-15 UI slice and the change that installs
  `zustand` (`D11`).
