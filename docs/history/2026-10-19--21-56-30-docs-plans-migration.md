# Plan documents moved from `docs/history/` to `docs/plans/`

- **Date:** 2026-10-19 21:56 (Europe/Budapest)
- **Scope:** `docs/plans/`, `docs/history/`, `docs/milestones/`, `docs/Specs/`, `deploy/README.md`, `.roo/rules/`
- **Milestone:** [`docs/milestones/2026-10-19--21-57-00-docs-plans-migration.milestone.md`](../milestones/2026-10-19--21-57-00-docs-plans-migration.milestone.md)

## 1. What was asked

The original rule ([`.roo/rules/general.coding-standards.md`](../../.roo/rules/general.coding-standards.md) →
"Planning Artifacts") stored every implementation plan in `docs/history/`, mixed together with
post-implementation change summaries. The request: plans must live in `docs/plans/`, and all
references to plan documents must be updated so that labels and link targets match.

## 2. Starting state (measured)

| Item | Quantity |
|---|---|
| Plan documents already in `docs/plans/` | 15 |
| Plan documents still in `docs/history/` (`*-plan.md`) | 21 |
| Files containing plan references | 41 (before the rewrite), 15 (after) |
| Duplicates with the same filename in both folders | 0 (previous staged deletions had already removed them) |

A partially executed manual migration left several links with a **label saying `docs/history/…`**
while the **target pointed at `../plans/…`**, and left a set of links with shorthand filenames that
never existed (`2026-09-28-api-healthcheck-fail-plan.md`, `2026-09-26-container-mem-limits-after-oom-plan.md`,
`2026-09-18-droplet-deploy-infra-plan.md`, `2026-09-21-stack-smoke-tests-plan.md`, …).

## 3. What was done

1. **Move** — all 21 remaining `*-plan.md` files were moved with `git mv` from `docs/history/` to
   `docs/plans/` (36 plan documents now in `docs/plans/`, 0 left in `docs/history/`).
2. **Reference rewrite** — a throw-away script replaced
   `docs/history/<plan>.md` → `docs/plans/<plan>.md`, `../history/<plan>.md` → `../plans/<plan>.md`,
   `history/<plan>.md` → `plans/<plan>.md` and, inside `docs/history/*.md`, bare same-folder plan
   links `(<plan>.md)` → `(../plans/<plan>.md)`. This rewrote 41 files (Specs, milestones, history
   entries, top-level docs, `deploy/README.md`).
3. **Link repair inside `docs/plans/`** — moved plans that linked to non-plan docs with a bare
   relative path were re-pointed at `../history/…`, `../milestones/…`, `../Specs/…`, or the repo
   root, so every link resolves after the move.
4. **Stale filename repair** — the five pre-existing shorthand filenames listed above were replaced
   with the real plan filenames, and the labels were aligned to the targets.
5. **Rule update** — `.roo/rules/general.coding-standards.md` now points at
   `docs/plans/<YYYY-MM-DD--HH-ii-ss>-<short-plan-description>-plan.md` (the `_` date/time separator
   was normalised to `--` to match every real filename), and `.roo/rules/instructions.md` gained an
   explicit statement that plans go to `docs/plans/` while `docs/history/` holds only change
   summaries.
6. **Historical note** — `docs/plans/2026-09-21--16-46-20-documentation-structure-plan.md` carries a
   "superseded 2026-10-19" marker so its old `docs/history/` plan-storage decision cannot be
   mistaken for current policy.

## 4. Verification

- `Get-ChildItem docs/history -Filter '*-plan.md'` → 0.
- `Get-ChildItem docs/plans -Filter '*.md'` → 36.
- A markdown-link check over `docs/`, `.roo/`, `deploy/`, `scripts/`, `apps/`, `packages/`, `infra/`
  reports **no broken plan-related link** introduced by the migration. The only two remaining
  hits are pre-existing and unrelated: `docs/03-implementation-general.md → Plans/05-b2b-merge.md`
  (placeholder for a document that was never written) and an untracked file under `docs/temp/`.

## 5. Notes

- `docs/history/` entries were **not** rewritten beyond their plan link targets/labels — no
  narrative text was changed, so the historical record stays intact.
- The throw-away helper scripts (`scripts/tmp-*.py`) were deleted after the run; nothing was added
  to the repository that needs maintenance.
