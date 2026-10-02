# 2026-09-25 — Deploy workflow SPA build fix

## Problem

`.github/workflows/deploy.yml` was authored before the
three-subdomain routing change (see
[`docs/history/2026-09-25-three-subdomain-routing-impl.md`](docs/history/2026-09-25-three-subdomain-routing-impl.md:1)).
After the Caddy config and
[`infra/docker-compose.yml`](infra/docker-compose.yml:79) were updated to
mount `${WEB_DIST_PATH:-../apps/web/dist}:/srv/web:ro` and
`${ADMIN_DIST_PATH:-../apps/admin/dist}:/srv/admin:ro` on the Caddy
container, the workflow's bulk upload (step 3) **excludes** `dist` for
safety (so no stale SPA artefacts leak). The result: when the GitHub
Action deploys, the two new Caddy volume mounts bind to
non-existent directories on the droplet, and the `web.aisztens.hu` /
`admin.aisztens.hu` subdomains return `ERR_FILE_NOT_FOUND` / 404.

The smoke test in step 7 does not probe the SPA subdomains (it only
hits the API), so this regression would not fail the workflow — the
deploy would "succeed" while leaving two production subdomains broken.

## Fix

Added four new steps to
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:115)
between the env-file upload (old step 4) and `docker compose up`
(old step 5):

| # | Step | What it does |
|---|---|---|
| 4b | `Setup pnpm` ([`deploy.yml:119-122`](.github/workflows/deploy.yml:119)) | Installs pnpm 10 via corepack, same version as `ci.yml` |
|   | `Setup Node.js` ([`deploy.yml:124-128`](.github/workflows/deploy.yml:124)) | Node 22 + pnpm-store cache |
| 4c | `Build web and admin SPAs` ([`deploy.yml:137-150`](.github/workflows/deploy.yml:137)) | `pnpm install --frozen-lockfile`, reads `DOMAIN` from the rendered `infra/.env`, then `VITE_API_BASE_URL=https://api.${domain}/api pnpm --filter @callback/{web,admin} build`. Mirrors `deploy/deploy.sh::build_spas()` |
| 4d | `Upload SPA dist folders to droplet` ([`deploy.yml:159-169`](.github/workflows/deploy.yml:159)) | `appleboy/scp-action` with `source: "apps/web/dist/,apps/admin/dist/"`, `target: /opt/aisztens/apps`, `rm: true`, `strip_components: 1` so each `dist/*` lands at `/opt/aisztens/apps/{web,admin}/dist/*` on the droplet |

The header comment at the top of the file was updated to reflect the
new 8-step flow.

## Why this is safe

- **DOMAIN comes from the rendered `infra/.env`** (step 2), so the SPA
  bundle and the Caddyfile on the droplet always agree — they are
  derived from the same source of truth.
- **`pnpm install --frozen-lockfile`** matches what `ci.yml` runs, so
  any lockfile mismatches would have already failed CI.
- **`rm: true` + `strip_components: 1` on the SCP** ensures stale
  asset hashes from a previous build get cleaned up; otherwise old
  chunks could pile up in `/opt/aisztens/apps/{web,admin}/dist/`.
- **No new secrets.** The DOMAIN is already available because step 2
  renders `infra/.env` from `secrets.INFRA_ENV`.

## What you (the user) still need to verify before triggering

The workflow cannot deploy correctly if the prerequisites in the
file header (lines 14-18) are not in place. From a local terminal:

```bash
# 1. The deployer user + key exist on the droplet (created by bootstrap.sh):
ssh deployer@ssh.aisztens.hu 'docker ps && echo OK'

# 2. All three secrets are configured in GitHub
#    (Settings → Secrets and variables → Actions):
#    DROPLET_HOST, DROPLET_SSH_KEY, INFRA_ENV
#
# 3. INFRA_ENV matches your updated infra/.env, especially:
#       DOMAIN=aisztens.hu
#       CORS_ORIGINS=https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu
#
#    If INFRA_ENV still has the old DOMAIN=ssh.aisztens.hu, the workflow
#    will build SPAs against VITE_API_BASE_URL=https://api.ssh.aisztens.hu/api
#    while Caddy serves aisztens.hu — CORS will block the SPAs.
```

## Open follow-ups (not in this change)

- **`monitor` container `Restarting (255)`** — still deferred, see
  [`docs/history/2026-09-25-caddyfile-env-substitution-fix.md`](docs/history/2026-09-25-caddyfile-env-substitution-fix.md:1).
- **Production environment reviewer gate** — the workflow declares
  `environment: production`, which would let you require manual
  approval before deploys in
  Settings → Environments → production → Required reviewers. Currently
  unset, so any push to `dev` (or a manual `workflow_dispatch`) deploys
  immediately.
- **`actions/checkout` shallow clone** — for a single-droplet deploy
  the full history isn't needed; switching to `fetch-depth: 1` would
  speed up the checkout slightly. Cosmetic.