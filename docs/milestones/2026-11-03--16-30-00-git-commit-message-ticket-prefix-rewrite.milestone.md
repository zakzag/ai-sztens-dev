# Git commit subjects rewritten to the `AIS-###: ` prefix

## Problem / feature

Commit subjects in the repository had three different shapes: the ticket as a
prefix (`AIS-122: ci: …`), the ticket as a trailing suffix (`feat(api): …
(AIS-108)`), and no ticket at all. That makes Jira linkage, changelog
generation and history search unreliable — the ticket is not in a predictable
position, and `git log --grep='AIS-108'` misses half the work. The last 12
commits were normalised so that every message starts with its ticket.

## Measured data / evidence

Audit of the last 12 commits before the change:

| Shape | Count | Example |
| ----- | ----- | ------- |
| `AIS-###: ` prefix | 5 | `AIS-122: ci: add the quality-gates job` |
| ticket as trailing suffix | 4 | `feat(api): paginate GET /api/api-keys (AIS-107)` |
| ticket as conventional-commit scope | 1 | `docs(ais-105): record the … audit delta` |
| ticket only in the body | 1 | `chore(format): apply prettier …` (body: "split out of AIS-109") |
| no ticket anywhere | 1 | `chore(repo): require Node >= 24.9 …` |

## Root cause / design rationale

The convention was never enforced, and the hooks/quality gates only check code,
not commit messages. Commits were written in whatever shape the author had in
mind at the time, so drift accumulated.

Decisions taken:

| Decision | Rationale |
| -------- | --------- |
| Ticket first, then `type(scope): subject` | A fixed prefix position is what `--grep`, Jira smart commits and changelog tooling can rely on. `type(scope)` alone cannot carry the ticket without abusing the scope slot. |
| Drop the trailing `(AIS-###)` | After the prefix it is pure duplication. |
| `docs(ais-105)` → `AIS-105: docs:` | The scope position describes the area of code, not the ticket. |
| Leave `2c281fa` untouched | It names no ticket. Prefixed with AIS-121 or AIS-107 would both be plausible but unverifiable, and a wrong ticket in history is worse than a missing one. |
| Rewrite locally only | All 12 commits were unpushed (`origin/main` 19 behind), so no shared history was altered and no force-push is implied. |
| Preserve committer dates | `git rebase -i` would have stamped every commit with "now". A `git commit-tree` walk that copies tree, parents, author and committer identity plus both dates changes the messages and nothing else. |

## Solution / implementation

- `.git/rewrite-commit-subjects.ps1` (temporary, deleted after use) — walked
  `3ff54d8^..HEAD` and rebuilt each commit via `git commit-tree`, replacing
  only the first line of the six mapped messages.
- `main` was moved with `git reset --hard` from `e4ae36d` to the new tip
  `ba7e94a`.
- `docs/history/2026-11-03--16-30-00-git-commit-message-ticket-prefix-rewrite.md` —
  audit table, old → new SHA map and verification steps.
- No tracked file changed: the diff between the old and the new tip is empty.

Rewritten subjects: `7330b6f`→`2144830` (AIS-107), `f444027`→`12bcd9a` and
`7c2e8f4`→`ac4e679` (AIS-108), `e2129af`→`16756de` and `0b1703b`→`bff5629`
(AIS-109), `ee7f0a7`→`59be2c3` (AIS-105).

## Outcome and how to verify

Current state: 11 of the last 12 subjects start with `AIS-###: `; the single
exception is `7cc5bce` (formerly `2c281fa`), intentionally left as it was.

```powershell
git --no-pager log -12 --format='%h %s'
# every line except 7cc5bce must match ^<sha> AIS-[0-9]+: 

git --no-pager diff 3ff54d8^..HEAD --stat   # informational: unchanged content
git diff e4ae36d HEAD --stat                # empty: no file content changed

# message-only proof (old tip still in the reflog)
git --no-pager range-diff '3ff54d8^..e4ae36d' '3ff54d8^..HEAD'
```

Rollback while the reflog retains it: `git reset --hard e4ae36d`.

## Follow-ups

- Enforce the convention mechanically, e.g. a `commit-msg` hook validating
  `^[A-Z]+-[0-9]+: (feat|fix|chore|docs|style|refactor|test|ci|build|perf)(\(.+\))?: .+`,
  otherwise the drift will return on the first commit written in a hurry.
- Decide a ticket for `7cc5bce` if the Node >= 24.9 pin ever needs Jira
  traceability; the message currently names none.
