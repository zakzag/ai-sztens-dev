# AIS-133 — one "new admin page" checklist plus the `quality:docs` gate

**Date:** 2026-11-05 15:30 · **Parent:** AIS-129 · **Type:** `docs` + `chore(quality)`

## What was asked

A developer (or an agent) should be able to build a new admin page from **one**
file-name-level, layer-ordered checklist, and the documentation drift that caused the
three-and-a-half overlapping recipes must fail the build instead of being noticed by luck.

## New truth source

[`docs/Specs/New-Admin-Page.md`](../../docs/Specs/New-Admin-Page.md) — header block, §1 the five
pre-code decisions (state bucket, "no store is a decision", `useAppForm`, no new dependency,
naming), §2 the ordered 0–15 work table (contract → `endpoint.registry` → shared tests →
api-client → `service.registry` → api → drizzle → api tests → features → entities → pages →
optional store → route-registry → **nav: no work** → MSW → state-plan row), §3 the do-not list,
§4 the done signal and what the gate does / does not check, §5 pointer table.

## The old sources became pointers

| File | Change |
| --- | --- |
| `.roo/rules/react.coding-standards.md` §12 | 10-step list replaced by a pointer + the four non-negotiables |
| `docs/Specs/UI-Architecture.md` §6 | 9-step recipe replaced by a pointer; the stale "rule file's §12 in repo terms" line removed; §5 stays the state plan; §9 documents the fifth gate |
| `docs/Specs/Admin-Data-Flow.md` §3.1–3.5 | collapsed into a pointer; the **flows** §3.6 and §3.7 stay; the two wrong `§12` references fixed |

## New gate

`pnpm quality:docs` → `scripts/quality/docs-gate.{const,logic,mjs}` + `docs-gate.test.mjs` +
`fixtures/docs/{positive,negative/**}`. Same shape as the other gates: constants, pure logic,
CLI through `report.mjs`'s `exitWith`, `node --test` fixtures.

| Rule | Red when |
| --- | --- |
| R1 `link-resolves` | a relative link in `docs/Specs` points at a path that does not exist (files **and** directories count; `:line` and `#anchor` are stripped) |
| R2 `section-exists` | a `§N` on a line that links a document names a heading that document (or the current one) does not have |
| R3 `last-updated-header` | a `docs/Specs` document lacks `**Utolsó frissítés:** YYYY-MM-DD` |
| R4 `checklist-pointer` | a pointer source (rule §12, `UI-Architecture.md` §6, `Admin-Data-Flow.md` §3) stops linking the checklist |

Deliberate v1 limits, documented in the checklist itself: the gate is syntax-only (it does not judge
whether a reference is semantically the right section), a bare `§N` without a link on its line is not
checked, and R2 applies to the five documents of this process (the legacy runbooks keep their own
numbering).

Wiring: `"quality:docs"` in `package.json`, appended to the `quality` chain (so `qa:all` inherits it),
and one new step in the `quality-gates` CI job — **the job name was not changed**, because it is a
required status check.

## Drift the gate found on its first run

First run: **45 violations**. After adding directory support to R1 and scoping R2, 26 remained and all
were genuine:

* 6 documents had no `**Utolsó frissítés:**` header (Docker cheatsheet/playbook, Functional
  Specification, Kick-off, Local Development, Three-Env Verification) — headers added, content untouched.
* 10 links pointed at renamed artefacts (`2026-09-28-caddy-…` → `2026-09-28--13-35-06-caddy-…`,
  `2026-09-28-api-healthcheck-fail` → `2026-09-29--00-34-49-…`,
  `…--00-50-00-deploy-yml-deep-audit…` → `…--00-58-12-…`) and at docs that moved to
  `outdated/` (`01-callback-assistant.md`, `01-Brainstorming.md`).
* `API-Convention.md` linked `features/api-keys/api-keys.logic.ts`, which lives under `pages/`.
* `New-Admin-Page.md` §1 row 4 mixed a UI-Architecture `§7` with a rules `§6.4` on one line; the rules
  link is now on the line too, so both references resolve.

## Verification

```text
pnpm quality        → layers OK, knip OK, tokens OK, field-errors OK, docs OK (0 violations)
pnpm test:quality   → 69 tests passed (includes the 24 docs-gate tests)
node scripts/quality/docs-gate.mjs → OK quality:docs: 0 violations
```

Negative proof: each of R1–R4 fails on its own fixture tree (`fixtures/docs/negative/**`), and the
positive tree stays green — including the archived `docs/Specs/outdated/`, which is never scanned.

## Notes

* Agent artefacts were regenerated (`generate.mjs --agent copilot|cursor|claude`) because the rule file
  changed; the generated files are gitignored.
* `prettier --check` is not part of `qa:all`, and the existing Specs are not prettier-clean; only the
  files created here were formatted.
