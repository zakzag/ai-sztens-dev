# 2026-10-06 08:31 — deploy.yml per-env secret selection + `Caddy-Reverse-Proxy.md` spec refresh

**Status:** follow-up to the three-env separation milestone.
**Scope:** [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:108) and [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:1).

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`.github/workflows/deploy.yml:108`](../../.github/workflows/deploy.yml:108) | The render step's `env:` block was `${{ secrets.INFRA_ENV_DEV }}` — hard-wired to the dev secret regardless of `inputs.app_env`. Replaced with `${{ secrets[format('INFRA_ENV_{0}', upper(inputs.app_env \|\| 'dev'))] }}`, so a `workflow_dispatch` with `app_env=prod` reads `INFRA_ENV_PROD` and `app_env=dev` reads `INFRA_ENV_DEV`. `upper()` is required because `inputs.app_env` is lowercase (`'dev'` / `'prod'`) but GitHub secret names are uppercase. Comment block above the `env:` key explains the security model (push trigger never produces `APP_ENV=prod`, the GitHub `production` environment protection gates the prod secret independently). |
| 2 | [`.github/workflows/deploy.yml:1`](../../.github/workflows/deploy.yml:1) | The header comment block (numbered 1–8 step list) described the legacy `infra/.env` flow: "Render infra/.env from the INFRA_ENV secret", "SCP infra/.env on top", "build the SPAs against the production API base URL (derived from the rendered infra/.env)". Rewrote all eight lines to describe the per-env flow (`infra/.env.${APP_ENV}` rendered from `INFRA_ENV_${APP_ENV}`, "Build the SPAs against the matching per-env API base URL via `pnpm ... build:${APP_ENV}`", "SSH in as `deployer` and run `APP_ENV=${APP_ENV} docker compose up -d --build`"). |
| 3 | [`docs/Specs/Caddy-Reverse-Proxy.md:4`](../../docs/Specs/Caddy-Reverse-Proxy.md:4) | "Utolsó frissítés" date refreshed from 2026-10-02 → 2026-10-06 with a one-line summary of what changed. |
| 4 | [`docs/Specs/Caddy-Reverse-Proxy.md:5`](../../docs/Specs/Caddy-Reverse-Proxy.md:5) | Added cross-references to [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md) and [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md) so a reader who lands on the Caddy spec from a Three-Env-Verification link can find the per-env workflow. |
| 5 | [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md:199) | New §4.5 "Per-env renderelés és a `local` override": a table that maps `local`/`dev`/`prod` to the `DOMAIN` source / `infra/.env.${APP_ENV}` filename / whether Caddy is in the stack, plus a paragraph explaining why the local override disables Caddy (avoids the [2026-09-28 Caddy restart-loop milestone](../milestones/2026-09-28-caddy-restart-loop-and-mem-limits.milestone.md) on networks where ACME can't reach the host, and avoids the public port bind on a developer laptop). |
| 6 | [`docs/Specs/Caddy-Reverse-Proxy.md:289`](../../docs/Specs/Caddy-Reverse-Proxy.md:289) | §7.1 "Közvetlenül kapcsolódó fájlok" extended: added [`infra/docker-compose.local.yml`](../../infra/docker-compose.local.yml), [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml), [`infra/.env.dev`](../../infra/.env.example), [`infra/.env.prod`](../../infra/.env.example), and [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../history/2026-10-05--10-30-00-three-env-separation-plan.md) to the file pointer list. |
| 6 | [`docs/Specs/Caddy-Reverse-Proxy.md:368`](../../docs/Specs/Caddy-Reverse-Proxy.md:368) | §9 karbantartási szabály broadened: any change to the per-env workflow files (compose `APP_ENV`, `docker-compose.local.yml` override, deploy.yml render step, `infra/.env.{dev,prod}` DOMAIN) requires updating the document. The §4.5 table is now the source of truth for the per-env ↔ Caddy-in-stack mapping. |
| 7 | [`docs/milestones/2026-10-06--08-31-00-three-env-separation-and-deploy-yml-secret-fix.milestone.md`](../milestones/2026-10-06--08-31-00-three-env-separation-and-deploy-yml-secret-fix.milestone.md) | New milestone for the whole three-env separation effort plus today's deploy.yml fix. |

## Why this commit exists separately

The five-step plan (commits `e97f759..83e9f71`) plus the verification spec (`07b8154`) plus the three dev-stack.ps1 fixes (`7c48fc3 / 02ba18a / 32e198f`) made the three-env separation **functional**. Two follow-up gaps kept the feature incomplete in the eyes of the `docs/Specs/Three-Env-Verification.md` checklist:
1. `§5.2` "INFRA_ENV_DEV and INFRA_ENV_PROD secrets both referenced" → **failed** post-step-4: the render step's `env:` block only read `INFRA_ENV_DEV`. A prod dispatch would have written the **dev** secrets into `infra/.env.prod`.
2. `§7.1` "the linked specs describe the current state" → **partially failed**: the Caddy spec did not mention the `local` override's Caddy-disabled behavior, and the deploy.yml header described the legacy single-env flow.

This commit closes both gaps.

## Verification

```bash
# 1. The workflow YAML is valid and the secret-selection expression is well-formed
python -c "import yaml; doc = yaml.safe_load(open('.github/workflows/deploy.yml')); \
  env_map = doc['jobs']['deploy']['steps'][1]['env']; \
  assert 'INFRA_ENV' in env_map; \
  print('YAML_OK secret expr:', env_map['INFRA_ENV'])"
# Expect: YAML_OK secret expr: ${{ secrets[format('INFRA_ENV_{0}', upper(inputs.app_env || 'dev'))] }}

# 2. No more stragglers in the workflow file (every `docker compose --env-file`
#    is `infra/.env.$APP_ENV`, no plain `infra/.env` outside the legacy fallback path)
grep -n 'docker compose --env-file' .github/workflows/deploy.yml
# Expect: every line reads --env-file "infra/.env.$APP_ENV" or --env-file "infra/.env.${{ env.APP_ENV }}"

# 3. The Caddy spec mentions the local override and the per-env workflow
grep -n 'profiles: \[never\]\|docker-compose.local.yml\|INFRA_ENV_DEV\|INFRA_ENV_PROD' \
  docs/Specs/Caddy-Reverse-Proxy.md
# Expect: at least 3 matches (one in §4.5 table, one in §7.1 list, one in the §4.5 paragraph)

# 4. The milestone doc exists with the agreed filename
ls docs/milestones/2026-10-06--08-31-00-three-env-separation-and-deploy-yml-secret-fix.milestone.md
# Expect: file exists

# 5. Re-run Three-Env-Verification §5.2 manually:
grep -c 'INFRA_ENV_DEV\|INFRA_ENV_PROD' .github/workflows/deploy.yml
# Expect: ≥ 3 (the new expression plus the surrounding comment lines)
```

## What is intentionally NOT in this commit

- No code change in `apps/api/src/config/app-env.ts` / `app.module.ts` / `main.ts` — those were settled by commit `a054d0e`.
- No change to `deploy/deploy.sh` — the `APP_ENV` selector and the per-env fallback chain landed in commit `a3f901c` and are correct.
- No milestone doc for the dev-stack.ps1 fixes (they are individually small bug fixes; the work as a whole doesn't change the architecture and the three history entries [scriptpath-fix: 15:10, wslpath-diagnostic: 15:25, skip-wslpath: 15:31] carry the narrative).
- No `apps/api/src/config/app-env.ts` "future PR" comment cleanup — kept as a follow-up because the milestone doc lists it explicitly under follow-ups and a future change to `app-env.ts` is a better home for the comment refresh than this commit.

## Recommended commit message

```text
fix(deploy): pick INFRA_ENV_DEV/INFRA_ENV_PROD by APP_ENV in the render step

The render step's `env:` block was hard-wired to `secrets.INFRA_ENV_DEV`,
so a workflow_dispatch with `app_env=prod` would have written the dev
secrets into infra/.env.prod. Switch to a per-env selection:

  INFRA_ENV: ${{ secrets[format('INFRA_ENV_{0}',
                                upper(inputs.app_env || 'dev'))] }}

`upper()` is required because GitHub secret names are uppercase but
`inputs.app_env` is lowercase. The push trigger still resolves to
`secrets.INFRA_ENV_DEV` because `inputs.app_env` does not exist for
`push` events; prod deploys remain gated by the GitHub `production`
environment protection.

Also rewrite the file-header 1–8 step list (was describing the legacy
infra/.env flow) and refresh docs/Specs/Caddy-Reverse-Proxy.md: new
§4.5 documents the per-env rendering and the Caddy-disabled local
override, §7.1 cross-references the per-env workflow files, §9
karbantartási szabály broadened.

Adds docs/milestones/2026-10-06--08-31-00-three-env-separation-and-
deploy-yml-secret-fix.milestone.md.