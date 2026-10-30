# 2026-10-12 00:58 — deploy.yml deep audit + hardening pass

## Context

By this point in the session, four silent bugs in `.github/workflows/deploy.yml`
had been uncovered and fixed one at a time: parse errors at lines 220 / 232 /
279, scp-action `chmod 600` on `infra/.env`, `command:` silently no-op'd by
`appleboy/ssh-action@v1.0.3`, and missing `envs:` forwarding of
`REMOTE_DIR/APP_ENV/IMAGE_TAG/GHCR_PAT/GITHUB_ACTOR`. With all four fixed
the workflow finally turned a real green deploy. A scripted actionlint-style
audit was then run over the file to surface any remaining issues before the
next deploy was pushed.

## Audit findings and resolutions

### BUG-5 (HIGH) — workflow_run trigger cannot distinguish dev/prod on push

The `inputs.app_env || (github.event.workflow_run.inputs.app_env || 'dev')`
expression always falls back to `dev` on a push trigger, because
`github.event.workflow_run.inputs` is empty for a `push`-triggered upstream
workflow. A future `push.branches: [dev, prod]` would silently deploy a
prod-built image to the dev droplet.

Fix: introduced a workflow-level `env.APP_ENV` helper that does the full
fallback chain (operator input -> upstream workflow_dispatch input ->
upstream `head_branch` -> direct push `ref_name` -> 'dev'), and updated
`concurrency`, `job.name`, `environment`, and both `INFRA_ENV` references
to use it. Pure rename of the helper at 6 sites; the actual expression is
documented in the workflow-level `env:` block.

### BUG-6 (MEDIUM) — INFRA_ENV_* secret must be consistently escaped

The `Render Caddyfile` step reads `DOMAIN` and `ACME_EMAIL` from
`infra/.env` after writing the file with `printf '%s\n' "$INFRA_ENV"`. If
the secret uses bare `KEY=value with spaces` (unquoted, with spaces) the
downstream `docker compose --env-file` will fail to parse. `infra/.env.example`
is the source of truth and uses the shell-style quoted form; the step's
comment now says so explicitly, plus a new fail-fast guard checks that
neither value contains a `|` character (would break the `sed '|'`
delimiter in the Caddyfile template substitution).

### BUG-7 (MEDIUM) — secret values silently overwritten by workflow's append block

The `Render infra/.env` step's append block writes `APP_ENV=`,
`IMAGE_TAG=`, `GHCR_OWNER=`, and `REGISTRY=` lines to the file. If the
secret itself contains any of these keys (e.g. `infra/.env.dev` was
authored to include `IMAGE_TAG=...` for some earlier reason), the
workflow's append wins, silently overriding the secret value.

Fix: added a `for key in APP_ENV IMAGE_TAG GHCR_OWNER REGISTRY; do grep ... ; done`
guard in the same step that fails the workflow with a precise error
message when the secret defines any of these keys. Forces the secret
authors to remove them rather than carrying silent drift. Comment also
documents the precedence rule.

### WARN-1 — appleboy action versions were floating minor (v0.1.7, v1.0.3)

Both `@v0.1.7` (scp-action) and `@v1.0.3` (ssh-action) are tag-pinned
but still allow any future breaking change within that major to flow
through. SHA-pinned to the exact commit that exists today; Dependabot
or a periodic bump PR is responsible for upgrades, and the version
comment (`# v1.0.3`) preserves the human-readable hint.

SHAs used:

- `appleboy/scp-action@917f8b81dfc1ccd331fef9e2d61bdc6c8be94634` (v0.1.7)
- `appleboy/ssh-action@029f5b4aeeeb58fdfe1410a5d17f967dacf36262` (v1.0.3)

### WARN-2 — actions/checkout persisted GITHUB_TOKEN in git config

`persist-credentials: false` added. No step in this workflow does
`git push`, so the default `true` was always unused, but turning it
off is a defense-in-depth measure against any future step
accidentally inheriting write access.

### WARN-3 — Render Caddyfile sed '|' delimiter would break on '|' in DOMAIN

Part of BUG-6 above. New `grep -q '|'` checks on `$domain` and
`$acme_email` raise an error rather than mis-parse if either ever
contained the delimiter character.

### WARN-4 — `set -u` in the Render Caddyfile script before the | check

Already covered by the existing `set -euo pipefail` at the top of
the step. The new `|` check uses `[ -n "$domain" ]` and
`printf '%s' "$domain" | grep -q '|'` to avoid `[ -z ]` ordering
issues and to handle the case where the var is empty.

## What was NOT changed

- `concurrency.cancel-in-progress: false` — correct for deploys
  (never kill a half-deployed stack).
- `push + workflow_run` double-trigger — doubles CI minutes but the
  workflow is idempotent; not worth fixing.
- The `step 10 (Dump container logs on failure)` is
  `if: failure()` and best-effort; not touched.

## Files touched

- `.github/workflows/deploy.yml` (+59 lines net, was 439, now 498)
- `docs/Specs/Production-Runbook.md` (Utolsó frissítés dátum +
  changelog)
- `docs/Specs/Caddy-Reverse-Proxy.md` (Utolsó frissítés dátum +
  changelog)
- `docs/history/2026-10-12--00-58-12-deploy-yml-deep-audit-and-hardening.md` (this file)
- `docs/milestones/2026-10-12--00-58-12-deploy-yml-deep-audit-and-hardening.milestone.md`
