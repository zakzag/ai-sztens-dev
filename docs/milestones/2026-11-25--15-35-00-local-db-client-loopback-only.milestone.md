# Local database client — declarative Adminer, loopback-only ports

**Date:** 2026-11-25
**Ticket:** [AIS-192](https://zakzag.atlassian.net/browse/AIS-192) — `feat(infra): local DB client (pnpm db:psql + Adminer) and loopback-only local DB ports`
**Related:** [`../history/2026-11-25--15-35-00-local-db-client-psql-and-adminer.md`](../history/2026-11-25--15-35-00-local-db-client-psql-and-adminer.md)

## 1. Problem / feature

Developers can only reach the local Postgres through a long `docker compose … exec` incantation, and
there is no way to browse tables, constraints or rows. The question was where the client should live —
a new image, the Postgres image itself, or the Windows host — with the constraint that the setup must
be **easy to replicate on another machine**.

## 2. Measured data / evidence

| Observation                                      | Value                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `psql` already in the running container          | `psql (PostgreSQL) 16.15`                                                          |
| unix-socket auth inside the container            | `current_user = aisztens`, `inet_server_addr() IS NULL` = `t`                      |
| host port before the change                      | `0.0.0.0:5432->5432/tcp` (LAN-reachable)                                           |
| host port after the change                       | `127.0.0.1:5432->5432/tcp`                                                         |
| Adminer after `pnpm db:gui`                      | `127.0.0.1:8081->8080/tcp`, HTTP `200`, `gethostbyname('postgres')` → `172.19.0.2` |
| data across the Postgres recreate                | 9 migrations, 5 `api_keys` rows — unchanged                                        |
| `db:up` while Adminer ran, tools file not merged | `warning: Found orphan containers (infra-adminer-1)`                               |

## 3. Design rationale

- **Client inside the Postgres image — rejected.** `psql` is already there, so the only thing a custom
  image would add is maintenance: the droplet deploy contract pulls `postgres:16-alpine` as-is
  (`infra/docker-compose.yml`), the droplet never builds, and every upstream Postgres bump would become
  our rebuild. It also gives no GUI and enlarges the attack surface of the most sensitive container.
- **Client on the Windows host — rejected as the answer, kept as an option.** DBeaver/pgAdmin/DataGrip
  are per-machine installs with per-machine connection profiles; they are not in git, so the next
  machine starts from zero. That is exactly the replication problem being solved.
- **Separate client container — chosen.** What is replicable is not the binary but the _definition_.
  Adminer runs from its own compose file, so `pnpm db:gui` replaces "install + configure" everywhere.
  pgAdmin was the alternative; it is several times larger and keeps saved servers in a volume, i.e.
  per-developer state we do not want in the repo.
- **Loopback-only.** Both local stacks published `0.0.0.0:5432` with the placeholder passwords from
  `infra/.env.example`, contradicting `Docker-Debug-Playbook.md` §2.8 ("NEVER use `0.0.0.0:5432`").
  Adding a browser UI made the fix mandatory rather than optional.

## 4. Solution / implementation

| File                                                            | Change                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/docker-compose.tools.yml`                                | **new** — `adminer:4`, `profiles: ['tools']`, `127.0.0.1:8081`, `mem_limit: 128m`; header documents the three rules and the login values |
| `package.json`                                                  | `db:psql`, `db:gui`, `db:gui:down` added; `db:up`/`db:down` merge the tools file (kills the orphan warning, teardown stays symmetric)    |
| `infra/docker-compose.db.yml`, `infra/docker-compose.local.yml` | `5432` → `127.0.0.1:5432`                                                                                                                |
| `docs/Specs/Database-Local.md`                                  | §1, §5, §7 rewritten; **§7.1** Adminer, **§7.2** host client; §11 triggers                                                               |
| `docs/Specs/Local-Development.md`                               | §2, §2b.2, §6.2 follow the new port binding and the two commands                                                                         |

The safety of the new file rests on three independent facts: no deploy path globs `infra/*.yml` (all
name `infra/docker-compose.yml` explicitly), the service sits behind a profile a plain `up` never
requests, and the port is bound to `127.0.0.1`.

## 5. Outcome and how to verify

```bash
pnpm db:up                                # Postgres
pnpm db:gui                               # Adminer on http://localhost:8081
pnpm db:psql                              # psql -U aisztens -d aisztens_db
docker ps --filter name=infra-            # expect 127.0.0.1 for both ports
docker compose --env-file infra/.env.local \
  -f infra/docker-compose.db.yml -f infra/docker-compose.tools.yml \
  --profile tools config | grep host_ip   # expect 127.0.0.1 twice
pnpm quality:docs                         # spec links and headers resolve
```

Login at <http://localhost:8081>: system `PostgreSQL`, server `postgres`, user `aisztens`, password from
`infra/.env.local`, database `aisztens_db`.

## 6. Follow-ups

- The GUI is wired to the DB-only stack only; for `scripts/dev-stack.sh up` the database sits on the
  `internal` network and the `exec` one-liner in `Database-Local.md` §7 remains the path.
- `adminer:4` is a rolling major tag (like `caddy:2-alpine`); pin an exact `4.8.x` if its UI shifts.
- Adding `crystaldba/postgres-mcp` to the same tools file is the natural next step if agents should
  query the database directly.
