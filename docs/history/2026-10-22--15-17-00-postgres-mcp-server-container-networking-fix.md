# 2026-10-22 15:17 — Postgres MCP server could not reach the local database

## Symptom

The `postgres` entry in the global Zoo Code MCP settings
(`c:/Users/zakza/.zoo-code/globalStorage/wecode-ai.zoo-code/settings/mcp_settings.json`)
never connected to the local Postgres instance, even though the same credentials
work from [`infra/.env.local`](../../infra/.env.local:76). No `postgres` MCP tools
appeared in the tool list.

## Investigation

The connection string in the MCP config was compared with the working local env
file — the user/password pair was byte-identical (`aisztens` / `aisztens.l238!`),
so a credential problem was ruled out early.

Runtime facts established with read-only checks:

| Check | Result |
|---|---|
| `docker ps` | `infra-postgres-1` — `Up 12 hours (healthy)`, `0.0.0.0:5432->5432/tcp` |
| `psql` from a container to `localhost:5432` | `Connection refused` (tried `::1` then `127.0.0.1`) |
| `psql` from a container to `host.docker.internal:5432` | Success — `current_user = aisztens`, `current_database = aisztens_db` |
| `docker pull mcp/postgres` | `pull access denied … repository does not exist` |

## Root cause

Two independent defects in the same `postgres` entry:

1. **Wrong image reference.** `mcp/postgres` does not exist on Docker Hub, so the
   container was never started at all.
2. **Wrong network address.** The entry passed the connection string positionally
   to `docker run`, so the MCP process ran *inside a container*, where `localhost`
   resolves to that container — not to the Docker host that publishes port 5432.
   Even with a valid image the connection would have been refused.

A third, latent issue: `crystaldba/postgres-mcp` takes its DSN from the
`DATABASE_URI` environment variable, not as a positional argument.

## Fix (applied by the user, not by the assistant)

The user explicitly asked to keep the global settings file untouched and to paste
the corrected block manually. The validated replacement uses
`crystaldba/postgres-mcp:latest`, passes `DATABASE_URI` via `-e`, targets
`host.docker.internal`, and adds `--add-host=host.docker.internal:host-gateway`
so the same block also works on native Linux hosts.

## Verification performed

An MCP `initialize` + `tools/list` handshake was driven over stdio against the
corrected configuration and returned
`Successfully connected to database and initialized connection pool` plus nine
tools (`list_schemas`, `list_objects`, `get_object_details`, `explain_query`,
`analyze_workload_indexes`, `analyze_query_indexes`, `analyze_db_health`,
`get_top_queries`, `execute_sql`).

Temporary probe artefacts (`.tmp/mcp-probe.jsonl`, the probe container) were
removed afterwards.

## Notes

- `!` in the password is safe: it survives the JSON config and `-e` passing.
  Only an interactive shell with delayed expansion would mangle it.
- `--access-mode=restricted` keeps the server read-only; `unrestricted` enables
  writes. The choice is a security decision left to the operator.
- See also the milestone:
  [`2026-10-22--15-17-00-postgres-mcp-container-networking.milestone.md`](../milestones/2026-10-22--15-17-00-postgres-mcp-container-networking.milestone.md).
