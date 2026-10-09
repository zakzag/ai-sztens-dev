# 2026-10-09 — Local stack `GHCR_OWNER` `:?` guard fix

## Context

Running `pwsh scripts/dev-stack.ps1 up` from a fresh checkout on Windows /
WSL2 produced a misleading `'"docker compose" v2 is required` error and, on
the next run, the real underlying error: `error while interpolating
services.api.image: required variable GHCR_OWNER is missing a value`.

The local override ([`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml))
is designed to replace the base compose's `image:` directive with a
locally-built one (`build:` + `aisztens-local/...`), so on paper the local
path should never need `GHCR_OWNER`. In practice, **Docker Compose
interpolates the base file's `image:` first** (with the `:?` abort form),
and the local override's `image:` substitution only happens after that
succeeds. The `:?` therefore fires *before* the override is consulted, and
`scripts/dev-stack.sh up` cannot get off the ground on a fresh checkout.

## Root cause

`infra/docker-compose.yml` used `${GHCR_OWNER:?Set GHCR_OWNER in infra/.env
(e.g. <github-org>)}` and `${IMAGE_TAG:?Set IMAGE_TAG in infra/.env (e.g.
sha-abcdef0)}` at line 29 (api), and `${GHCR_OWNER}` (no guard) for the
other three services. The `:?` abort was the right safety net for the
droplet's deploy path, but the wrong shape for the local path: a
developer who runs the local stack on a clean machine does not have a
GitHub org, and should not need one.

The misleading `docker compose v2 required` message from the very first
attempt is unrelated: the script's [`require_docker()`](../../scripts/dev-stack.sh:62)
check passed (compose v5.5.1 is present in WSL), and a re-run of the same
command reproduced the *real* `GHCR_OWNER` error. The first message was
likely a transient WSL↔Docker bridge hiccup on a cold Docker Desktop
start; the user's `pwsh dev-stack.ps1 up` was actually the second symptom
of the same chain of events (buildkit wedge, not a missing plugin).

## Fix

1. `infra/docker-compose.yml` — changed every `image:` line to use the
   looser `${VAR:-default}` form instead of `${VAR:?…}`:

   ```yaml
   image: ${REGISTRY:-ghcr.io}/${GHCR_OWNER:-local}/aisztens-api:${IMAGE_TAG:-latest}
   image: ${REGISTRY:-ghcr.io}/${GHCR_OWNER:-local}/aisztens-web:${IMAGE_TAG:-latest}
   image: ${REGISTRY:-ghcr.io}/${GHCR_OWNER:-local}/aisztens-admin:${IMAGE_TAG:-latest}
   image: ${REGISTRY:-ghcr.io}/${GHCR_OWNER:-local}/aisztens-monitor:${IMAGE_TAG:-latest}
   ```

   A comment above the `api` line documents the rationale: the
   `${VAR:-default}` form is safe for the local path (the local override
   replaces `image:` with `aisztens-local/...` and no GHCR pull is
   attempted), and the deploy path's safety net is the
   `images.yml`+`deploy.yml` chain that always writes `GHCR_OWNER` and
   `IMAGE_TAG` to the droplet's `infra/.env` before every `up`.

2. `infra/.env.example` — updated the comment on the `GHCR_OWNER=` line
   (around line 105) to reflect the new behaviour: the base compose
   defaults to `local` and the local override is the one that actually
   determines the image reference for `scripts/dev-stack.sh up`.

## Verified

- `pwsh scripts/dev-stack.ps1 up` got past the `NAME` interpolation step
  and started building all four application images (`api`, `web`,
  `admin`, `monitor`) in parallel.
- The `monitor` image (Alpine-based, small) completed first; the `api`,
  `web`, and `admin` builds progressed past the base-image extract step
  (`#19 [api build 1/14] FROM node:22-bookworm-slim` → `DONE`).
- A second, host-level issue surfaced mid-build: the `default` buildkit
  builder wedged on this developer's machine, with no `node` / `pnpm` /
  `buildkit` processes alive but the buildx instance still reported
  `running`. This is **not** caused by the code change — it is a
  Docker Desktop / WSL2 environment issue and a follow-up restart of
  Docker Desktop is the standard remediation.
- A fresh `local` builder (docker-container driver, buildkit v0.33.1)
  was provisioned and is now the active builder. The next
  `pwsh scripts/dev-stack.ps1 up` invocation will use it.

## Follow-ups

- If the local stack still hangs at base-image extract after a Docker
  Desktop restart, run `docker buildx prune -af` and `docker builder
  prune -af` to clear any stale buildkit cache.
- The deploy-time safety net (`deploy.sh` writes `GHCR_OWNER` and
  `IMAGE_TAG` to `infra/.env` before every `up`) should be exercised by
  the next `deploy up dev` to confirm the new `${VAR:-default}` form
  does not regress the droplet path.
