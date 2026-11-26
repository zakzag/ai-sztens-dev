# Local database client — plan

**Date:** 2026-11-25
**Ticket:** [AIS-192](https://zakzag.atlassian.net/browse/AIS-192) — `feat(infra): local DB client (pnpm db:psql + Adminer) and loopback-only local DB ports`
**Status:** implemented (see
[`../history/2026-11-25--15-35-00-local-db-client-psql-and-adminer.md`](../history/2026-11-25--15-35-00-local-db-client-psql-and-adminer.md)
and [`../milestones/2026-11-25--15-35-00-local-db-client-loopback-only.milestone.md`](../milestones/2026-11-25--15-35-00-local-db-client-loopback-only.milestone.md))

## Question

A Postgres runs in a container (`infra-postgres-1`, `postgres:16-alpine`, host port 5432). How do we
add a client that lets us **look into the database**, in a way that can be **replicated on another
machine with minimal effort**? Three candidates were on the table:

1. build a new image and run it in a second container,
2. put the client into the Postgres image itself,
3. install a client on the Windows host.

## Decisions

### D1 — Not into the Postgres image

The official `postgres:16-alpine` image **already ships `psql` 16.15**, reachable over the unix socket
with `trust` auth, so the CLI costs nothing to add. A custom image would:

- break the image-based deploy contract ([`infra/docker-compose.yml`](../../infra/docker-compose.yml)
  pulls `postgres:16-alpine` as-is; the droplet never builds),
- move Postgres upgrades onto us (rebuild + republish on every upstream tag),
- still not provide a GUI,
- enlarge the attack surface of the most sensitive container.

**Rejected.**

### D2 — Yes to a separate, _declarative_ client container

The replicable part is not the binary, it is the **definition**. A compose file in git turns "install
and configure a client on every machine" into `pnpm db:gui`. Constraints:

- it lives in its **own** file ([`infra/docker-compose.tools.yml`](../../infra/docker-compose.tools.yml))
  so it cannot be dragged into the droplet stack by a merge,
- it sits behind `profiles: ['tools']` so a plain `up` never starts it,
- the published port is `127.0.0.1` only,
- no credentials in the file — Adminer reads them from the login form.

Image: `adminer:4` (single container, ~90 MB, speaks Postgres, no state, no volume). pgAdmin was the
alternative but it is several times larger and needs its own volume for saved servers, which is
per-developer state we do not want in the repo.

### D3 — A Windows client stays a personal, undocumented-in-CI option

DBeaver / pgAdmin / DataGrip work against `127.0.0.1:5432` and are the best tools for heavy work, but
they are per-machine installs with per-machine configuration. They are documented as optional (§7.2 of
[`Database-Local.md`](../Specs/Database-Local.md)) and are explicitly **not** the replication answer.

### D4 — Tighten both local stacks to loopback

Both local compose files published `0.0.0.0:5432`, i.e. the developer database was reachable from the
LAN with the placeholder passwords from `infra/.env.example`. This contradicts [`Docker-Debug-Playbook.md`](../Specs/Docker-Debug-Playbook.md) §2.8, which already says
"NEVER use `0.0.0.0:5432`". The new client is one more reason to fix it in the same change.

## Steps

1. `infra/docker-compose.tools.yml` — Adminer, `tools` profile, `127.0.0.1:8081`, `mem_limit: 128m`.
2. `package.json` — `db:psql`, `db:gui`, `db:gui:down`; `db:up` / `db:down` merge the tools file so
   the compose project model is complete (otherwise a running Adminer shows up as an orphan).
3. `infra/docker-compose.db.yml` + `infra/docker-compose.local.yml` — `127.0.0.1:5432:5432`.
4. Docs: `Database-Local.md` §1, §5, §7 (+ §7.1 Adminer, §7.2 host client), §11;
   `Local-Development.md` §2, §2b, §6.2; header dates.
5. History + milestone.

## Risks and how they are handled

| Risk                                        | Handling                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The tools file leaks into the droplet stack | no deploy path globs `infra/*.yml`; every one names `infra/docker-compose.yml`; plus the `tools` profile |
| Adminer reachable from the LAN              | `127.0.0.1` binding only                                                                                 |
| Secrets in git                              | the compose file holds none; passwords stay in `infra/.env.local`                                        |
| Orphan-container warning on `db:up`         | the tools file is merged into `db:up` / `db:down`                                                        |
| Recreating Postgres destroys data           | data lives in the `pgdata_local` volume; `up -d` recreates the container only                            |

## Verification plan

Compose render, container start, HTTP 200 on the login page, DNS resolution of `postgres` from inside
Adminer, `pnpm db:psql` round-trip, `docker ps` showing loopback bindings, row counts unchanged after
the Postgres recreate, `pnpm quality:docs` green, Prettier clean.
