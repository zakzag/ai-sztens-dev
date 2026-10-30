# 2026-10-11 23:59 — deploy.yml parse failure (3 errors) fix

## Problem

Live `https://api.aisztens.hu/healthz` returned `{"status":"ok"}` even though the
source on `main` (commit `f6c76bc "new test of full deploy and image"`) had been
changed to return `{"status":"oks"}` over a week ago. The web SPA still showed
the old home-page heading and the admin login button still said `Login (Belépés)`.
All four application services on the droplet were pinned to `sha-3a8f5b6`, the
SHA produced by the parent commit `3a8f5b6 "deply.yml change"`.

## Investigation timeline

1. The user originally thought the changes were not committed. Verified that:
   - `git status` is clean on `main`.
   - Commit `f6c76bc` introduces exactly the six expected source files
     (HealthController + spec, e2e test, HomePage, LoginPage).
2. The user then opened a PR merging `main` → `dev` (PR #6, merge commit
   `c0d7293`). This triggered `images.yml` and `deploy.yml` on the `dev` push.
3. `images.yml` ran successfully (~3 min) and published
   `ghcr.io/zakzag/aisztens-{api,web,admin,monitor}:sha-c0d7293` to GHCR.
4. `deploy.yml` failed immediately with **"Invalid workflow file"**:
   - **Line 220, Col 13**: `Unrecognized named-value: 'secrets'` —
     `if: ${{ secrets.GHCR_PAT != '' }}`. The `secrets` context is not
     available inside `if:` expressions in GitHub Actions.
   - **Line 232, Col 9**: `'env' is already defined` — the GHCR login step
     had two `env:` blocks. The second one silently overrode the first
     (which only contained `REMOTE_DIR`), but GitHub's parser rejects
     duplicate keys at the same level.
   - **Line 279, Col 9**: `Required property is missing: uses` — the
     "Verify every service is running IMAGE_TAG" step opened an `env:`
     block and an `with:` block but had no `uses:` line, so the parser
     could not tell it was an `appleboy/ssh-action` call.
5. Net effect: the entire workflow file was rejected, **no job ever ran**,
   and the droplet was left running `sha-3a8f5b6` (the only successful
   deploy ever, from the previous PR).

## Fix

Three surgical edits in `.github/workflows/deploy.yml`:

1. **GHCR login step (lines 219-240)** — removed `if: ${{ secrets.GHCR_PAT
!= '' }}`; merged the two `env:` blocks into a single one containing
   `REMOTE_DIR`, `GHCR_PAT`, and `GITHUB_ACTOR`; added an internal shell
   guard `if [ -z "${GHCR_PAT:-}" ]` that exits 0 when the secret is empty
   (public-repo case where anonymous `docker pull` is sufficient).
2. **Verify-tag step (line 287)** — added `uses: appleboy/ssh-action@v1.0.3`
   to make it a valid action step.

The new YAML parses cleanly (verified with `python -c "yaml.safe_load(...)"`).

## What is NOT yet done

- The fix has been **written to the working tree only**, not committed and
  not pushed. Pushing to `dev` will re-trigger `images.yml` (a no-op rebuild
  is fine — the SHA-tagged image is already in GHCR) and then `deploy.yml`
  for the first time since the workflow was broken.
- Per user instruction, the admin button text was **not** changed to
  `Login (Bejelentkezés)`. The source still says `Login (Belépés)` and
  the live site will reflect that after the next deploy.
- After pushing the fix and confirming the next deploy turns green, the
  droplet should be at `sha-c0d7293` (the image already in GHCR), and
  `https://api.aisztens.hu/healthz` should return `{"status":"oks"}`.

## Verification commands for the next operator

```bash
# 1. Push the fix
git add .github/workflows/deploy.yml
git commit -m "fix(ci): repair deploy.yml workflow-file parse errors (GHCR if, env, uses)"
git push origin dev

# 2. Watch the deploy run green
#    https://github.com/zakzag/ai-sztens-dev/actions

# 3. After it completes:
curl -s https://api.aisztens.hu/healthz
# Expected: {"status":"oks","uptime":N,"timestamp":"..."}
docker compose --env-file infra/.env -f infra/docker-compose.yml ps \
  --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
# Expected: 4 services on sha-c0d7293
```
