# 2026-11-04 14:27 — AIS-101: commit title convention rule in the AI instructions

## Problem

The repository had no written commit-title rule, and nothing in `.roo/rules/**`
mentioned commits at all (grep for `commit` returned 0 hits). The actual history
was mixed — `AIS-36: feat(api, infra): …` next to `feat(api): … (AIS-107)` and
plain `deploy.yml fix`. Consequences:

- `git log --grep=AIS-` misses every commit that carries the key as a suffix or
  not at all, so the Jira ↔ commit link was assembled by hand.
- Commits without a type cannot be grouped for release notes.
- Agents take their instructions from `.roo/rules/*.md` only, so an unwritten
  rule does not exist for Roo Code / Zoo Code, Copilot, Cursor or Claude Code.

## What changed

| File                                                                                                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.roo/rules/instructions.md`](../../.roo/rules/instructions.md:16)                                                                                   | New `# Git commit üzenetek` section between `# Documentation` and `# Milestones`: the two formats, the constraint table (`<KEY>`, closed `<type>` list, optional multi-scope, imperative ≤ 72-char summary, `!` before the colon), the key-resolution chain, the ban on inventing a key, 3 correct and 5 forbidden examples, and the statement that the rule binds every branch plus PR and squash-merge titles. |
| `docs/plans/2026-11-04--14-19-00-ais-101-git-commit-title-convention-plan.md`                                                                         | The implementation plan for this change.                                                                                                                                                                                                                                                                                                                                                                         |
| [`docs/history/2026-11-04--14-27-00-ais-101-git-commit-title-convention-rule.md`](2026-11-04--14-27-00-ais-101-git-commit-title-convention-rule.md:1) | This entry.                                                                                                                                                                                                                                                                                                                                                                                                      |

Generated artefacts (`.github/copilot-instructions.md`,
`.cursor/rules/project.mdc`, `CLAUDE.md` and the mode files) were regenerated but
stay gitignored — only the authored rule file is committed.

Rule summary:

```text
<KEY>: <type>(<scope>): <summary>     # the work belongs to a Jira ticket
<type>(<scope>): <summary>            # there is no related ticket
```

Key resolution is deterministic: session ticket → `[A-Z][A-Z0-9]{1,9}-\d+` from
the branch name → no key (type-only title). Guessing a key is forbidden.

## Verification

| Command                                                                 | Result                    |
| ----------------------------------------------------------------------- | ------------------------- |
| `rg -n "^# Git commit üzenetek" .roo/rules/instructions.md`             | section found             |
| `node scripts/lib/agent-artifacts/generate.mjs --agent copilot --check` | exit 0                    |
| `node scripts/lib/agent-artifacts/generate.mjs --agent cursor --check`  | exit 0                    |
| `node scripts/lib/agent-artifacts/generate.mjs --agent claude --check`  | exit 0                    |
| `pnpm test:agents`                                                      | 34 tests, 34 pass, 0 fail |

The `--check` runs prove the three agent artefacts are byte-identical to a fresh
render of `.roo/rules/`, so the rule really reaches Copilot, Cursor and Claude
Code. `pnpm test:agents` covers the pipeline contract (rule ordering, header,
idempotent write, `.gitignore` sync, `--check` exit codes).

## Follow-up

- [AIS-127](https://zakzag.atlassian.net/browse/AIS-127) — commitlint config,
  `commit-msg` hook and the PR-title / squash-title CI gate. AIS-101 is
  instruction-only (decision D5); the machine enforcement mirrors this text.
- Rewriting older commit subjects stays out of scope; the convention starts with
  the commit that introduces the rule.
