# 2026-11-03 16:30 — Rewrite of the last 12 commit subjects to the `AIS-###: ` prefix

## Request

Make every commit message of the last 12 commits start with its Jira ticket,
in the form `AIS-114: feat(admin): description`. Only the last 12 commits were
in scope.

## Audit before the rewrite

| # | Old SHA | Old subject | Verdict |
| - | ------- | ----------- | ------- |
| 1 | `3ff54d8` | `AIS-122: fix(admin): copy readonly initialEntries…` | ok |
| 2 | `9d4ead6` | `AIS-122: ci: add the quality-gates job` | ok |
| 3 | `cf35504` | `AIS-122: docs: UI-Architecture section 9…` | ok |
| 4 | `7330b6f` | `feat(api): paginate GET /api/api-keys (AIS-107)` | ticket trailing |
| 5 | `2c281fa` | `chore(repo): require Node >= 24.9 (pin 24.22.2)…` | no ticket at all |
| 6 | `f444027` | `feat(api): PATCH/DELETE mutation convention… (AIS-108)` | ticket trailing |
| 7 | `7c2e8f4` | `fix(api): store timestamps… (AIS-108)` | ticket trailing |
| 8 | `e2129af` | `chore(format): apply prettier to files left unformatted` | ticket only in body ("split out of AIS-109") |
| 9 | `ee7f0a7` | `docs(ais-105): record the re-verified project-state audit delta` | ticket used as scope |
| 10 | `0b1703b` | `feat(api-client): full transport… (AIS-109)` | ticket trailing |
| 11 | `ec0f207` | `AIS-126: fix(tooling): make every test, lint…` | ok |
| 12 | `e4ae36d` | `AIS-114: feat(admin): generic API hook layer…` | ok |

Seven commits were non-conforming. `2c281fa` carried no ticket anywhere in its
message; the owner decided to leave it untouched rather than guess a ticket
(AIS-121 and AIS-107 were both defensible candidates).

## What was done

Six subjects were rewritten, everything else preserved verbatim:

| Old SHA | New SHA | New subject |
| ------- | ------- | ----------- |
| `7330b6f` | `2144830` | `AIS-107: feat(api): paginate GET /api/api-keys` |
| `f444027` | `12bcd9a` | `AIS-108: feat(api): PATCH/DELETE mutation convention with soft delete` |
| `7c2e8f4` | `ac4e679` | `AIS-108: fix(api): store timestamps with millisecond precision so the PATCH token matches` |
| `e2129af` | `16756de` | `AIS-109: chore(format): apply prettier to files left unformatted` |
| `ee7f0a7` | `59be2c3` | `AIS-105: docs: record the re-verified project-state audit delta` |
| `0b1703b` | `bff5629` | `AIS-109: feat(api-client): full transport, query builder and typed request body` |

`2c281fa` → `7cc5bce` (new SHA only because its parent changed, message
untouched).

Trailing `(AIS-###)` suffixes were dropped, and `docs(ais-105)` became
`AIS-105: docs:` — the scope position is reserved for the area of the code.

## Method

A temporary PowerShell helper (written to `.git/`, deleted afterwards) walked
`git rev-list --reverse 3ff54d8^..HEAD` and rebuilt every commit with
`git commit-tree`, copying the tree, the parent chain, and the author plus
committer identity and dates from the original. Only the first line of each
message was replaced, so bodies stayed byte-identical.

`git rebase -i` was rejected because it would have rewritten the committer
dates; `git filter-branch` was rejected because it is deprecated and needs a
shell filter script.

## Verification

- `git diff <old-tip> <new-tip> --stat` → empty, no file content changed.
- `git range-diff 3ff54d8^..<old-tip> 3ff54d8^..HEAD` → six commits marked `!`
  with only the subject line inside the message diff; the other six marked `=`.
- `git log -12 --format='%h %s'` → 11 of 12 subjects start with `AIS-###: `.

## Notes

- No push was needed: all 12 commits were local (`origin/main` was 19 commits
  behind), so no remote history was rewritten.
- The pre-rewrite tip `e4ae36d` stays reachable through the reflog for a while;
  `git reset --hard e4ae36d` restores the old history.
- Two unrelated untracked files stayed untouched: `.roo/rules/window-shell.md`
  and `docs/history/2026-11-03--01-47-00-ais-87-story-closed-and-ais-125-created.md`.
