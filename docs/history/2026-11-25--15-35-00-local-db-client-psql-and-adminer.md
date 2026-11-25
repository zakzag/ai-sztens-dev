# Local DB client — `pnpm db:psql` + `pnpm db:gui` (Adminer), loopback-only local ports

**Date:** 2026-11-25
**Ticket:** [AIS-192](https://zakzag.atlassian.net/browse/AIS-192) — `feat(infra): local DB client (pnpm db:psql + Adminer) and loopback-only local DB ports`
**Plan:** [`../plans/2026-11-25--15-35-00-local-db-client-plan.md`](../plans/2026-11-25--15-35-00-local-db-client-plan.md)
**Milestone:** [`../milestones/2026-11-25--15-35-00-local-db-client-loopback-only.milestone.md`](../milestones/2026-11-25--15-35-00-local-db-client-loopback-only.milestone.md)

## What changed

Looking into the local database is now one command in either mode: `pnpm db:psql` in the terminal and
`pnpm db:gui` in the browser (<http://localhost:8081>, Adminer). Neither is baked into the Postgres
image — the terminal client was already there (`psql` 16.15 inside `postgres:16-alpine`), and the
browser client is a separate, optional, developer-only container described by a compose file that is
part of the repo. That is what makes the setup replicable: a fresh machine needs `pnpm db:up` +
`pnpm db:gui`, not a client installation and a hand-configured connection profile.

In the same change both local stacks stopped publishing Postgres on `0.0.0.0` — the developer database
is now reachable on `127.0.0.1:5432` only, which is what
[`Docker-Debug-Playbook.md`](../Specs/Docker-Debug-Playbook.md) §2.8 already demanded.

## Files

| File                                                                     | Change                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`infra/docker-compose.tools.yml`](../../infra/docker-compose.tools.yml) | **new** — `adminer:4`, `profiles: ['tools']`, `127.0.0.1:8081:8080`, `mem_limit: 128m`, `ADMINER_DEFAULT_SERVER: postgres`; the header states the three rules (never on the droplet, profile-gated, loopback-only) and the login values                   |
| [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml)       | `'5432:5432'` → `'127.0.0.1:5432:5432'` + a comment on why                                                                                                                                                                                                |
| [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml) | same loopback change on the `postgres` override                                                                                                                                                                                                           |
| [`package.json`](../../package.json)                                     | `db:psql`, `db:gui`, `db:gui:down` added; `db:up` / `db:down` now merge `infra/docker-compose.tools.yml` (the `tools` profile is requested by `db:down` and `db:gui` only)                                                                                |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md)             | header, §1 (loopback note), §5 (new commands, full-wipe command), §7 (connection table + DB-only vs full-stack `exec`), **new §7.1** (Adminer: lifecycle, login values, the three rules), **new §7.2** (optional host client), §11 (maintenance triggers) |
| [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md)       | header, §2 (postgres port is loopback-only), §2b.2 (`Bind for 127.0.0.1:5432 failed`), §6.2 (`127.0.0.1:5432->5432/tcp` + the two client commands)                                                                                                        |

No deploy file was touched. `deploy/deploy.sh`, `.github/workflows/deploy.yml` and `scripts/test/*` all
name `infra/docker-compose.yml` explicitly — there is no `infra/*.yml` glob anywhere — so the tools
file cannot reach the droplet.

## Verification (actual output)

```text
docker compose … -f db.yml -f tools.yml --profile tools config
  services: adminer, postgres
  host_ip: 127.0.0.1  target: 8080  published: "8081"
  host_ip: 127.0.0.1  target: 5432  published: "5432"

docker pull adminer:4      -> sha256:c1c24d89d06fcb8fc0fb5a049240dc292ff4a121ae05d7e74d64b58c421d2921

pnpm db:gui
  infra-adminer-1 | Up | 127.0.0.1:8081->8080/tcp
  docker exec infra-adminer-1 php -r 'echo gethostbyname("postgres");'  -> 172.19.0.2
  Invoke-WebRequest http://127.0.0.1:8081                              -> 200

pnpm db:up                       (Postgres recreated with the new binding)
  infra-postgres-1 | Up (healthy) | 127.0.0.1:5432->5432/tcp
  select count(*) from platform.__drizzle_migrations  -> 9 ; api_keys -> 5   (data intact)

"select current_user, current_database();" | pnpm db:psql
  aisztens | aisztens_db

pnpm db:up   (while Adminer runs) -> no "Found orphan containers" warning
pnpm db:down                      -> both containers and the network removed
```

## Notes

- `db:up` merges the tools file even though it never starts Adminer: without it, a running Adminer is
  reported as an orphan container of the `infra` compose project on the next `db:up`.
- Running Prettier on the two touched specs normalized a few **pre-existing** table alignments in
  unrelated sections (`Database-Local.md` §4.1, §4.2, §10) and two `*emphasis*` → `_emphasis_` spells.
  These hunks are whitespace/marker only — no content changed — and they remove drift that
  `pnpm format:check` would have reported anyway.
- `db:gui:down` **stops** Adminer and leaves Postgres running (the common case: you finished browsing,
  the API still needs the database). `pnpm db:down` removes both.
- The `postgres` superuser is deliberately not the documented login: the app role `aisztens` is what
  the application uses, and browsing as superuser hides grant problems.

## Follow-ups

- The GUI is wired to the DB-only stack (`pnpm db:up`). For the full stack
  (`scripts/dev-stack.sh up`) the database lives on the `internal` network; wiring Adminer there would
  mean adding a network alias, which is not worth it while the `exec` one-liner in §7 works.
- `adminer:4` is a rolling major tag, like `caddy:2-alpine` and `postgres:16-alpine`. If its UI ever
  changes under us, pin an exact `4.8.x` tag in the tools file.
- A Postgres MCP server (`crystaldba/postgres-mcp` is already pulled on the dev machine) would be the
  natural next addition to the same tools file if agents should query the database directly.
