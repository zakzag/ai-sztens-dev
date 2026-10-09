# `scripts/README.md` — single source of truth for the helper scripts

**Date:** 2026-10-07 13:41 (Europe/Budapest)
**Related milestone:** [`../milestones/2026-10-07--13-41-00-scripts-readme-single-source-of-truth.milestone.md`](../milestones/2026-10-07--13-41-00-scripts-readme-single-source-of-truth.milestone.md)

## What was done

The repo had no central documentation for the `scripts/` folder: three sub-folders had their
own READMEs, the root scripts only had inline headers, and several `docs/` pages restated a
script's interface (subcommands, flags, layout) inline — so they could drift.

1. **New [`scripts/README.md`](../../scripts/README.md)** — the single source of truth: a layout
   tree, one section per root script ([`dev-stack.sh`](../../scripts/dev-stack.sh) /
   [`dev-stack.ps1`](../../scripts/dev-stack.ps1), [`init.sh`](../../scripts/init.sh) /
   [`init.ps1`](../../scripts/init.ps1), [`test-syntax.ps1`](../../scripts/test-syntax.ps1)),
   a table linking the three sub-folder READMEs
   ([`test/`](../../scripts/test/README.md), [`env-test/`](../../scripts/env-test/README.md),
   [`ssh/`](../../scripts/ssh/README.md)), the conventions (bash-first, LF, no exec bit,
   Windows invocation) and a documentation rule.
2. **Current docs now point at it** instead of describing the scripts inline. Scope agreed with
   the requester: current docs only; `docs/history/`, `docs/milestones/` and `docs/prompts/`
   are historical and were left untouched.

## Files changed

| File | Change |
|---|---|
| [`scripts/README.md`](../../scripts/README.md) | **New.** Index of every script and folder; links the sub-folder READMEs; documents the conventions and the "link don't restate" rule. |
| [`docs/03-implementation-general.md`](../../docs/03-implementation-general.md) | §9 Testing: the stack-smoke row and the closing paragraph now link to `scripts/README.md`. |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md) | §2 lost the duplicated subcommand table / pre-flight / compose invocation (now a pointer); the env-override description stays. §6 see-also gained the scripts index. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | The automated-smoke note, the `local`-target note, §7 smoke section and the §9.1 file list now point at `scripts/README.md` instead of `scripts/test/lib/10-services.sh` / `scripts/test/README.md`. |
| [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md) | §1i and §3.7 reference `scripts/README.md`; §9 see-also lists the scripts index. Operational commands (they are the point of this doc) were kept. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | The three `dev-stack.sh` mentions now point at `scripts/README.md`; the duplicated compose invocation was removed. |
| [`docs/snapshot-2026-10-01.md`](../../docs/snapshot-2026-10-01.md) | §2.8 bullet, §2.9, §2.11, §2.13 rows and §4 intro replaced the script descriptions with pointers. |
| [`README.md`](../../README.md) | The "Useful scripts" table gained a single row pointing at `scripts/README.md`; the env-validation line likewise. |
| [`deploy/README.md`](../../deploy/README.md) | The GitHub-Actions step list and §9 ("Local development in WSL") now point at `scripts/README.md`. |

## Style rule applied

- **Operational command** → kept (e.g. `scripts/dev-stack.sh up`, `bash scripts/test/stack-smoke.sh`):
  they are the document's own instructions.
- **Script description / interface / internals** → replaced with a link to
  [`scripts/README.md`](../../scripts/README.md) (or the matching sub-folder README).

## Verification

```
# every in-scope doc either invokes a script or links to scripts/README.md
search docs/Specs, docs/03-implementation-general.md, docs/snapshot-2026-10-01.md,
       README.md, deploy/README.md  for  "scripts/"
# → only command invocations, git-log expected output (Three-Env §1a) and
#   scripts/README.md pointers remain
```

No code changed; the two script test suites were unaffected.

## Follow-ups

- When a script is added/renamed/removed, update [`scripts/README.md`](../../scripts/README.md)
  and the matching sub-folder README — this is now the documented rule.
- The historical mentions in `docs/history/`, `docs/milestones/` and `docs/prompts/` were
  intentionally **not** rewritten.
