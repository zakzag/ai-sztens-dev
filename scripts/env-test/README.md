# .env test suite

Two checkers that validate the repository's `.env` files. They are
**separate from** [`scripts/test/`](../test/README.md), which runs the
docker-compose stack smoke tests.

- [`check-env-syntax.sh`](check-env-syntax.sh:1) — **offline** syntax and
  consistency checks. No network, safe in CI.
- [`check-env-live.sh`](check-env-live.sh:1) — **live** access checks that
  log into the dev droplet using the real credentials. Run explicitly.

## Quick start

```bash
# 1. Always safe: validate structure/keys/placeholders (no network).
bash scripts/env-test/check-env-syntax.sh

# 2. Explicit: prove the merged credentials actually work (needs network).
bash scripts/env-test/check-env-live.sh            # real run
bash scripts/env-test/check-env-live.sh --dry-run  # print commands only
```

On Windows (PowerShell), use the wrappers so the current console is reused:

```powershell
pwsh scripts/env-test/check-env-syntax.ps1
pwsh scripts/env-test/check-env-live.ps1 --dry-run
```

## `check-env-syntax.sh` — offline

| Check | What it verifies |
|---|---|
| key/value syntax | every non-comment line is `KEY=value` (no spaces around `=`) |
| duplicates | no key is defined twice in the same file |
| bash sourcing | the file loads cleanly via `set -a; . file` |
| CRLF | warns when a file has Windows line endings (bash may keep a stray `\r`) |
| required keys | each real per-env file has its mandatory keys |
| placeholders | real dev files (`deploy/.env.dev`, `infra/.env.dev`) contain no `change-me` / `replace-with` / `<...>` values |
| cross-file | `apps/{web,admin}/.env.dev` `VITE_API_BASE_URL` == `https://api.<DOMAIN>/api` from `infra/.env.dev` |

The files it inspects (missing ones are reported as `SKIP`):

```text
deploy/.env.local  deploy/.env.dev  deploy/.env.prod
infra/.env.local   infra/.env.dev   infra/.env.prod
apps/api/.env.{local,dev,prod}
apps/web/.env.{local,dev,prod}
apps/admin/.env.{local,dev,prod}
deploy/.env.example  infra/.env.example  apps/*/.env.example
```

Exit codes: `0` pass, `1` at least one failure, `2` usage error.

> When you add a new per-env file or a new required key, register it in
> `check-env-syntax.sh` (the file list and the `check_required` calls).

## `check-env-live.sh` — live

Reads `deploy/.env.dev` (SSH target) and `infra/.env.dev` (domain, DB,
secrets) without exporting the values, then:

| Check | What it verifies |
|---|---|
| static readiness | `HOST`/`DOMAIN` set, VAPI secret not a placeholder, CORS excludes `api.<DOMAIN>`, `SUDO_USERS` includes `deployer`, the four `deploy/ssh-keys/*.pub` files exist |
| SSH | `ssh -o BatchMode=yes` login to `SSH_USER@HOST` (using `SSH_KEY` when set) |
| Postgres | `pg_isready` plus a `pg_roles` query (`aisztens`, `tkovari`, `krak`) over the SSH channel |
| HTTPS | `https://web.<DOMAIN>`, `https://admin.<DOMAIN>`, `https://api.<DOMAIN>` return `200` |

Prerequisites: `ssh` and `curl` on `PATH`, plus network access to the
droplet. Secrets are never printed — only key names and non-secret values.

Flags: `--dry-run` (print commands, execute nothing), `--help`.
Exit codes: `0` pass, `1` at least one failure, `2` usage / missing tool.

## Design notes

- The offline checker is the gate: it must stay green on any machine.
- The live checker is opt-in by design — running it hits the real droplet.
- Both scripts resolve the repo root relative to their own location, so they
  can be launched from any working directory.
- Both are `bash`-native; the `.ps1` wrappers only locate a POSIX bash and
  forward arguments/exit codes (same approach as
  [`deploy/deploy.ps1`](../../deploy/deploy.ps1:1)).
