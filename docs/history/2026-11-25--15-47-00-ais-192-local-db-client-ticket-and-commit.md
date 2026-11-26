# AIS-192 — Jira record and commit for the local DB client

**Date:** 2026-11-25 15:47 (Europe/Budapest)
**Ticket:** [AIS-192](https://zakzag.atlassian.net/browse/AIS-192) — `feat(infra): local DB client (pnpm db:psql + Adminer) and loopback-only local DB ports`
**Type:** process + documentation — the code itself landed in the previous commit, this session only
records it in Jira and in the plan/history/milestone headers.

## Starting point

The local DB client work (new [`infra/docker-compose.tools.yml`](../../infra/docker-compose.tools.yml),
`db:psql` / `db:gui` / `db:gui:down`, loopback-only Postgres ports, two updated specs) was already in the
working tree, written in a parallel session, but it had **no Jira ticket**. The tree at that moment also
held an unrelated, in-progress change set: the **AIS-21** customer edit page (`use-update-customer*`
hooks, `CustomerEditPage`, `CustomerStatusDialog`, `CustomerDetailHeaderActions`,
`docs/Specs/Customers-Admin-Screens.md`, `docs/Specs/UI-Architecture.md`).

## What was done

| Step                      | Result                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket created            | **AIS-192** (`Task`, `Medium`, labels `infra` `docker` `tooling` `local-dev`) — description carries decisions D1–D4, the safety rules of the tools file, the file table, the risk table and the verification plan |
| Change recorded in Jira   | comment `10836` — actual diff per file, the new commands, the measured verification output, the implementation notes and the follow-ups                                                                           |
| Docs linked to the ticket | a `**Ticket:** [AIS-192](…)` header line added to the plan, the history entry and the milestone (the convention every other tracked doc in `docs/` follows)                                                       |
| Commit                    | `9decf76` — `AIS-192: feat(infra): add local DB client and loopback-only ports`, 9 files, +458 / −66                                                                                                              |
| Commit recorded in Jira   | comment `10837` — `git show --stat` output plus the gates that were checked and the explicit scope note about AIS-21                                                                                              |
| AIS-21 left alone         | its 12 new files and 11 modifications stayed unstaged; nothing of it is in `9decf76`                                                                                                                              |

## Why the ticket was created after the fact

The parallel session produced a plan, a history entry and a milestone but no ticket — the repository
convention is that every change is reachable from Jira through the commit title
(`<KEY>: <type>(<scope>): <summary>`). Without a key the commit would have been an unlinkable
`feat(infra): …`. Creating the ticket first and then committing keeps the chain
`ticket → plan → docs → commit → comment` intact, which is the order the rules assume.

## Verification

- `pnpm quality:docs` → `OK quality:docs: 0 violations`
- `pnpm exec prettier --check` on the 9 committed files → `All matched files use Prettier code style!`
- `git show --stat 9decf76` → exactly the 9 intended files, no `apps/admin/**` path, no
  `infra/docker-compose.yml` (the droplet stack)

## Follow-ups

- AIS-192 stayed in `To Do`; the status transition is left to the reviewer.
- The AIS-21 change set still needs its own commit on the same branch.
