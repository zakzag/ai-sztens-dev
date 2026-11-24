# AIS-14 R2 + R3 — the PR body and the recorded `PATCH` decision

**Date:** 2026-11-23 23:45 (Europe/Budapest)
**Branch:** `AIS-14-company-admin` — HEAD after this chat: `83849d3`
**Tickets:** AIS-14 (Story), AIS-178 (subtask in review)
**Type:** documentation only — no code, no test, no dependency was changed

## R2 — PR body refresh (`704bfbe`)

[`docs/plans/2026-11-23--pr-body-ais-178.md`](../plans/2026-11-23--pr-body-ais-178.md:1) was written
for the pre-slice-e state. It is now the review text of the actual diff:

| Was | Is |
| --- | --- |
| AIS-178 “slices b, c, d” | **slices b–f**; the ticket table also names AIS-17's spec-only contribution |
| 10 endpoints (customers + contacts) | **21**, grouped by resource, taken from the `operationId`s in [`customers.contract.ts`](../../packages/shared/src/contract/customers/customers.contract.ts:143) |
| 403 / 261 / 815 | the numbers measured in R1: 3059 tests (403 · 296 · 270 · 519 · 562 · 1010) and e2e 18 suites / 140 tests |
| “Not in this PR: slice e, slice f” | only what is genuinely out of scope: admin UI (AIS-15/AIS-179 → AIS-19), subscriptions (AIS-176), admin auth (AIS-71/72/73/74), OpenAPI baseline (AIS-99) |

Two additions a reviewer will need:

1. **A “defects found by the close-out gate sweep” table** — the five defects R1 found and this PR
   fixes. Without it the diff would look unmotivated: why `qualifiedColumn()`, why the widened
   `toNullableIsoString`, why the database owns `status_changed_at`, why the activity token is text.
2. **“The ledger has no write path”** as a design decision: the repository exposes `findPage` only and
   the `0007` triggers refuse `UPDATE`/`DELETE`/`TRUNCATE` even for the owner.

The PR title at the top of the file is the squash-merge title:

```text
AIS-14: feat(api): add the customer data layer with audit, contacts, tags, users and activities
```

Every claim was cross-checked against the source before writing: 21 `operationId`s, the error
catalogue (`CUSTOMER_OWNER_CONFLICT`, `CUSTOMER_USER_EMAIL_CONFLICT`,
`CUSTOMER_USER_IN_USE_CONFLICT`, `SEMANTIC_VALIDATION_FAILED` → `422`), the tag POST's
create-or-attach versus the tag PATCH's attach-only summaries, and the `/customer-users` path.

## R3 — the recorded decision (`83849d3`)

AIS-14's DoD asks for “`422` semantic error on `PATCH /:id`”. The implementation follows AIS-108, so —
per the closeout plan §5 / `D1` — the **ticket text** changes, not the code. New
[`API-Convention.md`](../Specs/API-Convention.md:312) §4.3.1:

| Situation on `PATCH /api/admin/customers/:id` | Answer |
| --- | --- |
| malformed body / unknown key / non-uuid `:id` | `400 VALIDATION_FAILED` + `details[].path` |
| valid body, `updatedAt` not the current version | `409 STALE_WRITE` + `details[{ path: 'updatedAt' }]` |
| valid body, content impossible (foreign `customerUserId` / `tagId`, `from > to`, …) | `422 SEMANTIC_VALIDATION_FAILED` |
| empty patch object with the current token | `200`, silent no-op (AIS-108 `D7`) |

The rule is stated once: **`PATCH` never answers `422` for a shape or a version problem.** Two
corollaries are recorded with it — the same split applies to the child resources, and `DELETE` never
answers `STALE_WRITE` because it carries no body. The section also documents the activity token
(`updated_at ?? created_at`) that the R1 fix made work.

The document header (`**Utolsó frissítés:**`) and the `Frissítések` list were bumped in the same edit,
and a new bullet names AIS-14 `D1` so the decision is findable from the top of the file.

## Verification

```text
node scripts/quality/docs-gate.mjs  -> OK quality:docs: 0 violations
pnpm test:quality                   -> 124 tests / 124 pass / 0 fail
```

## Follow-ups

- **R4:** the story-level milestone
  (`docs/milestones/2026-11-23--21-20-00-ais-14-customer-data-layer.milestone.md`).
- **R5:** push, open the PR with this body, merge with the same title, then the Jira pass —
  `AIS-178` → `Done`, `AIS-14` → `Done` with the DoD text replaced by the §4.3.1 three-line convention,
  and `AIS-17` → `Done` on the strength of [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1).
