# Env merge (old clone → current repo) and a new `.env` test suite

**Date:** 2026-10-07 12:57 (Europe/Budapest)
**Related plan:** [`2026-10-07-env-merge-old-new-and-env-tests-plan.md`](2026-10-07-env-merge-old-new-and-env-tests-plan.md)
**Related milestone:** [`../milestones/2026-10-07--12-57-00-env-merge-and-env-test-suite.milestone.md`](../milestones/2026-10-07--12-57-00-env-merge-and-env-test-suite.milestone.md)

## What was done

Two local clones of the same repository existed:

- `e:\projects\AI\2026-08-31-ai-sztens-dev-old\` — an older checkout whose
  single-env `.env` files held valid credentials, plus the four user SSH
  public keys.
- `e:\projects\AI\2026-08-31-ai-sztens-dev\` (this repo) — the newer
  three-env layout (`.env.local` / `.env.dev` / `.env.prod`), but with a few
  stale headers and a missing `deployer` in `SUDO_USERS`.

The new structure was taken as the source of truth; the old values were only
imported where they filled a genuine gap. Every discrepancy was reviewed and
decided individually before implementation.

### Env files merged

| File | Change |
|---|---|
| [`deploy/.env.dev`](../../deploy/.env.dev:1) | `SUDO_USERS` restored to `tkovari,krak,deployer`; the stale "ACTION REQUIRED: set HOST" seed banner replaced with a dev-target header. `SSH_KEY` kept as the repo-local `./deploy/ssh-keys/root.private.key`. |
| [`infra/.env.dev`](../../infra/.env.dev:1) | Data already correct (including the new 2-origin `CORS_ORIGINS` = web + admin); only the stale "Copy to `infra/.env`" header was rewritten for the per-env layout. |
| [`apps/*`](../../apps/) | No old-repo data existed (the old admin app was Angular). Left as-is; the placeholder `VAPI_WEBHOOK_SECRET` in `apps/api/.env.dev` stays because the real secret is injected by compose from `infra/.env.dev`. |

### Decisions on the discrepancies

1. `CORS_ORIGINS` — keep the new value (`web` + `admin`); do **not** re-add
   `https://api.aisztens.hu` (documented in [`Three-Env-Verification.md`](../Specs/Three-Env-Verification.md:298)).
2. `SSH_KEY` — keep the repo-local path.
3. `SUDO_USERS` — restore `deployer` (matches [`bootstrap.sh`](../../deploy/bootstrap.sh:1)
   and [`deploy/README.md`](../../deploy/README.md:100)).
4. `apps/api/.env.dev` VAPI secret — keep the placeholder.
5. SSH public keys — copy all four.
6. `deploy/.env.prod`, `infra/.env.prod`, `infra/.env.local` — leave
   dormant / auto-seeded.

### SSH public keys

Copied from the old clone into [`deploy/ssh-keys/`](../../deploy/ssh-keys/README.md:1):
`tkovari.pub`, `krak.pub`, `aisztens.pub`, `deployer.pub`.

### New test suite — `scripts/env-test/`

Kept separate from the stack smoke suite in [`scripts/test/`](../../scripts/test/README.md:1):

- [`check-env-syntax.sh`](../../scripts/env-test/check-env-syntax.sh:1) —
  offline: key/value syntax, duplicate keys, bash sourcing, CRLF warning,
  required keys, placeholder scan, and the SPA↔infra URL cross-check.
- [`check-env-live.sh`](../../scripts/env-test/check-env-live.sh:1) —
  explicit: SSH login, Postgres reachability + roles, HTTPS for
  api/web/admin, VAPI secret non-placeholder, CORS/api-host rule,
  `SUDO_USERS` includes `deployer`, pub-keys present.
- [`check-env-syntax.ps1`](../../scripts/env-test/check-env-syntax.ps1:1),
  [`check-env-live.ps1`](../../scripts/env-test/check-env-live.ps1:1) —
  Windows wrappers (Git Bash / MSYS2 discovery, same pattern as
  [`deploy/deploy.ps1`](../../deploy/deploy.ps1:111)).
- [`README.md`](../../scripts/env-test/README.md:1) — usage, checks, exit codes.

### Documentation drift fixed

- [`deploy/README.md`](../../deploy/README.md:1) — `deploy/.env` / `infra/.env`
  references updated to the per-env names.
- [`scripts/test/README.md`](../../scripts/test/README.md:1) — per-env names,
  `--env-file infra/.env.local` guidance, and a link to the new suite.
- [`README.md`](../../README.md:36) — env table switched to the per-env layout,
  plus an env-check row.

## Verification

```bash
bash scripts/env-test/check-env-syntax.sh          # offline, always safe
bash scripts/env-test/check-env-live.sh --dry-run  # print live commands
bash scripts/env-test/check-env-live.sh            # real live checks
```

## Follow-ups

- The smoke suite's default env file is still `infra/.env`
  ([`00-prelude.sh`](../../scripts/test/lib/00-prelude.sh:54)); consider
  defaulting to `infra/.env.local` when present.
- `deploy/.env.prod` and `infra/.env.prod` remain dormant until a prod
  droplet is provisioned.
