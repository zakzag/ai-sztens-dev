# 2026-10-05 10:30 — Three-env separation · Step 0 (`infra/.env` → `infra/.env.dev`)

**Scope:** Step 0 of [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md).
No behaviour change on the dev droplet; this only prepares the file layout for the steps that follow.

## What changed

| # | Action | Result |
|---|---|---|
| 1 | Rename `infra/.env` → `infra/.env.dev` in the working copy (content preserved verbatim) | the dev secrets now live under the per-env filename they will keep for the rest of the plan |
| 2 | Extend [`.gitignore`](../../.gitignore:42) with per-env ignores for the new files and the upcoming ones | `apps/**/.env.local`, `apps/**/.env.dev`, `apps/**/.env.prod`, `infra/.env.local`, `infra/.env.dev`, `infra/.env.prod` are now gitignored, with explicit whitelists for the existing `.env.example` templates so they stay tracked |

Important nuance: **neither `infra/.env` nor `infra/.env.dev` is tracked by git**. The existing [`.gitignore:43`](../../.gitignore:43) (`.env`) and the new patterns both keep them out of the index. The rename is a **working-directory** operation only — git sees no diff for either file. This is intentional and correct: secret files must never be committed, and the developer copy is not part of the repo's source of truth (the droplet has its own copy, and CI has its own GitHub Secret).

## Why

The three-env separation plan introduces `.env.local` / `.env.dev` / `.env.prod` files per app and per infra. The first concrete rename is the existing dev droplet’s secret file: `infra/.env` → `infra/.env.dev`. Doing it in its own step means:

- The droplet’s running stack is **unaffected** — the deploy script keeps reading `infra/.env` from the droplet (the rename happens only in the repo; the droplet file path is unchanged), and the droplet-side compose invocation `--env-file infra/.env` still resolves.
- The gitignore is updated **now** so a developer cannot accidentally commit a future `infra/.env.prod` when it gets created in Step 5 of the plan.

## How the dev droplet is kept running

- On the **repo side** the file is now called `infra/.env.dev`. Git tracks the rename.
- On the **droplet side** the file stays at `/opt/aisztens/infra/.env` — [`deploy/deploy.sh:202`](../../deploy/deploy.sh:202) still scp's `infra/.env.dev` → `infra/.env` on every deploy (that step in the script is unchanged for now; the new `APP_ENV` selector lands in Step 4 of the plan).
- The current `--env-file infra/.env -f infra/docker-compose.yml` invocation on the droplet is untouched.

## Verification done locally

```
dir /b infra\.env*
# → .env.dev
# → .env.example
# (no bare .env)
git status --short infra .gitignore
# M  .gitignore
# (no entry for infra/.env or infra/.env.dev — both correctly ignored)
git ls-files infra/.env
# (empty — never in the index)
```

The absence of an `infra/.env.dev` entry under `??` or `A` in `git status` is **expected and desired**: it confirms the file is properly gitignored, so no future accidental `git add .` can leak secrets. The history entry for this commit will only show the `.gitignore` modification.

## Verification to run on the droplet after the next deploy

```bash
# 1. The droplet's infra/.env still has the dev secrets (unchanged behaviour)
ssh deployer@aisztens.hu "grep -c '^DOMAIN=' /opt/aisztens/infra/.env"
# Expect: 1

# 2. The stack still comes up cleanly
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml ps"
# Expect: 4 containers Up (api, postgres, caddy, monitor)

# 3. /healthz still 200
curl -fsS https://api.aisztens.hu/healthz
# Expect: "OK" / similar (existing endpoint contract)
```

## What is intentionally NOT in this step

- No code changes (NestJS `ConfigModule`, `main.ts`, Vite configs, package.json scripts, deploy.sh, GitHub workflow) — those land in Steps 1–4 of the plan.
- No `infra/.env.local` or `apps/*/.env.{local,dev,prod}` files yet — they are created in the steps that consume them.
- No rename of `infra/docker-compose.wsl.yml` to `infra/docker-compose.local.yml` — that comes in Step 3.
- The droplet is **not** touched by this commit — the deploy pipeline copies the new path `infra/.env.dev` to the unchanged remote path `infra/.env` automatically (the deploy.sh branch from the previous PR).