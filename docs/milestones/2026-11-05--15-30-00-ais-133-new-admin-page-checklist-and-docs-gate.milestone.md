# One "new admin page" checklist, enforced by `quality:docs`

**Date:** 2026-11-05 · **Ticket:** AIS-133 (parent AIS-129) · **Kind:** documentation consolidation + new quality gate

## Problem / feature

The recipe for building a new admin page lived in **four** places — the rule file's §12, the
`UI-Architecture.md` §6 recipe, the `Admin-Data-Flow.md` §3 "new resource template" and the state plan
in `UI-Architecture.md` §5 — and two of them disagreed about the file-level steps. The cross-references
had already rotted (`§12` was cited for a recipe that lives in `§6`), so a reader followed a wrong
pointer without noticing.

## Measured data / evidence

| Metric | Value |
| --- | --- |
| Before | 4 partial recipes; 0 machine checks on documentation |
| Gate's first run on the repo | **45 violations** (26 real after the two scope fixes below) |
| Documents missing `**Utolsó frissítés:**` | 6 |
| Links pointing at renamed or archived files | 10 |
| `pnpm test:quality` after the change | 69 tests, 0 failures (24 of them new) |
| `pnpm quality` after the change | 5 gates, 0 violations each |

## Root cause / design rationale

The drift was structural, not careless: nothing could fail when a document cited a section that no
longer existed. The chosen design puts the **process** in one normative file
(`docs/Specs/New-Admin-Page.md`) and keeps the other three as pointers, then makes drift mechanical.

Four decisions worth preserving:

1. **The gate must be syntactic.** It resolves links and section numbers; it does not judge whether a
   reference is semantically the right one. A gate that guessed would be wrong often enough to be
   ignored, and an ignored gate is worse than none.
2. **Fenced code blocks are stripped before parsing.** The checklist contains example links and the
   runbooks contain `# 2.7.1 …` comments inside shell blocks; without stripping, both produce phantom
   findings. The stripper tracks the fence character and its length, so a ``` inside a ```` example
   cannot close the outer block.
3. **R1 accepts directories.** `../../infra/postgres/init/` is a legitimate link target; using
   "readable as text" as the existence probe flagged six valid links on the first run.
4. **R2 has a document scope.** It checks the five documents of this process (the checklist,
   `UI-Architecture`, `Admin-Data-Flow`, `Forms-and-Validation`, `API-Convention`). The legacy
   operational runbooks number their sections in prose and in code comments; holding them to the rule
   in v1 would have forced a rewrite of documents this ticket does not own.

Rejected: extending `Admin-Data-Flow.md` only (the split between contract-side and UI-side is exactly
what broke), and a `console.warn`-based convention without a gate (nobody runs it).

## Solution / implementation

| File | Change |
| --- | --- |
| `docs/Specs/New-Admin-Page.md` | **new** normative checklist: §1 decisions, §2 the ordered 0–15 work table, §3 do-not, §4 done signal + gate scope, §5 pointers |
| `.roo/rules/react.coding-standards.md` | §12 → pointer + four non-negotiables, no step list |
| `docs/Specs/UI-Architecture.md` | §6 → pointer, stale §12 sentence removed, §9 lists the fifth gate, header updated |
| `docs/Specs/Admin-Data-Flow.md` | §3.1–3.5 → pointer, flows §3.6–3.7 kept, two wrong `§12` refs fixed, header updated |
| `scripts/quality/docs-gate.const.mjs` | scope, pointers, patterns, rule names |
| `scripts/quality/docs-gate.logic.mjs` | pure R1–R4 rules, fence stripper, link/section parsers |
| `scripts/quality/docs-gate.mjs` | CLI (`runDocsGate`, `isEntryPoint`, `exitWith`) |
| `scripts/quality/docs-gate.test.mjs` | 24 tests: one fixture per rule, all parsing edges, exit contract |
| `scripts/quality/fixtures/docs/**` | positive tree + one negative tree per rule |
| `package.json`, `.github/workflows/ci.yml` | `quality:docs` script, appended to `quality`, one new CI step (**job name unchanged**) |
| 6 Specs docs | `**Utolsó frissítés:**` header added, content untouched |
| `Caddy-Reverse-Proxy.md`, `Production-Runbook.md`, `Functional-Specification.md`, `API-Convention.md` | broken links repointed to the real files |

## Outcome and how to verify

```bash
pnpm quality:docs        # OK quality:docs: 0 violations
pnpm test:quality        # 69 tests, includes the 24 docs-gate tests
pnpm quality             # layers → dead-code → tokens → field-errors → docs
```

Manual proof of the "single source" claim: on a throwaway branch, follow §2 of
`docs/Specs/New-Admin-Page.md` from 0 to 15 for a dummy resource without opening another document.
Every point where a second file is needed is a checklist defect. AIS-135 automates this walk.

## Follow-ups

* **AIS-135** builds the `pnpm new-resource` scaffold from this checklist — it must not start before
  the checklist is stable.
* R2 could be extended to the runbooks once their pseudo-sections (`# 2.7.1 …` comments inside code
  blocks) are promoted to real headings.
* `prettier --check` is not part of `qa:all` and the existing Specs are not prettier-clean; if it is
  ever enforced, a formatting-only pass across `docs/Specs` is required first.
