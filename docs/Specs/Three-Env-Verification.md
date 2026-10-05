# Three-Environment Verification — AIsztens

**Status:** living spec
**Audience:** anyone who wants to confirm the three-env separation actually
works end-to-end. Use this after pulling the latest `main`, after a
droplet reboot, or after any change to `deploy/`, `.github/workflows/`,
`infra/docker-compose*.yml`, or the API's `config/app-env.ts`.

This spec complements
[`docs/Specs/Local-Development.md`](Local-Development.md) (developer
workflow) and
[`docs/Specs/Production-Runbook.md`](Production-Runbook.md) (ops on the
droplet). It is the **single source of truth** for "did the three-env
separation actually work?" — each section is a list of commands and their
expected output.

---

## 0. Before you start

A few things that should already be true:

- `main` is at commit `83e9f71` or later (the five-step three-env
  separation plan lands here).
- `docker` + `docker compose` v2 are on `PATH`.
- You have SSH access to the dev droplet (`deployer@<HOST>` from
  `deploy/.env`).
- You can read `deploy/.env` locally (the `HOST` line) and you know the
  droplet's `REMOTE_DIR` (default `/opt/aisztens`).

If you are about to verify the **prod** environment, the prod droplet
must already exist (Step 4 prepared the deploy, but `prod` is dormant
until a real droplet is provisioned). The "§4 Prod" section below has
explicit `[if-prod-exists]` tags on every command — skip them if prod
is not yet online.

---

## 1. Repo-level checks (run anywhere, ~1 minute)

These checks verify that the five commits and the file layout are in
the right shape. Run them from the repo root on any machine.

```bash
# 1a. The five commits are present on main, in the right order
git log --oneline | grep -E 'three-env'
# Expect (most recent first):
#   83e9f71 docs(env): per-env infra/.env.example + Local-Development spec (step 5)
#   a3f901c feat(deploy): APP_ENV selector + per-environment secrets (three-env step 4)
#   8dd9f8f chore(dev): scripts/dev-stack.sh + rename docker-compose.local.yml
#   a054d0e feat(api): per-env file selection via APP_ENV (three-env plan step 2)
#   e97f759 chore(env): three-env separation, vite modes

# 1b. .gitignore covers all per-env paths and keeps the .env.example templates tracked
git check-ignore -v \
  infra/.env.local infra/.env.dev infra/.env.prod \
  apps/api/.env.local apps/api/.env.dev apps/api/.env.prod \
  apps/web/.env.local apps/web/.env.dev apps/web/.env.prod \
  apps/admin/.env.local apps/admin/.env.dev apps/admin/.env.prod
# Expect: 12 lines, each matching one of .gitignore:57/58/59/60
# (apps/**/.env.local, apps/**/.env.dev, apps/**/.env.prod, infra/.env.dev,
#  infra/.env.prod, infra/.env.local)

# 1c. The .env.example templates are still tracked
git ls-files \
  infra/.env.example apps/api/.env.example apps/web/.env.example apps/admin/.env.example
# Expect: 4 lines (all four are tracked)

# 1d. No stragglers — every tracked file references the new APP_ENV naming
#     consistently (no leftover `infra/.env` outside the legacy fallback paths)
git grep -nE 'infra/\.env(?![\./])' -- 'deploy/' '.github/workflows/'
# Expect: 0 matches. (The non-greedy negative lookahead excludes
#   `infra/.env.local`, `infra/.env.dev`, `infra/.env.prod`, `infra/.env.example`,
#   `infra/.env.x.y`, and `infra/.env/` directory refs.)

# 1e. No committed per-env secret file (the .env.example → .env.{local,dev,prod}
#     rename should leave the real files gitignored)
git ls-files | grep -E '\.env\.(local|dev|prod)$'
# Expect: empty output

# 1f. The deploy.sh script parses cleanly
bash -n deploy/deploy.sh && echo SYNTAX_OK_DEPLOY
# Expect: SYNTAX_OK_DEPLOY

# 1g. The deploy workflow parses as valid YAML
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml').read()); print('YAML_OK')"
# Expect: YAML_OK

# 1h. The dev-stack helper parses cleanly
bash -n scripts/dev-stack.sh && echo SYNTAX_OK_DEV_STACK
# Expect: SYNTAX_OK_DEV_STACK
```

**If any of 1a–1h fails, do not proceed.** The rest of the doc assumes
the five-step plan is intact.

---

## 2. Local env verification (no droplet, ~10 minutes)

Goal: prove the **local** developer stack comes up, the API serves, the
SPAs proxy correctly, and `APP_ENV=local` flows shell → compose → NestJS
without surprises.

### 2.1 First-run: clean checkout, no env files exist

```bash
# 2.1.1 Confirm the per-env files do NOT yet exist
ls infra/.env.local apps/api/.env.local apps/web/.env.local apps/admin/.env.local 2>&1
# Expect: four "No such file or directory" errors
```

### 2.2 Run the helper for the first time

```bash
# 2.2.1 Bring up the stack. On the first invocation, this also seeds
#        infra/.env.local from infra/.env.example with a warning.
scripts/dev-stack.sh up
# Expect output includes:
#   [dev-stack] Note: docker compose version ≥[v2.x.y]
#   [dev-stack] Bringing up the local stack ...
#   [dev-stack] Note: infra/.env.local does not exist; seeding from infra/.env.example.
#   [dev-stack] Note:   Open it and replace the placeholder passwords BEFORE you POST data.
#   [dev-stack] Stack is up. Open one of:
#     - http://localhost:3000/healthz          (NestJS healthcheck)
#     - http://localhost:3000/api              (NestJS API root)
#     - psql -h localhost -U aisztens -d callback  (Postgres on :5432)

# 2.2.2 Verify the seed was created
ls -l infra/.env.local
# Expect: -rw------- 1 ... infra/.env.local (chmod 600, size > 0)
```

### 2.3 The api container logs the boot banner

```bash
# 2.3.1 Tail the api container's logs
docker compose --env-file infra/.env.local \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.local.yml logs api 2>&1 | grep -E 'Bootstrap|Nest application'
# Expect:
#   [Bootstrap] API up — APP_ENV=local (raw=local), listening on 0.0.0.0:3000, CORS origins: http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
#   (then "Nest application successfully started" + "Listening on http://0.0.0.0:3000")
```

If `APP_ENV` is anything other than `local`, **stop the stack and
investigate** — `scripts/dev-stack.sh` is the only blessed entry point.

### 2.4 The api serves

```bash
# 2.4.1 Healthcheck
curl -fsS http://localhost:3000/healthz
# Expect: 200, response body matches what HealthController returns
#   (NestJS health.controller.ts; typically returns "OK" or a JSON status).

# 2.4.2 API root
curl -i http://localhost:3000/api 2>&1 | head -1
# Expect: HTTP/1.1 404 Not Found   (or a similar non-200 — there is no
#   root handler; this confirms the global prefix is applied)

# 2.4.3 POST /api/callback-requests (the real public endpoint)
curl -fsS -X POST -H "Content-Type: application/json" \
  -d '{"name":"verify","email":"verify@example.com","phone":"+36300000001","reason":"end-to-end verification"}' \
  http://localhost:3000/api/callback-requests
# Expect: 201 + {"id":"<some-uuid>"}
```

### 2.5 CORS allows the local SPA origins

```bash
# 2.5.1 From the Vite dev origin (5173) — preflight + actual
curl -i -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS http://localhost:3000/api/callback-requests | head -20
# Expect: 204 No Content + access-control-allow-origin: http://localhost:5173

# 2.5.2 From the 127.0.0.1 variant (also listed in apps/api/.env.local)
curl -i -H "Origin: http://127.0.0.1:5173" http://localhost:3000/api/callback-requests | head -10
# Expect: 200 + access-control-allow-origin: http://127.0.0.1:5173

# 2.5.3 From a random other origin (should be rejected)
curl -i -H "Origin: https://evil.example.com" http://localhost:3000/api/callback-requests | head -10
# Expect: 200 + NO access-control-allow-origin header (CORS denied in the browser)
```

### 2.6 The SPAs proxy through the Vite dev server

```bash
# 2.6.1 web SPA — its /api/* proxy forwards to :3000
cd apps/web
# Build the dev bundle so we can grep for the api URL.
SPA_BUILD_MODE=dev dot pnpm --filter @callback/web build:dev
grep -l 'aisztens\.hu\|/api/' apps/web/dist/assets/*.js 2>&1
# Expect: at least one .js file containing 'aisztens.hu' AND at least one .js file containing '/api/'

# 2.6.2 Same for admin
cd ../admin
SPA_BUILD_MODE=dev dot pnpm --filter @callback/admin build:dev
grep -l 'aisztens\.hu\|/api/' apps/admin/dist/assets/*.js 2>&1
# Expect: at least one .js file with 'aisztens.hu' (prod URL) AND
#   at least one .js file with '/api/' (the Vite proxy default for dev).

# 2.6.3 The apps' .env.dev file (set during build) has the dev URL.
cat apps/web/.env.dev
# Expect: VITE_API_BASE_URL=https://api.aisztens.hu/api
```

### 2.7 Postgres is reachable

```bash
# 2.7.1 Connect with psql (or use docker compose exec if psql not installed)
docker compose --env-file infra/.env.local \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.local.yml \
  exec postgres psql -U aisztens -d callback -c "SELECT count(*) FROM callback_requests;"
# Expect: a positive integer (the row inserted by §2.4.3). If you see 0,
#   that is also fine — it means the test row didn't make it in. Either
#   way, the connection works.

# 2.7.2 The callback_requests table actually has the row from §2.4.3
docker compose ... exec postgres psql -U aisztens -d callback \
  -c "SELECT email FROM callback_requests ORDER BY created_at DESC LIMIT 1;"
# Expect: verify@example.com (the email from §2.4.3)
```

### 2.8 Stop the stack and clean up

```bash
# 2.8.1 Stop the stack (keeps volumes)
scripts/dev-stack.sh down
# Expect: [dev-stack] Stopping the local stack ... + [dev-stack] Stack is down.

# 2.8.2 Verify the containers are gone
docker compose --env-file infra/.env.local \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.local.yml \
  ps --services --filter "status=exited"
# Expect: empty (no exited service containers)
```

---

## 3. Dev env verification (droplet, ~15 minutes)

Goal: prove the **dev** droplet (the one that pre-dates the cutover)
still serves correctly after the deploy.sh + deploy.yml changes. The
deployment target is the existing `aisztens.hu`.

### 3.1 Local pre-deploy checks

```bash
# 3.1.1 The deploy.sh has APP_ENV in scope (CI does this via $GITHUB_ENV;
#        locally you have to set it yourself)
cd deploy/
. .env          # set HOST etc.
set -a; . infra/.env.dev 2>/dev/null  # NO-OP if infra/.env.dev does not
                                     # yet exist locally (legacy path)
echo "DOMAIN=$DOMAIN APP_ENV=${APP_ENV:-unset}"
# Expect: DOMAIN=aisztens.hu APP_ENV=dev
#   (If APP_ENV is unset and you have not migrated infra/.env → infra/.env.dev
#    locally, deploy.sh will still pick up infra/.env and set APP_ENV=dev.)
```

### 3.2 Deploy (or simulate)

Either trigger a real CI deploy (push to `dev`, or
`Actions → Deploy to droplet → Run workflow` with `app_env=dev`), or
run `deploy.sh up` from your local machine:

```bash
cd deploy/
deploy.sh up
# Expect: the deploy banner includes:
#   [deploy] Building & starting the stack (APP_ENV=dev) ...
#   [deploy] docker compose ... up -d --build
#   ... and ultimately the api container becomes healthy.
```

### 3.3 The droplet's boot banner

```bash
# 3.3.1 SSH in and tail the api log
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml logs api | grep Bootstrap"
# Expect: a line like
#   [Bootstrap] API up — APP_ENV=dev (raw=dev), listening on 0.0.0.0:3000, CORS origins: https://web.aisztens.hu,https://admin.aisztens.hu
```

If `APP_ENV` is anything other than `dev`, investigate immediately —
this is the "still works on the legacy droplet" guarantee.

### 3.4 CORS list is the dev CORS, not the local one

```bash
# 3.4.1 The CORS list from the boot banner (above) should be EXACTLY:
#   https://web.aisztens.hu,https://admin.aisztens.hu
# If you see localhost URLs in there, the deploy picked up infra/.env.local by accident.
```

### 3.5 The CORS allow-list is enforced

```bash
# 3.5.1 From the web SPA origin (should pass)
curl -i -H "Origin: https://web.aisztens.hu" \
  https://api.aisztens.hu/api/callback-requests | head -10
# Expect: 200 + access-control-allow-origin: https://web.aisztens.hu

# 3.5.2 From the admin SPA origin (should pass)
curl -i -H "Origin: https://admin.aisztens.hu" \
  https://api.aisztens.hu/api/callback-requests | head -10
# Expect: 200 + access-control-allow-origin: https://admin.aisztens.hu

# 3.5.3 From the api origin itself (should NOT get CORS headers)
curl -i -H "Origin: https://api.aisztens.hu" \
  https://api.aisztens.hu/api/callback-requests | head -10
# Expect: 200) + NO access-control-allow-origin header (the dev CORS list
#   does not include api.aisztens.hu by design — see VAPI prompt history)
```

### 3.6 The deployed SPAs hit the dev API URL

```bash
# 3.6.1 The web SPA's baked-in URL
ssh deployer@aisztens.hu "grep -l aisztens.hu /srv/web/assets/*.js 2>&1 | head -1"
# Expect: at least one .js file path

# 3.6.2 The admin SPA's baked-in URL
ssh deployer@aisztens.hu "grep -l aisztens.hu /srv/admin/assets/*.js 2>&1 | head -1"
# Expect: at least one .js file path

# 3.6.3 Confirm the URL is the dev one (not localhost)
curl -fsS https://web.aisztens.hu/ | grep -oE 'aisztens.hu|localhost' | sort -u
# Expect: only 'aisztens.hu' appears
```

### 3.7 Smoke tests

```bash
# 3.7.1 Run the full smoke suite against the live stack
ssh deployer@aisztens.hu "cd /opt/aisztens && bash scripts/test/stack-smoke.sh"
# Expect: 4 liveness + 6 cross-service checks all PASS.
#   (If stack-smoke.sh is missing on the droplet, that itself is a
#   problem — deploy.sh is supposed to ship scripts/test/ along with the
#   rest of the repo. Re-run deploy.sh.)
```

### 3.8 The legacy infra/.env fallback still works

The dev droplet's `/opt/aisztens/infra/.env` predates the rename. After
the first deploy with this plan, deploy.sh copies the local
`infra/.env.dev` to the droplet's `infra/.env` (the deploy destination
is unchanged). Verify the file on the droplet:

```bash
ssh deployer@aisztens.hu "wc -l /opt/aisztens/infra/.env"
# Expect: ≥30 lines (the full infra/.env.example has 100+ lines; the
#   per-env file is a subset).

ssh deployer@aisztens.hu "head -3 /opt/aisztens/infra/.env"
# Expect: DOMAIN=aisztens.hu + ACME_EMAIL=... on the next line.
```

---

## 4. Prod env verification (droplet, ~15 minutes) `[if-prod-exists]`

Skip this entire section until a prod droplet exists. The deploy.yml
matrix is dormant by design — pushing nothing triggers a prod deploy.

The day the prod droplet is provisioned:

1. Add `DROPLET_HOST_PROD` and `DROPLET_SSH_KEY_PROD` GitHub Secrets
   (the current single-`DROPLET_HOST` secret is the dev one).
2. Wire the `deploy.yml` matrix to pick the prod pair when
   `inputs.app_env == 'prod'`. (One PR; ~15 lines.)
3. Set `INFRA_ENV_PROD` to a fresh per-env file: `infra/.env.prod`
   with `<prod-domain>` replaced by the real apex and all secrets unique
   (NOT a copy of `infra/.env.dev`).
4. Add a manual-reviewer protection rule on the GitHub `production`
   environment.
5. Trigger via **Actions → Deploy to droplet → Run workflow →
   app_env=prod**. The push-to-`dev` path cannot accidentally target prod.

### 4.1 The prod-only fail-closed guard

```bash
# 4.1.1 The api boot banner's APP_ENV label must be 'prod'
ssh deployer@<prod-host> "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml logs api | grep Bootstrap"
# Expect: [Bootstrap] API up — APP_ENV=prod (raw=prod), listening on 0.0.0.0:3000, CORS origins: https://web.<prod-domain>,https://admin.<prod-domain>

# 4.1.2 Empty CORS_ORIGINS in prod refuses to start.
# (You cannot test this on a live prod droplet without breaking it.
#  Smoke-test on a fresh staging droplet instead.)
ssh deployer@<staging-host> \
  "cd /opt/aisztens && CORS_ORIGINS= APP_ENV=prod docker compose \
   --env-file infra/.env.dev -f infra/docker-compose.yml up -d --build api"
# Then tail the api log:
ssh deployer@<staging-host> "cd /opt/aisztens && \
  docker compose logs api 2>&1 | grep -E 'Bootstrap|Refusing'"
# Expect: [Bootstrap] CORS_ORIGINS is empty in prod. Refusing to start with an open CORS policy.
#   and the api container exits with code 1 (so compose marks it Restarting).
```

### 4.2 CORS list is the prod CORS

```bash
# 4.2.1 CORS allows the prod web origin
curl -i -H "Origin: https://web.<prod-domain>" \
  https://api.<prod-domain>/api/callback-requests | head -10
# Expect: 200 + access-control-allow-origin: https://web.<prod-domain>

# 4.2.2 CORS rejects (or empty) a dev origin — the two CORS lists MUST differ
curl -i -H "Origin: https://web.aisztens.hu" \
  https://api.<prod-domain>/api/callback-requests | head -10
# Expect: 200 + NO access-control-allow-origin header (dev origin NOT in
#   prod CORS list; a browser would block the request).
```

### 4.3 The prod env file is NOT loaded in dev

```bash
# 4.3.1 On the dev droplet, the api's APP_ENV must still be dev
ssh deployer@aisztens.hu "cd /opt/aisztens && \
  docker compose --env-file infra/.env -f infra/docker-compose.yml exec api printenv APP_ENV"
# Expect: dev
```

---

## 5. CI workflow verification (no droplet, ~5 minutes)

```bash
# 5.1 The workflow file passes a YAML parser (Step 4 re-check)
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml').read()); print('YAML_OK')"
# Expect: YAML_OK

# 5.2 The INFRA_ENV_DEV / INFRA_ENV_PROD secrets are wired correctly
grep -E 'INFRA_ENV_(DEV|PROD)' .github/workflows/deploy.yml
# Expect: at least one line referencing each (the env: at the top of the
#   render-from-secret step).

# 5.3 workflow_dispatch has the app_env input
grep -A 8 'workflow_dispatch:' .github/workflows/deploy.yml
# Expect: app_env input declared with options dev and prod, default dev.

# 5.4 Every docker compose --env-file is now parameterized
git grep -nE 'docker compose --env-file infra/\.env(?!/)' \
  .github/workflows/deploy.yml
# Expect: empty (only the parameterized form `"infra/.env.\$APP_ENV"` remains).

# 5.5 The build step uses --mode
grep -n 'build:${APP_ENV}' .github/workflows/deploy.yml
# Expect: at least one line (the web SPA build call).

# 5.6 The 'up' SSH call exports APP_ENV
grep -B 1 -A 4 'docker compose \\$' .github/workflows/deploy.yml
# Expect: the 'up' command is `APP_ENV="$APP_ENV" docker compose ...` (the
#   belt-and-braces export).
```

---

## 6. End-to-end timing

For a fresh repo state on a developer machine with a fast SSD:

| Section | Estimated wall time |
|---|---|
| §1 Repo checks | 30 s |
| §2 Local (full down/up cycle + curl probes) | 5–10 min (dominated by the first `docker compose up -d --build` cold-start) |
| §3 Dev (deploy + smoke + curl) | 10–15 min (dominated by `pnpm install` + `pnpm build:dev` for web + admin) |
| §4 Prod | same as §3, only on the prod host |
| §5 CI | 30 s |

For an incremental change on the dev droplet (no SPAs rebuilt, just
env + secrets), §3 takes ~2 min.

---

## 7. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| §1b: any per-env file is committed | The gitignore patterns are missing | Re-run `git check-ignore -v infra/.env.local` to see which pattern matches; if none, the Step 0 commit was lost — re-apply. |
| §2.3: banner reports `dev` or unset instead of `local` | `APP_ENV` is leaking from the shell | `unset APP_ENV` then re-run `scripts/dev-stack.sh up`. |
| §2.5.1: CORS preflight returns 200 instead of 204 | Wrong FastifyAdapter CORS setup | The `main.ts:34` block uses `credentials: true` with an explicit allow-list — should be fine; check `apps/api/.env.local`. |
| §2.7.2: the inserted row is missing | The Postgres volume was wiped between runs | Re-run §2.4.3 and §2.7.1. |
| §3.3: banner reports `local` or unset on the dev droplet | deploy.yml didn't pass APP_ENV; the deploy.sh `app_env=dev` fell through to `infra/.env` (legacy) and `local_infra_env` resolution was wrong | Check `deploy/deploy.sh` for `APP_ENV=${APP_ENV:-dev}` and the `local_infra_env` block. Re-run `deploy.sh up`. |
| §3.5.3: CORS DOES allow `https://api.aisztens.hu` | The CORS list in `infra/.env.dev` was edited incorrectly | Verify with `ssh deployer@aisztens.hu "grep ^CORS_ORIGINS /opt/aisztens/infra/.env"` — must NOT have `api.aisztens.hu`. |
| §3.6.3: SPA also references `localhost` | An SPA `.env.dev` file got the wrong content | Verify with `ssh deployer@aisztens.hu "cat /opt/aisztens/apps/web/.env.dev"` — must contain `https://api.aisztens.hu/api`. |
| §4.1.2: the api boot does NOT refuse with empty CORS | `apps/api/src/main.ts:42` isProd check is missing | The Step 2 commit `a054d0e` was lost — re-apply. |
| §5.4: a straggler `infra/.env` (no qualifier) survives | A new SSH step was added without the substitution | Update the new step to use `"infra/.env.$APP_ENV"`. |

---

## 8. Verifying a fresh checkout vs. an existing deployment

The verification above is written assuming a "fresh" mental model. For
a real-world check:

| Scenario | Sections to run |
|---|---|
| Pulled latest `main`, never ran anything | §1, §2 |
| Pulled latest `main`, local stack is up | §1, §2.4, §2.5, §2.6, §2.7 (skip §2.1–§2.3, §2.8) |
| Dev deploy happened | §1.5, §1.6, §1.7, §3 |
| Prod deploy happened | §1.5, §1.6, §1.7, §4 |
| Wrote a code change | §1, §2 (if local), §3 (if prod) — §1.6 (§1.7) is a fast guard against shipping a bash syntax error |

---

## 9. See also

- [`docs/Specs/Local-Development.md`](Local-Development.md) — the developer-side workflow (`scripts/dev-stack.sh`, per-env files, `APP_ENV` propagation, pitfalls).
- [`docs/Specs/Production-Runbook.md`](Production-Runbook.md) — what to do once the stack is on the droplet.
- [`deploy/README.md`](../../deploy/README.md) — the deploy-side runbook (secrets table, workflow steps, `APP_ENV` matrix).
- [`docs/history/2026-10-05--10-30-00-three-env-separation-plan.md`](../history/2026-10-05--10-30-00-three-env-separation-plan.md) — the plan document.
- [`docs/history/2026-10-05--10-30-00-three-env-separation-step{0..5}.md`](../history/) — per-commit history entries.