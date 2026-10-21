# Milestone: plan documents consolidated into `docs/plans/`

**Date:** 2026-10-19 21:57 (Europe/Budapest) · **Author:** code mode (Zoo)
**Narrative:** [`docs/history/2026-10-19--21-56-30-docs-plans-migration.md`](../history/2026-10-19--21-56-30-docs-plans-migration.md)
**Type:** documentation-governance refactor touching ~45 files and both AI rule files

## 1. Problem / feature

Plans and change summaries were stored in the same folder (`docs/history/`), because the governing
rule said so: `.roo/rules/general.coding-standards.md` → "Planning Artifacts" →
`docs/history/<date>-<name>-plan.md`. A partially executed manual migration already copied 15 plans
to `docs/plans/`, which produced a three-way inconsistency: files duplicated across folders, link
labels saying `docs/history/…` while targets pointed at `../plans/…`, and references to shorthand
plan filenames that never existed.

## 2. Measured data / evidence

| Measurement | Value |
|---|---|
| Plans in `docs/plans/` before | 15 |
| Plans still in `docs/history/` before | 21 |
| Plans in `docs/history/` after | 0 |
| Plans in `docs/plans/` after | 36 |
| Markdown files rewritten | 41 |
| Broken plan links after migration | 0 (only 2 pre-existing, unrelated hits remain) |
| Same-filename duplicates (history vs plans) | 0 |

Stale filenames found and repaired (they never existed in either folder):
`2026-09-28-api-healthcheck-fail-plan.md`, `2026-09-26-container-mem-limits-after-oom-plan.md`,
`2026-09-18-droplet-deploy-infra-plan.md`, `2026-09-21-stack-smoke-tests-plan.md`,
`2026-09-23-github-action-deploy-with-smoke-tests-plan.md`,
`2026-09-25-three-subdomain-routing-plan.md`, `2026-09-28-dual-stack-port-collision-fix-plan.md`,
`2026-09-16-documentation-structure-plan.md`.

## 3. Root cause / design rationale

The rule file was the only source of truth for plan location, but the rule and reality drifted:
someone began migrating plans by hand without updating the rule, so every later session kept
writing new plans to `docs/history/` and copied existing links by hand. Link rot then came from two
independent causes:

- **folder drift** — `../history/<plan>.md` targets after the file moved to `docs/plans/`;
- **shorthand filenames** — authors wrote `2026-09-28-api-healthcheck-fail-plan.md` when the real
  file was `2026-09-29--00-30-10-api-healthcheck-fail-plan.md`.

Alternatives rejected: (a) leaving the old files in `docs/history/` and only changing the rule —
rejected because the user asked for a full migration and duplicates would keep drifting apart;
(b) rewriting narrative text inside history entries — rejected because history is a record and
must not be falsified; only link targets and labels were touched.

## 4. Solution / implementation

| File / group | Change |
|---|---|
| `docs/history/*-plan.md` → `docs/plans/*-plan.md` | 21 files moved with `git mv`; no content change beyond link repair |
| `.roo/rules/general.coding-standards.md` | plan path → `docs/plans/<YYYY-MM-DD--HH-ii-ss>-<plan-description>-plan.md`; added "change summaries stay in `docs/history/`" |
| `.roo/rules/instructions.md` | new bullet: plans live in `docs/plans/`, `docs/history/` holds only change summaries |
| `docs/Specs/{Three-Env-Verification,Local-Development,Infrastructure-Docker,Caddy-Reverse-Proxy,Production-Runbook}.md` | plan links re-pointed to `../plans/…`, labels aligned |
| `docs/milestones/*.milestone.md` (11 files) | `Plan:` lines re-pointed to `../plans/…`; one wrong "Day-to-day narrative" link restored to `../history/…` |
| `docs/history/*.md` (17 files) | bare/short plan links → `../plans/<real-filename>`; labels aligned |
| `docs/plans/*.md` (9 files) | relative links recomputed for the new folder; self-references and sibling-plan links normalised |
| `docs/docker-cheatsheet.md`, `docs/docker-debug-playbook.md`, `docs/snapshot-2026-10-01.md`, `deploy/README.md` | `history/<plan>.md` → `plans/<plan>.md` |
| `docs/plans/2026-09-21--16-46-20-documentation-structure-plan.md` | plan-storage row marked "superseded 2026-10-19" |

## 5. Outcome and how to verify

Outcome: `docs/plans/` is the single location for implementation plans, `docs/history/` holds only
post-implementation narratives, and the rule files enforce it for future sessions.

Verification commands:

```powershell
Get-ChildItem docs/history -Filter '*-plan.md'      # expect: no output (0 files)
Get-ChildItem docs/plans   -Filter '*.md'           # expect: 36 files
Select-String -Path (Get-ChildItem docs -Recurse -Filter *.md).FullName `
  -Pattern 'docs/history/[^ )]*plan[^ )]*\.md'      # expect: only historical prose, no link labels
```

Manual check: open `docs/Specs/Three-Env-Verification.md` §"See also", `docs/milestones/*` "Plan:"
lines and any recent history entry — each plan link opens a file in `docs/plans/`.

## 6. Follow-ups

- `docs/03-implementation-general.md` links to `Plans/05-b2b-merge.md`, a document that was never
  written. Left untouched (unrelated placeholder), but it is a dead link if that plan is ever
  needed.
- `docs/snapshot-2026-10-01.md` still describes the folder inventory as of 2026-10-01 (plan files
  listed under `docs/history/`). It is a dated snapshot by design; no rewrite planned.
- `.aider.chat.history.md` (untracked transcript) still contains old paths — intentionally ignored.
