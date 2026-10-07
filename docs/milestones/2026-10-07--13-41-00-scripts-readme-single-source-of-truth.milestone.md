# Milestone — `scripts/README.md` as the single source of truth for helper scripts

**Date:** 2026-10-07
**History:** [`../history/2026-10-07--13-41-00-scripts-readme-single-source-of-truth.md`](../history/2026-10-07--13-41-00-scripts-readme-single-source-of-truth.md)

## 1. Problem / feature

The `scripts/` folder had no central documentation. Three sub-folders carried their own
READMEs, the root scripts only had inline headers, and several current docs (`docs/Specs/*`,
`docs/03-implementation-general.md`, `docs/snapshot-2026-10-01.md`, `README.md`,
`deploy/README.md`) restated a script's interface — subcommands, flags, layout, internals —
inline. Those copies could silently drift from the scripts.

## 2. Measured data / evidence

Inventory before the change (script references outside `docs/history/`):

| Document | What it restated |
|---|---|
| `docs/Specs/Local-Development.md` §2 | the full `dev-stack.sh` subcommand table, pre-flight checks and compose invocation |
| `docs/Specs/Three-Env-Verification.md` §3.7 | smoke-suite internals (`scripts/test/lib/10-services.sh`) |
| `docs/Specs/Production-Runbook.md` | smoke-suite internals and a `scripts/test/stack-smoke.sh` file-list entry |
| `docs/snapshot-2026-10-01.md` §2.9/§2.11/§2.13 | the smoke checks and the SSH helper script list |
| `README.md` / `deploy/README.md` | the local-stack helper and the env-check commands |

## 3. Root cause / design rationale

Each doc that *used* a script also *documented* it, so there was no single owner of the
"what does this script do" text. Options considered: (a) leave the duplication; (b) put the
interface in every doc; (c) designate one index and have the others link to it. **(c)** was
chosen — one file ([`scripts/README.md`](../../scripts/README.md)) owns the interface; the
other docs keep their own narrative and link out. Historical records
(`docs/history/`, `docs/milestones/`, `docs/prompts/`) were deliberately excluded: rewriting
them would falsify the record, not fix drift.

## 4. Solution / implementation

| Changed file | Change |
|---|---|
| [`scripts/README.md`](../../scripts/README.md) | **New.** Layout tree, per-script sections (`dev-stack.sh/.ps1`, `init.sh/.ps1`, `test-syntax.ps1`), a table linking the `test/`, `env-test/` and `ssh/` sub-folder READMEs, the conventions and the documentation rule. |
| [`docs/03-implementation-general.md`](../../docs/03-implementation-general.md) | §9 Testing links the index. |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md) | §2 duplication replaced by a pointer; §6 see-also extended. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | Smoke internals and the §9.1 file list point at the index. |
| [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md) | §1i / §3.7 / §9 point at the index (operational commands kept). |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | `dev-stack.sh` mentions point at the index; duplicated compose invocation removed. |
| [`docs/snapshot-2026-10-01.md`](../../docs/snapshot-2026-10-01.md) | §2.8/§2.9/§2.11/§2.13 replaced by pointers. |
| [`README.md`](../../README.md) | One "Useful scripts" row → the index. |
| [`deploy/README.md`](../../deploy/README.md) | Actions step list and §9 → the index. |

Rule applied: keep operational command invocations; replace script *descriptions* with links.

## 5. Outcome and how to verify

[`scripts/README.md`](../../scripts/README.md) is now the one place that explains every script
and folder. Verify with a search across the current docs — no script *description* should
remain outside the `scripts/` READMEs:

```bash
# Expect: only command invocations, the git-log expected output in
# Three-Env §1a, and links to scripts/README.md
grep -rn "scripts/" docs/Specs docs/03-implementation-general.md \
  docs/snapshot-2026-10-01.md README.md deploy/README.md
```

No code changed, so `bash scripts/env-test/check-env-syntax.sh` and `bash scripts/test/stack-smoke.sh`
are unaffected.

## 6. Follow-ups

- Keep [`scripts/README.md`](../../scripts/README.md) and the sub-folder READMEs in sync when a
  script is added, renamed or removed.
- The historical mentions in `docs/history/`, `docs/milestones/` and `docs/prompts/` remain
  as-is by design.
