# 2026-10-27 11:17 — AIS-101: commit title convention ticket for the AI instructions

## Problem

The repository has no written rule for commit titles. The actual history is mixed:

- good: `AIS-36: feat(api, infra): add callback_requests schema and the first migration`
- suffixed: `feat(admin): implement Admin API keys page (AIS-41)`
- neither ticket nor type: `deploy.yml fix`, `deploy`,
  `change hello beautiful world to hello world`, `move plans to plans folder`

Consequences measured on `git log --oneline`:

- `git log --grep=AIS-` misses every commit that carries the key in a suffix
  position or not at all, so the Jira ↔ commit link is assembled by hand.
- Commits without a Conventional Commit type cannot be grouped for release notes.

Because the agents (Zoo Code / Roo Code, and through the generated artefacts
GitHub Copilot, Cursor, Claude Code) receive their instructions from
`.roo/rules/*.md`, a rule that is not written there does not exist for them.

## Decision

Recorded in the ticket (AIS-101), not implemented here — this chat only produced
the ticket.

| # | Decision |
| --- | --- |
| D1 | The rule lives in the global `.roo/rules/instructions.md` (new `# Git commit üzenetek` section), not in per-mode `customInstructions` in `.roomodes` — `.roo/rules/*.md` is the only authored source (`docs/Specs/AI-Agent-Artifacts.md` §7). |
| D2 | The Jira key is a **prefix**, not a suffix: `AIS-42: feat(admin): add API keys page`, so `git log --grep=AIS-42` works and the type survives. |
| D3 | Without a ticket the title starts with a Conventional Commit type (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `style`, `revert`) — the vocabulary the history already uses — not literal `feature:` / `bugfix:`. |
| D4 | Key resolution chain: the ticket handled in the session → the key found in the branch name (`[A-Z][A-Z0-9]{1,9}-\d+`) → no key. Inventing a key is forbidden. |
| D5 | Instructions only. No commitlint config, no husky hook, no CI commit-title gate in this ticket — separate follow-up. |
| D6 | Generated artefacts stay gitignored; after the source edit run `scripts/init.ps1` / `scripts/init.sh` (or `node scripts/lib/agent-artifacts/generate.mjs --agent <copilot\|cursor\|claude>`), and only `.roo/rules/instructions.md` is committed. |
| D7 | The rule applies to PR titles and squash-merge titles too, otherwise the key is lost on `main`. |
| D8 | No milestone: the decisions live in the ticket; a `docs/history/` entry is still required. |

Format that the rule must mandate:

```text
<KEY>: <type>(<scope>): <summary>     # ticket exists
<type>(<scope>): <summary>            # no ticket
```

`<summary>` is imperative, English, no trailing period, whole title ≤ 72 chars;
`!` before the colon marks a breaking change.

## Ticket

- [`AIS-101`](https://zakzag.atlassian.net/browse/AIS-101) — type `Task`,
  project `AIS`, status `To Do`, priority `Medium`,
  labels `ai-instructions`, `git`, `process`, `tooling`.
- Description (Hungarian, matching the project style) carries the format table,
  good/bad examples, D1–D8, the task list, the DoD checklist and the
  verification commands.

## Verification of this chat's output

```bash
# the ticket exists and is a Task with the expected labels
# (Jira: https://zakzag.atlassian.net/browse/AIS-101)
```

Ticket-level verification once the rule is implemented:

```bash
rg -n "^# Git commit üzenetek" .roo/rules/instructions.md
node scripts/lib/agent-artifacts/generate.mjs --agent copilot --check
node scripts/lib/agent-artifacts/generate.mjs --agent cursor --check
node scripts/lib/agent-artifacts/generate.mjs --agent claude --check
pnpm test:agents
git log --oneline -5
```

## Follow-ups

- `commitlint` + a CI job that rejects non-conforming commit / PR titles (D5).
- Rewriting older commits is explicitly out of scope; the convention starts with
  the commit that introduces the rule.
