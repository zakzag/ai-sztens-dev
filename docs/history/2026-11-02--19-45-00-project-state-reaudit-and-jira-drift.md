# Project state re-audit + Jira drift check

**Date:** 2026-11-02 19:45 (Europe/Budapest)
**Scope:** read-only audit of `apps/*`, `packages/*`, `.github/workflows/*`, root `package.json`, `docs/Specs/*`,
`docs/plans/*`, the git history on `main`, and the Jira project `AIS` (all non-Done issues + the AIS-105 subtree).
**Working tree at audit time:** clean (`git status --porcelain` empty), branch `main`, HEAD `cf35504`.

## Why

The previous audit ([`2026-11-02--12-57-00-project-state-audit-and-ai-handoff-plan.md`](../plans/2026-11-02--12-57-00-project-state-audit-and-ai-handoff-plan.md:1))
was written at 12:57 and three AIS-105 subtasks landed later the same day, so its "ground truth" section
had become actively misleading. This pass re-verified it and cross-checked the board.

## Findings

### 1. Code is green, gates are real

| Check                                      | Result                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm quality:layers` (dependency-cruiser) | pass — 69 modules, 94 dependencies                                                          |
| `pnpm quality:dead-code` (knip)            | pass                                                                                        |
| `pnpm quality:tokens` (palette gate)       | pass — 0 violations                                                                         |
| `pnpm quality:field-errors`                | pass — 0 violations                                                                         |
| `ci.yml`                                   | has the `quality-gates` job (AIS-122) next to `build-test` (AIS-121) and `api-e2e` (AIS-97) |

### 2. Jira ⇄ git drift

| Ticket      | Jira      | Reality                                                                                                                                                               | Action                                               |
| ----------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **AIS-122** | To Do     | Fully implemented: `scripts/quality/*`, dependency-cruiser, knip, CI job, `UI-Architecture.md` §9, history + milestone (`2026-11-02--19-05-00-ais-122-quality-gates`) | **Move to In Review**                                |
| AIS-119     | In Review | Implemented (`features/api/use-list-params.*`), but **not consumed by any page** — `useListParams` occurs only in its own tests                                       | Keep In Review until wired (needs AIS-107 + AIS-114) |
| AIS-120     | Done      | Matches the tree (`test/mocks/handlers/*`, `render-with-providers.tsx`)                                                                                               | —                                                    |
| AIS-124     | Done      | Matches the tree (lockfile + `light-my-request` pin)                                                                                                                  | —                                                    |
| AIS-100     | To Do     | `docs/Specs/API-Convention.md` complete and dated 2026-10-30                                                                                                          | Move to Done                                         |
| AIS-78      | In Review | `pnpm sonar*`, `scripts/sonar/*`, `docs/Specs/SonarQube.md` exist                                                                                                     | Move to Done                                         |
| AIS-99      | To Do     | `docs/Specs/openapi.json` genuinely absent                                                                                                                            | correct as-is                                        |
| AIS-123     | To Do     | Neither new spec exists; depends on AIS-102…104                                                                                                                       | correct as-is                                        |
| AIS-101     | To Do     | No commit-ID rule in `.roo/rules/**`                                                                                                                                  | correct as-is                                        |

**Systemic board defect:** 44 tickets have the status _Done_ but sit in the _In Progress_ status category
(`statusCategory != Done AND status = "Done"` → 44). They never count as finished in reports, burndown or
velocity. This is a workflow configuration problem, not per-ticket work.

### 3. Documentation drift still open

- `docs/Specs/Functional-Specification.md` is still the empty template (no functional source of truth).
- `docs/Specs/Local-Development.md` still says `PASS: 29`; post-AIS-64 the truth is `PASS: 23`
  (`Database-Local.md` §6).
- No `pnpm typecheck` aggregate script, although the git-hooks plan
  ([`2026-10-27--11-41-38-git-hooks-quality-gate-plan.md`](../plans/2026-10-27--11-41-38-git-hooks-quality-gate-plan.md:1))
  depends on it; the plan is still untracked in Jira.
- `apps/web` still has no unit tests (`"test": "echo ... no unit tests yet"`).

## Changes made in this pass

1. [`docs/plans/2026-11-02--12-57-00-project-state-audit-and-ai-handoff-plan.md`](../plans/2026-11-02--12-57-00-project-state-audit-and-ai-handoff-plan.md:1) —
   added a "Delta — re-verified 2026-11-02 19:40" block right after the "How to use this document" block, so a
   reader of §1 knows which rows were superseded by AIS-119/120/122/124.
2. This history entry.

No production code, test, CI or Jira change was made.

## Next

**AIS-107** — server-side pagination (`ZodQueryPipe(listQuerySchema)` on `apiKeys.list`, `findAll` → `findPage`,
`meta.pagination`). It is the first unblocked item that produces user-visible progress: it makes the
already-merged `useListParams` (AIS-119) usable, and it is the prerequisite of AIS-109 → AIS-114 → AIS-110/111.
AIS-123 stays last, because it documents the implemented state.
