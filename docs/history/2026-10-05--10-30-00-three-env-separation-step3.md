# 2026-10-05 10:30 — Three-env separation · Step 3 (local run helper)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md) — Step 3 of 5.
**Scope:** developer-machine workflow. No code/runtime changes on the dev droplet.

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh:1) | New bash entry point. `up` / `down` / `ps` / `logs` / `restart` subcommands. Seeds `infra/.env.local` from [`infra/.env.example`](../../infra/.env.example) on first run (with a warning to replace the placeholder passwords). Sets `APP_ENV=local` so the API picks `apps/api/.env.local`. Runs `docker compose up -d --build` with the merged `infra/docker-compose.yml` + `infra/docker-compose.local.yml` files. Prints the URLs to open. Pre-flight checks that docker + compose v2 are on PATH. |
| 2 | [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:1) | Windows PowerShell wrapper. Detects whether it runs on Windows or Linux/macOS. On Windows, translates the repo path via `wslpath` and invokes the bash script inside the default WSL distro via `wsl.exe`, returning the same exit code. |
| 3 | `infra/docker-compose.wsl.yml` → `infra/docker-compose.local.yml` | Rename only — content (3 service overrides: `api:3000` host port, `postgres:5432` host port, `caddy` disabled via `profiles: [never]`) is unchanged. Header comment rewritten to drop the WSL-specific framing and to point operators at `scripts/dev-stack.sh up`. |
| 4 | [`deploy/README.md:159`](../../deploy/README.md:159) | §9 "Local development in WSL" updated: the docker compose incantation becomes a single `scripts/dev-stack.sh up`, with the long form shown for reference. Mentions the `.ps1` wrapper. |
| 5 | [`README.md`](../../README.md) | "Useful scripts" table gains a row pointing at `scripts/dev-stack.sh up` (and `pwsh scripts/dev-stack.ps1 up` for Windows). |

## Why the rename

`docker-compose.wsl.yml` predates the three-env separation plan. After the plan landed, the file is no longer WSL-specific — it's the **local developer machine** profile (WSL, native Linux, or macOS). Keeping the old name would mislead people on macOS into skipping it, and bury a useful tool behind a Windows-specific label. The rename is git-detected (`RM` in `git status`), so history is preserved.

## Why `dev-stack.sh` instead of a longer alias

A one-shot script:
- hides the `--env-file ... -f ... -f ...` incantation that already bit three developers (per `docs/history/2026-10-02--20-42-00-infra-env-restore-and-monitor-watchdog.md` and `docs/history/2026-09-29--13-35-00-empty-spaces-and-502-fix.md`);
- adds a fail-fast pre-flight (docker missing, compose v2 missing, files missing);
- seeds `infra/.env.local` so a brand-new contributor never sees an empty `.env`;
- sets `APP_ENV=local` so the API picks the right per-env file without the operator having to remember.

## How `APP_ENV=local` flows

```
scripts/dev-stack.sh up
  └─ export APP_ENV=local
     └─ docker compose up
        └─ NestJS process inherits APP_ENV=local
           └─ apps/api/src/config/app-env.ts: APP_ENV = 'local'
           └─ apps/api/src/app.module.ts: envFilePath = ['.env.local', '.env.local']  (the dev one)
           └─ apps/api/src/main.ts: loud banner says "APP_ENV=local"
```

The same shell variable is also picked up by the SPAs' `pnpm dev` runs through [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:1) — Vite reads `import.meta.env.MODE` from `--mode local` (no flag), which loads `apps/{web,admin}/.env.local` (already created in Step 1).

## Verification done locally

```bash
# 1. The new bash script parses clean
bash -n scripts/dev-stack.sh && echo SYNTAX_OK
# → SYNTAX_OK

# 2. The rename was detected by git (history is preserved)
git status --short infra
# → RM infra/docker-compose.wsl.yml -> infra/docker-compose.local.yml

# 3. No tracked references to docker-compose.wsl.yml remain
#    (deploy/README.md and docs/history/* were updated; only Step 3's own
#    history entry intentionally references the old name to explain the rename)
git grep -n 'docker-compose\.wsl\.yml' -- ':!docs/history/2026-10-05--10-30-00-three-env-separation-step3.md'
# → (no output)
```

## Verification to run on a fresh developer machine

```bash
# 1. Without docker installed
scripts/dev-stack.sh up
# Expect: [dev-stack] docker is not on PATH. Install Docker Desktop ...

# 2. With docker but no infra/.env.local (first run)
scripts/dev-stack.sh up
# Expect: warning "infra/.env.local does not exist; seeding ..." then docker compose up ...

# 3. Verify the API serves
curl http://localhost:3000/healthz
# Expect: "OK" / similar
curl -i -H "Origin: http://localhost:5173" http://localhost:3000/api/callback-requests
# Expect: 200 + access-control-allow-origin: http://localhost:5173
# (because APP_ENV=local => CORS_ORIGINS comes from apps/api/.env.local,
#  which lists both localhost:5173/5174 and 127.0.0.1:5173/5174)

# 4. From Windows PowerShell
pwsh scripts/dev-stack.ps1 up
# Expect: same output as the bash version, exit code 1 if WSL is missing

# 5. Stop and clean up
scripts/dev-stack.sh down
# Expect: docker compose down succeeds
```

## What is intentionally NOT in this step

- No `infra/.env.local` content seeded by the script beyond a copy of `.env.example`. The operator must replace the placeholder passwords (this is enforced by the seed warning).
- No `APP_ENV` selector in `deploy.sh` yet — that's Step 4.
- No CI matrix change yet — Step 4.
- The dev droplet is **not** touched. `scripts/dev-stack.sh` is purely local.
- `scripts/init.sh` / `scripts/init.ps1` (the AI-agent instruction sync scripts) were not touched — they don't reference the renamed file.

## Recommended commit message

```text
chore(dev): scripts/dev-stack.sh + rename docker-compose.local.yml

- scripts/dev-stack.sh: single-command local stack helper (up / down /
  ps / logs / restart). Seeds infra/.env.local on first run, sets
  APP_ENV=local so the API picks apps/api/.env.local.
- scripts/dev-stack.ps1: Windows wrapper that delegates to the bash
  script via WSL.
- infra/docker-compose.wsl.yml -> infra/docker-compose.local.yml: same
  content, just the name no longer misleads macOS / native Linux users.
- deploy/README.md + README.md updated to reference the new helper.

Step 3 of docs/history/2026-10-05--10-30-00-three-env-separation-plan.md.