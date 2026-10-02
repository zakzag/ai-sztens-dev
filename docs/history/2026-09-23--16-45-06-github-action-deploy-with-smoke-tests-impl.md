# Implementation: GitHub Action deploy + post-deploy smoke tests

- Date: 2026-09-23
- Status: Done
- Plan: [`2026-09-23-github-action-deploy-with-smoke-tests-plan.md`](2026-09-23-github-action-deploy-with-smoke-tests-plan.md)

## Summary

Wired the existing droplet deploy pipeline ([`deploy/bootstrap.sh`](../../deploy/bootstrap.sh),
[`deploy/deploy.sh`](../../deploy/deploy.sh)) and the existing CI-friendly
smoke suite ([`scripts/test/stack-smoke.sh`](../../scripts/test/stack-smoke.sh))
to GitHub Actions. The Action is a thin orchestrator: it reuses the same
files a human operator uses, so there is no parallel CI test suite and no
behavioural drift between manual and automatic deploys.

## Files added

| File | Purpose |
|---|---|
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | On push to `dev` (and `workflow_dispatch`): renders `infra/.env` from the `INFRA_ENV` secret, SCPs the repo to the droplet as `deployer`, runs `docker compose up -d --build`, waits for `api=healthy`, then runs `scripts/test/stack-smoke.sh` against the live stack. On failure, dumps the last 500 log lines of every container into the workflow run. |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | PR-time workflow: `pnpm install --frozen-lockfile`, `pnpm -r build`, `pnpm -r lint`, `pnpm --filter @callback/api test`. Runs on PRs into `main`/`dev` and on pushes to `dev`. Concurrency cancels stale runs so PR authors get fast feedback. |
| `docs/history/2026-09-23-github-action-deploy-with-smoke-tests-plan.md` | Plan document for this change. |
| `docs/history/2026-09-23-github-action-deploy-with-smoke-tests-impl.md` | This file. |

## Files modified

- [`deploy/README.md`](../../deploy/README.md) — appended a new
  **§8 GitHub Actions deploy** section that documents the secrets
  (`DROPLET_HOST`, `DROPLET_SSH_KEY`, `INFRA_ENV`), explains what the
  workflow does, and lists limitations. Renumbered the WSL section to §9.

## Files intentionally NOT modified

- `deploy/bootstrap.sh`, `deploy/deploy.sh` — already correct, reused as-is.
- `infra/docker-compose.yml`, `infra/.env.example` — no changes needed;
  the smoke script's API check uses the same `node -e fetch(...)`
  command compose uses as a healthcheck (per design note in
  `scripts/test/README.md`).
- `scripts/test/stack-smoke.sh`, `scripts/test/lib/*` — already
  CI-friendly (TTY-aware, exit-coded, no interactive prompts in the
  default flow). The Action invokes them verbatim.
- `.github/workflows/codeql.yml` — separate concern; untouched.

## Required user actions (one-time, human)

Per [`deploy/README.md` §8.1](../../deploy/README.md) and the plan:

1. Confirm the droplet has been bootstrapped with the `deployer` user:
   - `./deploy/deploy.sh bootstrap` was run from the local machine
     against `HOST=<ipv4>` and `SSH_USER=root`.
   - `deploy/.env` now has `SSH_USER=deployer`.
   - `ssh deployer@<droplet-ip> 'docker --version'` succeeds.
2. Add three GitHub repository secrets (Settings → Secrets and variables
   → Actions):
   - `DROPLET_HOST` — droplet public IPv4 / hostname.
   - `DROPLET_SSH_KEY` — the private key matching
     `deploy/ssh-keys/deployer.pub`.
   - `INFRA_ENV` — the full contents of `infra/.env`
     (`DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`,
     `AISZTENS_DB_PASSWORD`, `TKOVARI_DB_PASSWORD`, `KRAK_DB_PASSWORD`,
     `VAPI_WEBHOOK_SECRET`, `CORS_ORIGINS`, `MONITOR_ALERT_WEBHOOK_URL`,
     ...). Multi-line; copied verbatim on every run.

## Verification done

- The two new workflow files were parsed locally with a YAML parser
  without syntax errors (see shell log).
- Spot-checked that the workflow references real, committed files:
  - `infra/docker-compose.yml` — yes, exists.
  - `scripts/test/stack-smoke.sh` — yes, exists, `bash -n` clean.
  - `deploy/ssh-keys/deployer.pub` — yes, exists.
- No code in `deploy/` or `infra/` was changed, so the local manual
  `deploy/deploy.sh up` flow is unchanged.

## Verification NOT done (out of reach from this environment)

- Live droplet SSH — requires the actual droplet and the `DROPLET_SSH_KEY`
  secret.
- Real run of the new workflow — requires the same.
- Actual GitHub Actions UI secrets — manual step in repo settings.

These must be performed by the operator before the first auto-deploy.
The first run can be triggered via **Actions → Deploy to droplet →
Run workflow** as a sanity check before relying on `dev` merges.
