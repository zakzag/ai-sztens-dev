# Next-step triage — AIS-14 closeout vs. starting a new ticket

**Date:** 2026-11-23 22:35 (Europe/Budapest)
**Branch:** `AIS-14-company-admin` — `ahead 5` of `origin/AIS-14-company-admin`, HEAD `5390de4`
**Tickets touched:** AIS-14 (Story, `In Progress`), AIS-178 (`In Review`), AIS-17 (drift found)
**Type:** advisory — no code, no test, no dependency was changed by this chat

## Why this chat happened

The question was "what is the next development step, which Jira ticket". The answer is
already written down as a plan, so this entry only records the **re-verified board and
repository state** and the resulting ordering, not a new plan.

## Measured state (verified in this chat)

| Check | Result |
| --- | --- |
| `git status -sb` | branch `AIS-14-company-admin`, `ahead 5`, only two untracked `docs/temp/` scratch files |
| `git log --oneline -6` | closeout plan + audit-actor fix + Jira sync on top of `d37d2d5` (slice f) |
| AIS-14 | `In Progress` — code complete, paperwork and merge outstanding |
| AIS-178 | `In Review` — no PR is open yet (the closeout plan step R5.1 is still to do) |
| AIS-16 / AIS-18 / AIS-177 | `Done` |
| AIS-15 | `To Do` — children AIS-17/19/20/21/179/181/182 all `To Do` |
| AIS-183 (Vapi MVP) | `To Do`, five child subtasks `To Do` — no branch started |

## The answer

**Next step: finish the AIS-14 closeout; do not start a new ticket.** The work is fully
specified in
[`docs/plans/2026-11-23--21-20-00-ais-14-closeout-plan.md`](../plans/2026-11-23--21-20-00-ais-14-closeout-plan.md:40)
§2 (§3–§7 give the commands and the exact texts):

| Order | Item | Ticket in the commit title |
| --- | --- | --- |
| R1 | Full gate sweep on HEAD (`quality`, `test:quality`, `typecheck`, `lint`, `build`, `test`, `db:diagram:check`, `test:e2e` with a real `DATABASE_URL`) | `AIS-14: fix(<scope>): …` only if a gate fails |
| R2 | Refresh the PR body (21 endpoints, the R1 numbers) and open the PR | `AIS-14: docs(pr): refresh the AIS-178 pull request body` |
| R3 | Record the `PATCH /:id` status-code decision (D1) in `API-Convention.md` §4.3 | `AIS-14: docs(specs): record the customers patch and delete status-code decision` |
| R4 | Story-level milestone `docs/milestones/2026-11-23--21-20-00-ais-14-customer-data-layer.milestone.md` | `AIS-14: docs(milestones): add the customer data layer milestone` |
| R5 | Squash-merge as `AIS-14: feat(api): add the customer data layer with audit, contacts, tags, users and activities`, then `AIS-178` → `Done`, `AIS-14` → `Done` (+ DoD text fix) | — |

**First new ticket after the merge: AIS-19** (`Admin - impl: admin oldal: céglista`) — the first
UI slice of AIS-15, whose screen contract already exists in
[`docs/Specs/Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1). AIS-19 is also
the ticket that installs `zustand` (`D11`) and closes the two AIS-174 gaps on `/customers` (`D7`).

**Do not start AIS-183 (Vapi MVP) in parallel on this branch.** It is a separate story with a
database footprint of its own; mixing it into the pre-merge AIS-14 branch would make the squash
title and the review scope meaningless.

## Findings worth keeping

- **AIS-17 is board drift, not missing work.** The ticket `Admin - terv: admin oldal (lista, adatlap)`
  is `To Do`, but its deliverable shipped on 2026-11-22:
  [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:1) (383 lines, `D1`–`D16`) plus
  [`history/2026-11-22--14-33-00-ais-17-…`](2026-11-22--14-33-00-ais-17-customers-admin-screen-design.md:1).
  It should be flipped to `Done` with that evidence in the same Jira pass as R5, and it is a
  subtask of AIS-15 — the closeout plan's header lists it under AIS-14, which is a documentation
  slip in that plan.
- `gh` is not authenticated in this environment, so the PR state was confirmed from the plan and
  the local branch (`ahead 5`), not from GitHub.

## How to verify

```bash
git status -sb
git log --oneline -6
ls docs/Specs/Customers-Admin-Screens.md
```

Jira: AIS-14 (children AIS-16/18/177/178) and AIS-15 (children AIS-17/19/20/21/179/181/182).

## Follow-ups

- Fix the AIS-14/AIS-15 parent attribution of AIS-17 in the closeout plan header when R5 edits Jira.
- Update `docs/plans/2026-11-23--pr-body-ais-178.md` before the PR description is used (R2).
