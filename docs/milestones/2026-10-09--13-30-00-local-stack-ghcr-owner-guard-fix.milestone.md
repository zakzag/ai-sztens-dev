# 2026-10-09 — Local stack `GHCR_OWNER` `:?` guard fix

## 1. Problem

A fresh `pwsh scripts/dev-stack.ps1 up` from a clean Windows / WSL2
checkout failed with a misleading message. First attempt:

```
[dev-stack] "docker compose" v2 is required (the plugin, not the legacy docker-compose binary).
```

Re-running revealed the real error:

```
error while interpolating services.api.image: required variable GHCR_OWNER is missing a value: Set GHCR_OWNER in infra/.env (e.g. <github-org>)
```

`infra/.env.example` does not define `GHCR_OWNER` for `local`, and the
local override does not pre-set it.

## 2. Measured data / evidence

- `docker compose version` from inside the Debian WSL distro:
  `Docker Compose version v5.5.1` — v2 plugin present, so the first
  error message was a red herring (likely a transient WSL↔Docker bridge
  hiccup on cold Docker Desktop start).
- `wsl.exe --cd ... bash scripts/dev-stack.sh up` reproduced the
  `GHCR_OWNER` error directly, with no `docker compose version` failure.
- The base compose [`infra/docker-compose.yml:29`](../../infra/docker-compose.yml:29)
  used `${GHCR_OWNER:?…}` and `${IMAGE_TAG:?…}` — the abort form
  (`:??`).
- After the fix, `pwsh scripts/dev-stack.ps1 up` reached the `NAME`
  interpolation step and started building all four application images
  in parallel. The `monitor` image (Alpine-based) completed; the
  api/web/admin builds progressed past base-image extract before a
  **separate, host-level** buildkit wedge stopped progress.

## 3. Root cause

`infra/docker-compose.yml` used the `:?` abort form for `GHCR_OWNER`
and `IMAGE_TAG`. The local override (`docker-compose.local.yml`)
replaces the `image:` directive with a `build:` + `aisztens-local/...`
reference, but **Docker Compose interpolates the base file's
`image:` first**, so the `:?` abort fires *before* the override is
consulted. A developer who has never used the droplet and only wants
the local stack has no GitHub org to set, and the existing comment in
`infra/.env.example:107` ("local — leave empty; scripts/dev-stack.sh
merges docker-compose.local.yml which sets local image names") was
factually wrong about the order of operations.

The deploy path was already protected by the
`images.yml`+`deploy.yml` chain: every deploy writes `GHCR_OWNER` and
`IMAGE_TAG` to the droplet's `infra/.env` before `up`, so the
`:?` guard was redundant for prod/dev and harmful for local.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml) | All four `image:` lines now use `${VAR:-default}` (defaults: `ghcr.io`, `local`, `latest`); a comment above the `api` line documents why the looser form is safe in prod/dev (deploy workflow always sets the values) and necessary for local (the override replaces `image:`). |
| [`infra/.env.example`](../../infra/.env.example) | The `GHCR_OWNER=` comment block (lines 105–114) now describes the new base-compose default + local-override behaviour accurately, instead of the old incorrect "leave empty" claim. |

## 5. Outcome and how to verify

1. From a fresh clone, `pwsh scripts/dev-stack.ps1 up` now reaches the
   `NAME` interpolation step and starts building the four application
   images in parallel (no `:?` abort).
2. After the build, `docker compose ps` lists `aisztens-postgres-1`,
   `aisztens-api-1`, etc., all `Up`; `curl http://localhost:3000/healthz`
   returns 200.
3. The deploy path is unchanged: the `images.yml` workflow still
   writes `GHCR_OWNER` and `IMAGE_TAG` to the droplet's `infra/.env`
   on every push, so the droplet always pins the intended image.

## 6. Follow-ups

- A **separate, host-level issue** surfaced during verification:
  Docker Desktop's `default` buildkit builder wedged mid-build on the
  developer's machine (no `node`/`pnpm`/`buildkit` processes alive,
  but buildx still reported `running`). The user has been left with a
  fresh `local` builder (docker-container driver, buildkit v0.33.1).
  A Docker Desktop restart is the standard remediation if the next
  `dev-stack up` still hangs at base-image extract.
- The droplet should be re-deployed once to confirm the `${VAR:-default}`
  form does not regress the prod path (expected to be a no-op because
  the deploy workflow writes the values anyway).
