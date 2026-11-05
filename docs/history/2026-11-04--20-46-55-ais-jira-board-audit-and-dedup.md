# AIS Jira board audit, duplicate clean-up and admin-readiness plan

**Date:** 2026-11-04 20:46 (Europe/Budapest)
**Scope:** the whole `AIS` Jira project (130 issues, `AIS-1`…`AIS-135`)
**Plan:** [`docs/plans/2026-11-04--20-46-55-standardised-admin-page-readiness-plan.md`](../plans/2026-11-04--20-46-55-standardised-admin-page-readiness-plan.md)
**Milestone:** [`docs/milestones/2026-11-04--20-46-55-ais-board-dedup-and-admin-readiness.milestone.md`](../milestones/2026-11-04--20-46-55-ais-board-dedup-and-admin-readiness.milestone.md)

---

## What was asked

1. Review every Jira issue, find duplicates and tickets implementing the same thing.
2. Ask for approval before changing anything in Jira.
3. Produce a dependency-ordered priority list (independent first, then the dependants).
4. Then: which of these tickets are actually required so that another developer can build admin
   pages with standardised behaviour, data flow, modals and frontend.
5. Store that answer as a plan document.

---

## What was found

The project had already been deduplicated on 2026-11-04 (`AIS-123` and `AIS-132` closed as
duplicates, ownership moved to `AIS-133` / `AIS-100` / `AIS-81`…`AIS-85`). The classic duplicates
were therefore gone. Seven real conflicts remained, four of them measurable against the repository:

| ID | Finding |
| --- | --- |
| D1 | `AIS-14` declared subtasks `AIS-16`…`AIS-22` in its description while owning **none**; `AIS-15` actually owned all seven. `AIS-16` (contract) and `AIS-18` (DB table) are data-layer work and belonged to `AIS-14` |
| D2 | `AIS-70` had `resolution = Done` while **all six** subtasks (`AIS-71`…`AIS-76`) were `To Do`, and `apps/api/src/auth/` and `apps/api/src/public/` did not exist |
| D3 | `AIS-31`/`AIS-32`/`AIS-33` sit in status `Backlog`, which maps to the **done** status category, while 13 subtasks are open |
| D4 | `AIS-125` repeated its own two subtasks' DoD, decisions and tests verbatim; `AIS-99` also overlapped the already-Done `AIS-98` generator |
| D5 | `AIS-129`'s title contained the same deliverable as its subtask `AIS-133` |
| D6 | `AIS-129` claimed a DoD item owned by `AIS-85` without recording the dependency |
| D7 | `AIS-134` referenced non-existent tickets `AIS-139` and `AIS-140` and omitted `AIS-104`/`AIS-102` |
| D8 | `AIS-129` comment `10736` claimed it was a subtask of `AIS-105`; it is a Story with no parent |

Confirmed **not** duplicates: `AIS-101` ↔ `AIS-127` (rule text vs. machine enforcement),
`AIS-123` ↔ `AIS-133` (already resolved), `AIS-132` ↔ `AIS-81/83/85` (already resolved),
`AIS-82` `LogDrawer` ↔ `AIS-117` `Drawer` (different components).

---

## What was changed in Jira (approved by the user)

| # | Change |
| --- | --- |
| D1 | `AIS-16` and `AIS-18` re-parented under `AIS-14`. `AIS-14`'s hand-written "Meglévő subtaskok" table replaced with the real ownership split plus a decision note |
| D2 | `AIS-70` reopened: `To Do`, resolution cleared |
| D4 | `AIS-125` description slimmed to goal + critical path + close-out condition; added a comment on `AIS-99` requiring reuse of the `AIS-98` generator and documenting the corrected prerequisite chain `AIS-72 → AIS-75 → AIS-110 → AIS-99 → AIS-100` |
| D5 | `AIS-129` renamed to *"Standardizált admin oldal: referencia-szelet és egységes „új oldal" folyamat"* |
| D6 + D8 | `AIS-129` comment `10736` rewritten: false parent claim corrected to *relates to*, `AIS-85` prerequisite recorded with measured evidence |
| D7 | `AIS-134` rewritten: dangling `AIS-139`/`AIS-140` references replaced by `AIS-135` / "this ticket", `AIS-104` and `AIS-102` added to the stale-status table |
| Statuses | `AIS-116`, `AIS-117`, `AIS-104`, `AIS-102` → **Done** |

All changes were verified afterwards with `parent = AIS-14 OR parent = AIS-15` and a
`key IN (...)` status query.

---

## Verified repository evidence

| Claim | Check |
| --- | --- |
| data-display primitives complete (`AIS-116`) | `data-table/`, `pagination/`, `empty-state/`, `skeleton/`, `description-list/`, `status-badge/` in `packages/ui/src/components/` |
| overlay primitives complete (`AIS-117`) | `dialog/`, `confirm-dialog/`, `drawer/`, `tooltip/`, `dropdown-menu/` |
| CRUD reference slice complete (`AIS-131`) | `apps/admin/src/pages/api-keys/ApiKeyDetailPage.tsx`, `ui/ApiKeyEditForm.tsx`, `ui/ApiKeyDeleteDialog.tsx` |
| toast **missing** | no `toast/` and no `log-drawer/` under `packages/ui/src/components/`; `packages/` has no `notifications` |
| OpenAPI baseline **missing** | no `scripts/openapi/`, no `openapi:generate` / `openapi:check` script |
| migration pipeline **missing** | no `migrate` service in `infra/*.yml`, no migration step in `deploy/`; `apps/api/src/migrate.ts` documents its own missing advisory lock |
| companies **missing** | no `companies` module in `apps/api/src/` |
| auth layer **missing** | no `apps/api/src/auth/`, no `apps/api/src/public/` |
| no component catalogue | `storybook` absent from every `package.json` |
| no admin E2E harness | `playwright` / `cypress` absent from every `package.json` |

---

## Deliverables

1. `docs/plans/2026-11-04--20-46-55-standardised-admin-page-readiness-plan.md` — the readiness plan:
   already-standardised dimensions, the three blockers, out-of-scope tickets, untracked gaps,
   execution tracks, verification commands, risks.
2. `docs/milestones/2026-11-04--20-46-55-ais-board-dedup-and-admin-readiness.milestone.md` —
   the decision-grade summary.

---

## Answer in one line

To let a second developer build fully standardised admin pages, three things are needed:
`AIS-133` (the recipe) and `AIS-128` (a green typecheck) in parallel today, then the
`AIS-81 → AIS-83 → AIS-84 → AIS-85` chain (the missing toast plus switching the reference page to
`useAppForm`). Everything else is either already done, a consumer of the standard, or
release/infrastructure work.
