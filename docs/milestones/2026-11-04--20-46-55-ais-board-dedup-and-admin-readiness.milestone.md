# AIS board dedup and standardised admin page readiness

**Date:** 2026-11-04 20:46 (Europe/Budapest)
**Tickets:** `AIS-14`, `AIS-15`, `AIS-16`, `AIS-18`, `AIS-70`, `AIS-102`, `AIS-104`, `AIS-116`,
`AIS-117`, `AIS-125`, `AIS-128`, `AIS-129`, `AIS-133`, `AIS-134`, `AIS-135`
**Plan:** `docs/plans/2026-11-04--20-46-55-standardised-admin-page-readiness-plan.md`

---

## 1. Problem / feature

Two questions were open at once:

1. The `AIS` Jira board did not describe reality — a resolved story had six untouched children,
   a parent story declared subtasks it did not own, and four tickets sat on stale statuses. The
   board was not usable as an onboarding artefact.
2. Nobody could answer *which* of the 55 open issues must actually be finished before a second
   developer can build admin pages whose behaviour, data flow, modals and frontend are standardised.

## 2. Measured data / evidence

| Observation | Evidence |
| --- | --- |
| `AIS-70` resolved `Done`, all six children `To Do` | `resolutiondate = 2026-10-23`; `apps/api/src/auth/` and `apps/api/src/public/` do not exist |
| `AIS-14` owned **0** subtasks while listing 7 in its description | JQL `parent = AIS-14` returned nothing before the change; all seven were children of `AIS-15` |
| 4 tickets on stale statuses | `packages/ui/src/components/` contains all `AIS-116` and `AIS-117` primitives; `AIS-106`…`AIS-110` all Done |
| 3 statuses in the `done` category while work is open | `AIS-31`/`AIS-32`/`AIS-33` are `Backlog`; 13 subtasks open |
| toast feedback layer absent | no `toast/` or `log-drawer/` in `packages/ui/src/components/`; no `packages/notifications` |
| reference page uses a non-standard form | `ApiKeyForm.tsx` uses raw `useForm` + a permanent inline success `Alert` |
| typecheck is red on the production repo | 20 errors in 6 `apps/api` spec/e2e files, excluded from `tsconfig.build.json` |
| no component catalogue, no admin E2E | no `storybook`, `playwright` or `cypress` in any `package.json` |

## 3. Root cause / design rationale

**Board defect:** the workflow maps `Backlog` to the **done** status category and `Done` to
`indeterminate`. Any ticket parked in `Backlog` therefore reports as finished, and a story can be
resolved while its children are untouched — the two together make the board systematically
optimistic.

**Duplication defect:** earlier dedup work was done ticket-by-ticket, without a cross-check against
the repository. It closed the correct duplicates (`AIS-123`, `AIS-132`) but never verified that the
remaining owners still existed or that the receiving stories knew about their new dependency.

**Readiness rationale:** the standard was designed as four feedback levels (field → page → app →
transient). Levels 1–3 shipped; level 4 (toast) was assigned to a story (`AIS-86`) that had not
started. Because the reference page therefore demonstrates the *old* pattern, the cost of the gap is
not one missing component but **every future page copying the wrong example**.

## 4. Solution / implementation

| File / artefact | Change |
| --- | --- |
| `AIS-16`, `AIS-18` | re-parented under `AIS-14` — contract and DB work belongs to the data-layer story |
| `AIS-14` | description: false "Meglévő subtaskok" table replaced with a real ownership table + D1 decision note |
| `AIS-70` | reopened (`To Do`), resolution cleared |
| `AIS-125` | description slimmed to goal + critical path + close-out; verbatim subtask duplication removed |
| `AIS-99` | comment: must reuse the `AIS-98` generator; corrected prerequisites `AIS-72` → `AIS-75` → `AIS-110` → `AIS-99` |
| `AIS-129` | renamed (no longer restates `AIS-133`); comment `10736` rewritten — false parent claim corrected, `AIS-85` prerequisite recorded |
| `AIS-134` | rewritten: dangling `AIS-139`/`AIS-140` references removed, `AIS-104` and `AIS-102` added |
| `AIS-116`, `AIS-117`, `AIS-104`, `AIS-102` | status → `Done` |
| `docs/plans/2026-11-04--20-46-55-standardised-admin-page-readiness-plan.md` | the readiness plan |
| `docs/history/2026-11-04--20-46-55-ais-jira-board-audit-and-dedup.md` | change narrative |

## 5. Outcome and how to verify

**Outcome:** the board now reflects the repository for every ticket that was checked, and the path to
a standardised admin page is three blockers: `AIS-133` (the recipe) and `AIS-128` (green typecheck)
in parallel, then `AIS-81 → AIS-83 → AIS-84 → AIS-85` (the missing toast plus switching the reference
page to `useAppForm`).

**Verify in Jira:**

```text
parent = AIS-14            → returns AIS-16, AIS-18 only
status = Done AND key IN (AIS-102, AIS-104, AIS-116, AIS-117)   → all four
key = AIS-70               → To Do, resolution empty
```

**Verify in the repo after the readiness work:**

```bash
pnpm quality && pnpm test:quality && pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
rg "useForm\(" apps/admin/src/pages     # must return nothing
ls packages/ui/src/components/toast     # must exist
```

## 6. Follow-ups

- Fix the Jira workflow status→category mapping (`Backlog` out of `done`) — a settings change, not an API call.
- Untracked gaps: component catalogue (Storybook), admin E2E harness (Playwright), i18n text catalogue.
- `AIS-22` stays blocked until an email-module endpoint exists.
- `AIS-1` (`MVP`) and `AIS-77` (`STEP-2`) epics have zero children — link their stories.
- `AIS-5` has no description, acceptance criteria or DoD — write it or close it.
- Auth `AIS-71`…`AIS-74` is not needed for page development but is a hard release gate; do not close `AIS-70` before the admin routes are authenticated.
