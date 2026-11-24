# Jira status sync for the AIS-14 customers data layer

**Date:** 2026-11-23
**Tickets:** AIS-14 (story), AIS-16, AIS-18, AIS-177, AIS-178 (subtasks)
**Related:** [`docs/history/2026-11-23--19-16-00-ais-178-f-activities-and-audit-log.md`](2026-11-23--19-16-00-ais-178-f-activities-and-audit-log.md), [`docs/history/2026-11-23--15-23-00-ais-14-gap-analysis.md`](2026-11-23--15-23-00-ais-14-gap-analysis.md)

## Why this chat happened

The last code slice of AIS-178 (activities + `GET /:id/audit-logs`) was committed as `d37d2d5`
and pushed, but the board still showed **every** AIS-14 subtask as `To Do`. The board said
"nothing has started" while `main` contained four migrations, an audit writer and 21 `customers.*`
operations. This chat reconciled Jira with the repository, and re-measured the test suites so the
statuses rest on evidence instead of memory.

## Verified facts (measured in this chat, at HEAD of `AIS-14-company-admin`)

| Gate | Result |
| --- | --- |
| `pnpm --filter @callback/shared test` | 403 passed, 26 suites |
| `pnpm --filter @callback/api-client test` | 296 passed, 11 suites (incl. the AIS-110 coverage gate) |
| `pnpm --filter @callback/api test` | 1002 passed, 76 suites |

The PR body draft from the previous slice recorded 403 / 261 / 815 — the client and API numbers had
moved, which is exactly why the DoD claim is now backed by a fresh run.

## Jira changes

| Ticket | Comment | Status |
| --- | --- | --- |
| AIS-16 | plan artefacts and the recorded decisions (`D9` no `note` column, soft delete, `updated_at` as a token, DB-owned invariants) | `To Do` → **Done** |
| AIS-18 | migrations `0005`–`0007`, `schema.ts`, the partial unique indexes and the composite foreign keys that make cross-customer references impossible | `To Do` → **Done** |
| AIS-177 | `apps/api/src/audit/*`, `AuditWriter` inside the business transaction, append-only triggers, `D6` actor limitation | `To Do` → **Done** |
| AIS-178 | slices b–f with commit hashes, the 21 registered operations, DoD evidence, known limitations | `To Do` → **In Review** |
| AIS-14 | full DoD matrix, subtask state, the `422` vs `400`/`409` deviation, remaining closeout steps, AIS-15 handoff | `To Do` → **In Progress** |

## Decisions worth keeping

- **AIS-178 stays `In Review`, not `Done`.** Its DoD is satisfied, but nothing is merged; `Done`
  would claim a closure the branch does not have. AIS-16 / AIS-18 / AIS-177 have no open code, so
  they close immediately.
- **AIS-14 stays open for two paperwork items and one decision**, not for code: the story-level
  milestone, the recorded `PATCH` status-code decision, and the merge.
- **The `409` coverage claim is now precise.** Tax number, second `owner` and second `primary`
  contact are proven in e2e; duplicate `customerNumber` is unit-only because the value is
  server-generated and cannot be forced through the public API. That gap is a documented acceptance,
  not an omission.
- **`422` vs `400`/`409` is a text defect in the ticket, not a code defect.** AIS-108 already set the
  convention; the story DoD still asks for `422` on `PATCH /:id`. The decision to record is "keep
  AIS-108 and fix the DoD text", because adding a once-off `422` branch would make the customers
  resource the only place in the API that answers that way.

## How to verify

```bash
gh issue view 178 --repo zakzag/ai-sztens-dev   # or open the ticket while logged in to Jira
```

Cheap repository-side checks that back each ticket:

```bash
git log --oneline -8                                         # the slice commits
grep -c operationId packages/shared/src/contract/customers/customers.contract.ts   # 21
ls apps/api/drizzle/*.sql                                    # 0000..0007
grep -rn "PRIMARY_CONTACT_CONFLICT\|OWNER_CONFLICT" apps/api/test   # the 409 e2e cases
```

## Follow-ups

- Record the `PATCH` status-code decision on AIS-14 and, if needed, in `docs/Specs/API-Convention.md`.
- Write the story-level AIS-14 milestone (the slice-level one already exists).
- After the merge: AIS-178 → `Done`, then AIS-14 → `Done`, then start **AIS-19** (céglista) as the
  first AIS-15 UI slice.
- `docs/plans/2026-11-23--pr-body-ais-178.md` is still written for the pre-slice-e state ("Not in this
  PR: slice e, slice f") and must be updated before the PR description is used.
