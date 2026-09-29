# 2026-09-29 11:25 — Docker Debug Playbook (renamed & expanded)

## What changed

- Initial draft: [`docs/docker-cheatsheet.md`](../docker-cheatsheet.md)
  — created 2026-09-29 11:25 as a generic Docker debugging reference.
- 2026-09-29 13:09: deleted `docs/docker-cheatsheet.md` and replaced with
  [`docs/docker-debug-playbook.md`](../docker-debug-playbook.md). The new
  file is a **scenario-driven playbook** grounded in the actual incidents
  in `docs/history/2026-09-23 … 2026-09-29`, instead of a generic
  cheatsheet.

## Why the rename + rewrite

The user explicitly asked for:

1. **Rename** — "don't call it cheatsheet any more".
2. **Add workflows** — "put some workflow, how inspect manually my server
   and docker containers to debug problems we faced earlier".
3. **Bullet-pointed scenarios** — "if X then do Y", grounded in history
   from yesterday and the day before.
4. **More scenarios** — beyond the original handful (restart, port,
   connectivity), including deploy-script failures, DNS-01 issues,
   disk-full, SPA-build gaps, etc.

## What the new file contains

19 numbered scenarios, every one linked to a real history file:

- §2.1 Container `Restarting (1)` — triage matrix
- §2.2 `Exited (137)` OOM-killed — fix ladder
- §2.3 `pnpm-native` 60 % CPU — the do-agent confusion + the real fix
- §2.4 Caddy restart loop — four sub-flavours (placeholder leak, port
  collision, DNS 127.0.0.53, missing dist)
- §2.5 `docker compose ps` only shows postgres — the `Created ≠ Up` gotcha
- §2.6 API ↔ Postgres connectivity — DNS, env, password
- §2.7 `502/503/504` from Caddy — upstream-failed ladder
- §2.8 No host port — the `expose:` vs `ports:` distinction
- §2.9 Healthcheck `exitCode: 1` — wrong URL vs cold start
- §2.10 `couldn't find env file` — rsync `--exclude` gotcha
- §2.11 TLS `internal error (592)` — {env.DOMAIN} bug
- §2.12 Browser timeout, curl works — Cloud Firewall / DNS A record
- §2.13 ACME `Timeout during connect` — Cloud Firewall
- §2.14 SPA 404 — dist folder missing on droplet
- §2.15 `dmesg` OOM-kill — process-name → playbook entry map
- §2.16 monitor `Restarting (255)` — cold start race
- §2.17 Disk full — prune + log rotation
- §2.18 rsync `<host>: command not found` — `-e` contamination
- §2.19 `useradd uid warning` — uid/gid outside SYS_UID_MAX

Plus:

- §1 "first 60 seconds" diagnostic — `ps -a`, logs, stats, host load
- §3 Tool reference (the toolbox behind the playbook)
- §4 One-command escalation bundle
- §5 Source-of-truth links back to every history file and milestone
  referenced above.

## Files touched

- `docs/docker-cheatsheet.md` — deleted
- `docs/docker-debug-playbook.md` — created
- `docs/history/2026-09-29--11-25-49-docker-cheatsheet.md` — this file
  (rewritten to describe the rename + expansion)