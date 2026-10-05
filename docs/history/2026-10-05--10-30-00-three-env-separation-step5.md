# 2026-10-05 10:30 — Three-env separation · Step 5 (final polish: specs + templates)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md) — Step 5 of 5 (final).
**Scope:** documentation polish + the committed `infra/.env.example` template. No runtime code changes.

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`infra/.env.example`](../../infra/.env.example:1) | Rewrote as a per-env documentation template. Same variables as before, but each section now lists `local` / `dev` / `prod` guidance (DOMAIN example, CORS_ORIGINS list, DB password notes) plus a final block of three commented-out copy snippets the operator can paste into the matching per-env file. Documents the new file naming convention and the legacy `infra/.env` fallback used during the cutover. |
| 2 | [`deploy/README.md`](../../deploy/README.md:111) | §8.1 secrets table: `INFRA_ENV` monolith replaced with `INFRA_ENV_DEV` + `INFRA_ENV_PROD`. Added an explanation block on how `APP_ENV` is set (push defaults to `dev`, `workflow_dispatch.app_env` lets the operator pick `dev` or `prod`). |
| 3 | [`deploy/README.md`](../../deploy/README.md:121) | §8.2 "What the workflow does": 8 steps now mention `APP_ENV`, the per-env render, the SPA `--mode` build, and the `APP_ENV=${APP_ENV}` shell export on the `docker compose up` call. |
| 4 | [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:1) | **New spec.** Documents the three-env layout from the developer perspective: what each env reads, the `scripts/dev-stack.sh` interface, the Vite env-file priority order, how `APP_ENV` flows shell → compose → NestJS, common pitfalls (secrets in SPA env, the legacy `infra/.env` on the dev droplet, etc.). |
| 5 | [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:360) | §9.1 "Közvetlenül kapcsolódó fájlok" extended: lists the `.github/workflows/deploy.yml`, the new `infra/docker-compose.local.yml` override, the per-env `infra/.env.{local,dev,prod}` filenames, the Local-Development spec, and the three-env plan doc. The existing `infra/.env.example` row stays (the per-env names are referenced under it). |

## Why Step 5 is "polish"

Steps 0-4 already made the three-env separation functional — `APP_ENV` flows through the stack, the per-env files exist, the deploy pipeline handles the matrix. Step 5 closes the loop:

- The committed template ([`infra/.env.example`](../../infra/.env.example)) now matches the structure used by `apps/{api,web,admin}/.env.example` (which were rewritten in Steps 1-2). Anyone reading the repo can see all three envs side-by-side.
- The deploy runbook ([`deploy/README.md`](../../deploy/README.md)) accurately describes the secrets + the `APP_ENV` matrix; an operator following it on day 0 doesn't need to read the plan.
- A new contributor has a single starting point ([`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md)) for the local workflow.
- The ops-facing runbook ([`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md)) §9.1 points at the right files; existing links to `infra/.env` still resolve to the droplet-side file, so the runbook's earlier troubleshooting commands (which all use `infra/.env` on the droplet) are not affected.

## Verification done locally

```bash
# 1. dev-stack.sh still parses (Step 3 file unchanged, sanity check)
bash -n scripts/dev-stack.sh && echo SYNTAX_OK_DEV_STACK
# → SYNTAX_OK_DEV_STACK

# 2. deploy.yml still parses (Step 4 file unchanged)
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml').read()); print('YAML_OK')"
# → YAML_OK
```

## Verification to run after this commit

```bash
# 1. The new Local-Development spec is rendered correctly by any markdown viewer
head -30 docs/Specs/Local-Development.md
# Expect: header, "Status: living spec", audience line, §1 table of three envs.

# 2. deploy/README.md §8.1 secrets table mentions both new secrets
grep -c 'INFRA_ENV_DEV\|INFRA_ENV_PROD' deploy/README.md
# Expect: 6+ matches (table rows + the workflow step explanations)

# 3. infra/.env.example has per-env copy snippets at the bottom
grep -c '^# infra/.env' infra/.env.example
# Expect: 3 (local, dev, prod)
```

## What is intentionally NOT in this step

- No CHANGELOG file — the [plan doc](2026-10-05--10-30-00-three-env-separation-plan.md) plus the five history entries (step0…step5) form the changelog.
- No `apps/web/.env.example` / `apps/admin/.env.example` / `apps/api/.env.example` change — those were already rewritten in Steps 1-2.
- No `deploy.sh` / `deploy.yml` change — those were the meat of Step 4.
- No Caddyfile change — the `infra/.env.{dev,prod}` → `Caddyfile.rendered` pipeline is unchanged.

## The plan as a whole

Five commits land the plan in [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md):

| Commit | Plan step | Files touched (repo-tracked only) | What it did |
|---|---|---|---|
| `e97f759` | 0 + 1 | 9 | `.gitignore` per-env patterns; SPAs' `dev:dev`/`build:dev`/`build:prod` scripts; `apps/{web,admin}/.env.example` rewrites; `deploy.sh:build_spas` switched to `--mode dev` + `ensure_spa_env()` helper |
| `a054d0e` | 2 | 7 | `apps/api/src/config/app-env.ts` (new); `app.module.ts` envFilePath + ignoreEnvFile; `main.ts` prod+empty-CORS fail-close + banner; `infra/docker-compose.yml` APP_ENV env entry; `apps/api/.env.example` rewrite |
| `8dd9f8f` | 3 | 7 | `scripts/dev-stack.sh` (new bash helper); `scripts/dev-stack.ps1` (new Windows wrapper); `infra/docker-compose.wsl.yml` → `infra/docker-compose.local.yml` rename |
| `a3f901c` | 4 | 3 | `deploy.sh` APP_ENV selector + per-env fallback chain + legacy compat; `deploy.yml` INFRA_ENV_DEV/PROD split + `workflow_dispatch.app_env` input + APP_ENV threading through every `docker compose --env-file` call |
| (this commit) | 5 | 4 | `infra/.env.example` per-env rewrite; `deploy/README.md` secrets table + workflow steps; new `docs/Specs/Local-Development.md`; `Production-Runbook.md` §9.1 expanded |

After this commit the project has three real environments — local (developer), dev (the existing droplet), prod (future, gated by the GitHub `production` environment) — each with its own `.env.{local,dev,prod}` files and a single source of truth (`APP_ENV`) for which one is active.

## Recommended commit message

```text
docs(env): per-env infra/.env.example + Local-Development spec (step 5)

- infra/.env.example: per-env documentation template, three copy snippets
  at the bottom for local / dev / prod.
- deploy/README.md §8.1: INFRA_ENV_DEV / INFRA_ENV_PROD secrets table;
  §8.2 workflow steps describe APP_ENV flow + per-env render.
- docs/Specs/Local-Development.md: new spec for the dev-side workflow
  (scripts/dev-stack.sh, per-env files, APP_ENV propagation, pitfalls).
- docs/Specs/Production-Runbook.md §9.1: lists the new files (workflow,
  docker-compose.local, per-env env, three-env plan).

Step 5 of docs/history/2026-10-05--10-30-00-three-env-separation-plan.md.