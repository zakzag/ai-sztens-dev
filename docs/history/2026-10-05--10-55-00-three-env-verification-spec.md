# 2026-10-05 10:55 — Three-env separation · verification spec (post-Step 5)

**Plan:** [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](2026-10-05--10-30-00-three-env-separation-plan.md).
**Scope:** documentation only — no runtime change. Closes a gap flagged in
the plan's "open questions" list (operator-facing verification recipe).

## What changed

| # | File | Change |
|---|---|---|
| 1 | [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md:1) | New spec. **Single source of truth for "did the three-env separation actually work?"** Five sections: §1 repo-level checks (run anywhere), §2 local env (no droplet, ~10 min), §3 dev env (droplet, ~15 min), §4 prod env (dormant until prod droplet exists, `[if-prod-exists]` tagged), §6 timing, §7 common failure modes, §8 which sections to run for which scenario, §9 see also. |
| 2 | [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:175) | §6 "See also" now lists the verification spec first. |
| 3 | [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:373) | §9.1 now lists the verification spec between the Local-Development spec and the plan doc. The Hungarian-language one-liner explicitly says: run §1 + your env's section on every deploy / fresh pull. |

## What it covers (the important commands)

### §1 Repo-level checks (~30 s)

Eight `git` / `bash -n` / `python` checks that verify the five commits
are present, the .gitignore patterns cover all 12 per-env paths, no
secrets are tracked, the deploy.sh + scripts/dev-stack.sh parse cleanly,
the deploy.yml parses as valid YAML, and no `infra/.env` straggler
survives in `deploy/` or `.github/workflows/`.

If any of §1.1–§1.8 fails, the rest of the document assumes the
five-step plan is intact and stops.

### §2 Local env (no droplet, ~5–10 min)

Cold-start the local stack from a clean checkout:

1. First-run: confirm no per-env files exist, run `scripts/dev-stack.sh up`, verify `infra/.env.local` was seeded.
2. Boot banner: tail the log, find `[Bootstrap] API up — APP_ENV=local (raw=local), …`. Any other APP_ENV value is a bug.
3. API serves: `curl /healthz`, `curl /api/callback-requests` (POST round-trip).
4. CORS: `curl -H "Origin: http://localhost:5173"` (preflight + actual), then `127.0.0.1:5173`, then `evil.example.com` (must be rejected).
5. SPA builds: `pnpm --filter @callback/web build:dev` and confirm the bundle contains the dev URL (`https://api.aisztens.hu/api`), not `localhost`.
6. Postgres round-trip: `docker compose exec postgres psql …` and SELECT the inserted row.
7. Clean shutdown: `scripts/dev-stack.sh down`, verify no exited containers.

### §3 Dev env (droplet, ~10–15 min)

Deploy and verify the existing dev droplet (`aisztens.hu`):

1. Local pre-deploy: source `deploy/.env`, source `infra/.env.dev` (or the legacy `infra/.env`), confirm `APP_ENV=dev`.
2. Deploy via either `deploy.sh up` or `Actions → Deploy to droplet → Run workflow` (push trigger).
4. On the droplet, the api boot banner must read `APP_ENV=dev (raw=dev), …` — **not** local.
5. CORS: `curl -H "Origin: https://web.aisztens.hu"` (pass), `…/admin.aisztens.hu` (pass), `…/api.aisztens.hu` (no `allow-origin`).
6. SPA bundles on the droplet (`/srv/web/assets/*.js`, `/srv/admin/assets/*.js`) contain the dev URL — not `localhost`.
7. Full smoke: `ssh … bash scripts/test/stack-smoke.sh` → all 4 liveness + 6 cross-service checks PASS.
8. Legacy fallback: `cat /opt/aisztens/infra/.env` still has the dev values (Step 4 ships the new `infra/.env.dev` file to the unchanged `infra/.env` destination).

### §4 Prod env (dormant, `[if-prod-exists]`)

Every command is tagged `[if-prod-exists]`. Skipped until a real prod
droplet is provisioned. When that day comes, the section covers:

1. The `DROPLET_HOST_PROD` + `DROPLET_SSH_KEY_PROD` secret wiring (the
   current single-`DROPLET_HOST` is the dev one; this is a follow-up PR).
2. The `INFRA_ENV_PROD` GitHub Secret (one secret, distinct from `INFRA_ENV_DEV`, with unique secrets).
3. The GitHub `production` environment's manual-reviewer protection rule.
4. Trigger via `workflow_dispatch` with `app_env=prod` (push cannot accidentally hit prod).
5. Verify the api boot banner says `APP_ENV=prod (raw=prod)`.
6. Verify the prod `CORS_ORIGINS` rejects `web.aisztens.hu` (dev origin must NOT be in the prod list) and allows `web.<prod-domain>`.
7. Smoke-test the prod-only fail-closed guard (`onPath("main")` only — this is destructive; use a fresh staging droplet).
8. Confirm the dev droplet's `APP_ENV` is still `dev` (the prod secret never leaks into the dev compose).

### §5 CI workflow (~30 s)

Six `python` / `grep` checks against `.github/workflows/deploy.yml`:

1. YAML parses.
2. `INFRA_ENV_DEV` and `INFRA_ENV_PROD` secrets both referenced.
3. `workflow_dispatch` has the `app_env` choice input.
4. Every `docker compose --env-file` is `"infra/.env.$APP_ENV"` (no plain `infra/.env`).
5. The build step uses `build:${APP_ENV}`.
6. The `up` SSH call exports `APP_ENV="$APP_ENV"`.

### §6 Timing

Local: 5–10 min (cold start). Dev: 10–15 min (pnpm install + pnpm
build:dev for web + admin). Prod: same as dev. Incremental (just env +
secrets): 2 min.

### §7 Common failure modes

Eight symptoms + likely causes + fixes. Examples: CORS list missing
the dev SPA origin, SPA bundle references `localhost` instead of the dev
URL, the api boot banner reports the wrong `APP_ENV`, etc.

### §8 Per-scenario test plan

A matrix: which sections to run for a fresh checkout vs. an existing
deployment vs. a code change. Default for "I just pulled main": §1 +
§2.

## Why this wasn't part of Step 5

Step 5's scope was "final polish" — updating the committed
`infra/.env.example` template, the deploy runbook, and writing the
Local-Development spec. The verification spec is large enough
(~520 lines) and independent enough that it warrants its own commit
and its own cross-reference from both Local-Development and
Production-Runbook.

## How to use it

The spec is structured as a "checklist per environment". The default
audit on a fresh `main` is §1 + §2 (~15 min). An operator who just
shipped a deploy runs §1.5–§1.7 + §3 (~5 min). A code change runs
the full §1 (~30 s) as a guard against shipping a bash syntax error,
then the env-specific section.

## Verification done

- All 7 local markdown links in the new spec resolve (a one-off python
  check used a `os.path.normpath(os.path.join('docs/Specs', path))`
  resolution; the broken link from a first draft — `../deploy/README.md`
  resolving to `docs/deploy/README.md` — was fixed to `../../deploy/README.md`).
- The two pointer updates in `Local-Development.md` and
  `Production-Runbook.md` use the same link-target style as the
  surrounding content (the existing "See also" block and the existing
  Hungarian one-liner respectively).
- The spec does not propose any code or commit outside this single
  commit.

## What is intentionally NOT in this commit

- No scripts under `scripts/test/` — the spec is a markdown checklist,
  not an automated test. (Adding a `scripts/test/three-env-verification.sh`
  runner is a follow-up that can automate the curl/psql probes once
  the project has a working CI env on a fresh droplet.)
- No changes to the deploy workflow or the per-env templates — the
  verification spec is pure observation, not action.
- No milestone entry — a milestone is reserved for the original
  plan's landing (commit `83e9f71`). This commit is a documentation
  extension on top.

## Recommended commit message

```text
docs(spec): add Three-Env-Verification.md + pointer cross-references

- docs/Specs/Three-Env-Verification.md: new end-to-end manual test
  plan (5 sections, ~520 lines) covering repo / local / dev / prod
  / CI checks with expected outputs for each.
- docs/Specs/Local-Development.md §6: see-also lists the verification
  spec first.
- docs/Specs/Production-Runbook.md §9.1: same pointer added with
  Hungarian one-liner explaining "run §1 + your env's section".

Closes the operator-facing verification gap flagged in the three-env
separation plan's open questions.