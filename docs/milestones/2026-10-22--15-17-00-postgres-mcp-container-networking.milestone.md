# Postgres MCP server could not reach the local database

**Date:** 2026-10-22 15:17 (Europe/Budapest)
**Area:** developer tooling / local database access

## Problem / feature

The `postgres` MCP server configured in the global Zoo Code MCP settings never
connected to the local Postgres instance. The working credentials from
[`infra/.env.local`](../../infra/.env.local:76) were assumed to be the problem, but
no `postgres` MCP tools were available in the editor at all.

## Measured data / evidence

| Check                                             | Result                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| MCP DSN vs `infra/.env.local`                     | identical (`aisztens` / `aisztens.l238!`) → credentials not the issue |
| `docker ps`                                       | `infra-postgres-1` `Up 12 hours (healthy)`, `0.0.0.0:5432->5432/tcp`  |
| `psql` in container → `localhost:5432`            | `Connection refused` (`::1`, then `127.0.0.1`)                        |
| `psql` in container → `host.docker.internal:5432` | success — `current_user = aisztens`, `db = aisztens_db`               |
| `docker pull mcp/postgres`                        | `pull access denied … repository does not exist`                      |

## Root cause

1. **Nonexistent image.** `mcp/postgres` is not published on Docker Hub, so
   `docker run` failed before any connection attempt.
2. **Container-local `localhost`.** The DSN pointed at `localhost:5432`, but the
   MCP server executes _inside_ a container: `localhost` is that container's own
   loopback, not the Docker host that publishes 5432.
3. **Wrong DSN channel.** The chosen image (`crystaldba/postgres-mcp`) reads the
   DSN from `DATABASE_URI`, so a positional argument is ignored.

## Solution / implementation

No repository code changed. The validated replacement for the `postgres` entry in
the global `mcp_settings.json`:

```json
"postgres": {
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "--add-host=host.docker.internal:host-gateway",
    "-e", "DATABASE_URI=postgres://aisztens:aisztens.l238!@host.docker.internal:5432/aisztens_db",
    "crystaldba/postgres-mcp:latest",
    "--access-mode=restricted"
  ]
}
```

| Change                                            | Reason                                                  |
| ------------------------------------------------- | ------------------------------------------------------- |
| `mcp/postgres` → `crystaldba/postgres-mcp:latest` | original image does not exist                           |
| `localhost` → `host.docker.internal`              | reach the host-published port from inside the container |
| `--add-host=host.docker.internal:host-gateway`    | portable to native Linux hosts                          |
| DSN into `-e DATABASE_URI=`                       | image's documented configuration channel                |
| `--access-mode=restricted`                        | read-only default for DB inspection                     |

Docs added: this milestone and
[`docs/history/2026-10-22--15-17-00-postgres-mcp-server-container-networking-fix.md`](../history/2026-10-22--15-17-00-postgres-mcp-server-container-networking-fix.md).

## Outcome and how to verify

`initialize` + `tools/list` over stdio returned
`Successfully connected to database and initialized connection pool` and nine
tools (`list_schemas`, `list_objects`, `get_object_details`, `explain_query`,
`analyze_workload_indexes`, `analyze_query_indexes`, `analyze_db_health`,
`get_top_queries`, `execute_sql`).

To re-verify after pasting the block:

```bash
docker ps --filter name=postgres            # DB must be up on 5432
docker manifest inspect crystaldba/postgres-mcp:latest   # image must exist
```

Then reload MCP servers in the editor and call `list_schemas`; it must return the
application schemas (not a connection error).

## Follow-ups

- Prefer `--access-mode=unrestricted` only when write access to the local DB is
  genuinely needed.
- If the DSN ever becomes inconvenient to inline, move it to a per-machine env
  file and keep only `DATABASE_URI` in the MCP settings.
- `docker run … -i` keeps the container alive while stdin is open; a probe run
  left over must be removed with `docker rm -f` (done in this session).
