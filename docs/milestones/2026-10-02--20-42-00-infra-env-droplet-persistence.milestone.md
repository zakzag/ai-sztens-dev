# `infra/.env`: why deploys succeeded without it, and what silently degrades

**Date:** 2026-10-02 20:42 (Europe/Budapest)
**Status:** diagnosed and local copy restored; hardening postponed

## 1. Problem

The `infra/.env` file had never existed in the active checkout
(`…2026-08-31-ai-sztens-dev`), yet production deploys reported success — while
the compose stack is invoked as
`docker compose --env-file infra/.env -f infra/docker-compose.yml`. The question
was: what is this file needed for, and what breaks if it is missing?

## 2. Measured evidence

| # | Check | Result |
|---|---|---|
| 1 | `/opt/aisztens/infra/.env` on the droplet | exists — 2721 B, mtime `2026-09-29 16:24`, `755 root:root`, 54 lines, 0 `change-me` values |
| 2 | `docker compose --env-file <missing> -f infra/docker-compose.yml config --services` | **hard failure**: `couldn't find env file: …`, exit 1 — no silent blank defaults |
| 3 | `…-ai-sztens-dev-old\infra\.env` | exists, 2721 B, `sha256 03060b66…8be988cd` — **identical to the droplet copy** |
| 4 | `infra/.env` in the active checkout | existed only as a copy of `infra/.env.example` (48 lines, `change-me-*` placeholders) |
| 5 | `deploy/.env` in the active checkout | missing → [`deploy.sh:59`](../../deploy/deploy.sh:59) aborts on `HOST="${HOST:?...}"` |
| 6 | `E:\projects\AI\infra\.env` (parent-dir fallback) | missing |

## 3. Root cause

The deploy pipeline never required a local `infra/.env` in this checkout:

1. **Droplet persistence.** `rsync --delete` excludes `infra/.env`
   ([`deploy.sh:183`](../../deploy/deploy.sh:183)) and the SCP step only overwrites
   when a local source exists ([`deploy.sh:211`](../../deploy/deploy.sh:211)), so a
   single upload stays on the droplet indefinitely.
2. **CI path.** [`.github/workflows/deploy.yml:65`](../../.github/workflows/deploy.yml:65)
   renders the file from the `INFRA_ENV` GitHub secret in the runner and pushes it
   ([`deploy.yml:108`](../../.github/workflows/deploy.yml:108)); a local file is not needed.
3. **Local path.** The last successful local deploy ran from the sibling checkout
   `…-ai-sztens-dev-old`, whose `infra/.env` is byte-identical to the droplet copy.

Failure modes if the file is missing: on the droplet **every** compose command
(`up`, `down`, `restart`, `ps`, `logs` — [`deploy.sh:304-317`](../../deploy/deploy.sh:304))
dies with `couldn't find env file`; locally [`deploy.sh up`](../../deploy/deploy.sh:207)
aborts before rendering, otherwise `DOMAIN`/`ACME_EMAIL` degrade to `localhost`
([`deploy.sh:71`](../../deploy/deploy.sh:71), [`deploy.sh:79`](../../deploy/deploy.sh:79))
and the SPAs get built against `https://api.localhost/api`. If the file is present
but partial, the dangerous case is an empty `CORS_ORIGINS`: [`main.ts:23`](../../apps/api/src/main.ts:23)
yields an empty list, so [`origin: true`](../../apps/api/src/main.ts:28) accepts
**any** origin with credentials.

## 4. Solution

| File | Change |
|---|---|
| `infra/.env` | Restored locally via `copy /Y` from `…-ai-sztens-dev-old\infra\.env`; verified identical to the droplet copy (`sha256 03060b66…8be988cd`, 54 lines, 0 placeholders). Gitignored, so local-only — nothing was uploaded. |
| [`docs/history/2026-10-02--20-42-00-infra-env-restore-and-monitor-watchdog.md`](../history/2026-10-02--20-42-00-infra-env-restore-and-monitor-watchdog.md) | Full narrative: monitor watchdog explanation + this diagnosis. |
| [`docs/milestones/2026-10-02--20-42-00-infra-env-droplet-persistence.milestone.md`](2026-10-02--20-42-00-infra-env-droplet-persistence.milestone.md) | This document. |

No application code, compose file or deploy script was modified.

## 5. Outcome and verification

```cmd
certutil -hashfile "infra\.env" SHA256   :: 03060b66687c64bb3e40d3f4f78aca0defdc0c97e3b53083a830f3aa8be988cd
find /c /v "" "infra\.env"               :: 54
findstr /C:"change-me" "infra\.env"      :: no match
```

```bash
# remote cross-check, metadata only — never print values
sha256sum /opt/aisztens/infra/.env
grep -oE '^[A-Z0-9_]+=' /opt/aisztens/infra/.env | tr -d '=' | sort
```

## 6. Follow-ups

- **Placeholder guard:** `upload()` should refuse to push an `infra/.env` that still
  contains `change-me`, and warn on the parent-directory fallback
  ([`deploy.sh:201`](../../deploy/deploy.sh:201)) — today a stray
  `cp infra/.env.example infra/.env` overwrites production secrets.
- **Monitor doc drift:** playbook §2.16 ([`docker-debug-playbook.md:632`](../docker-debug-playbook.md:632))
  still describes a `wget` exit-255 restart loop that the current infinite
  `curl` loop cannot produce; runbook §4.4 ([`Production-Runbook.md:148`](../Specs/Production-Runbook.md:148))
  uses `wget` although the image ships `curl`; [`infra/.env.example:40`](../../infra/.env.example:40)
  documents the webhook field as `status` while [`watch.sh:29`](../../infra/monitor/watch.sh:29) sends `state`.
- Secrets still live as plaintext env files; the 3-phase secret-management plan in
  [`docs/history/2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md`](../history/2026-10-01--10-33-59-env-storage-and-deploy-automation-plan.md)
  is still unimplemented.
