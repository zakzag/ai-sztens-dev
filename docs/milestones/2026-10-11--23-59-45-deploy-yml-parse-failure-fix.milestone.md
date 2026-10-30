# Milestone — deploy.yml parse-failure fix (2026-10-11)

## 1. Problem / feature

Live droplet kept running an old image even though commits with the new
strings (`status: 'oks'`, `Még ma!` h1, `Login (Belépés)` button) had
been merged into `dev` via PR #6. Users saw stale UI/API on
`https://api.aisztens.hu`, `https://web.aisztens.hu`, and
`https://admin.aisztens.hu` after the build was "successfully" triggered.

## 2. Measured data / evidence

| Probe                                   | Result                                                                                                                          | Meaning                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `curl https://api.aisztens.hu/healthz`  | `{"status":"ok"}`                                                                                                               | Live API has the old code.     |
| `docker compose ps` on droplet          | All 4 app services on `sha-3a8f5b6`                                                                                             | Old SHA, never updated.        |
| `ghcr.io/zakzag/aisztens-*:sha-c0d7293` | Image exists in GHCR                                                                                                            | Build **did** succeed.         |
| `images.yml` run #11 (push c0d7293)     | `success` (3m 8s)                                                                                                               | Image push OK.                 |
| `deploy.yml` run #13 (push c0d7293)     | `failure` (instant)                                                                                                             | **Workflow file parse error.** |
| GitHub error message                    | "Line 220: Unrecognized named-value 'secrets'; Line 232: 'env' is already defined; Line 279: Required property missing: `uses`" | Three concrete YAML issues.    |

## 3. Root cause

`.github/workflows/deploy.yml` had three independent syntax problems that
made GitHub reject the entire workflow file on every push since the
`image.yml fix` series (~2026-09-25 onward). Because the file is rejected
at load time, no job ever started and no step ever ran — the droplet
remained on the last successful deploy (`sha-3a8f5b6`, from the
`3a8f5b6 "deply.yml change"` commit).

`images.yml` was unaffected by these problems and was happily publishing
images that no deploy job was ever going to consume.

## 4. Solution / implementation

Single file edited: `.github/workflows/deploy.yml`. Three minimal edits:

| Bug                          | Old                                                         | New                                                                                                          |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| L220 invalid `if: secrets.*` | `if: ${{ secrets.GHCR_PAT != '' }}`                         | Removed; conditional moved into the step's `command:` shell as `if [ -z "${GHCR_PAT:-}" ]; then exit 0; fi`. |
| L222+L232 duplicate `env:`   | Two `env:` blocks (REMOTE_DIR; then GHCR_PAT, GITHUB_ACTOR) | One merged `env:` block with REMOTE_DIR, GHCR_PAT, GITHUB_ACTOR.                                             |
| L279 missing `uses:`         | Step has `id`, `env:`, `with:` but no `uses:`               | Added `uses: appleboy/ssh-action@v1.0.3`.                                                                    |

File now parses with `python -c "yaml.safe_load(...)"`. No source code,
no Docker image, no infra-as-code changed — this is a pure CI definition
fix.

## 5. Outcome and how to verify

To complete the fix, the change must be committed and pushed to `dev`:

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): repair deploy.yml parse errors (secrets if, dup env, missing uses)"
git push origin dev
```

Then on the GitHub Actions page (`zakzag/ai-sztens-dev/actions`):

- `images.yml` run should go green (~3 min) and push a fresh `sha-<7>`.
- `deploy.yml` run should go green (~1-2 min after `images.yml` via
  the `workflow_run` trigger, OR immediately if the push is direct).
- The "Dump container logs on failure" step will not run.
- Smoke test step should report pass.

Live verification on the droplet:

```bash
curl -s https://api.aisztens.hu/healthz
# expected: {"status":"oks","uptime":N,"timestamp":"..."}

cd /opt/aisztens
docker compose --env-file infra/.env -f infra/docker-compose.yml ps \
  --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
# expected: 4 app services on the new sha-<7>, all "Up ... (healthy)" or "Up ..."
```

## 6. Follow-ups

- **Admin button text**: source still says `Login (Belépés)` but the user
  asked for `Login (Bejelentkezés)`. Per instruction, this was deferred
  to a separate change so the deploy-yml fix can ship independently.
- **Process hardening (recommended)**: the failure was silent for
  ~2 weeks because a malformed workflow file produces an instant
  "Invalid workflow file" failure that the operator has to look at the
  Actions tab to discover. Consider a branch-protection rule that
  requires the `deploy.yml` workflow to be green (or at least
  "success/skipped") before merging to `dev`, or a CI step that
  validates `*.yml` with `actionlint` before the workflow ever runs.
- **Mirror workflows to `prod`**: the same `deploy.yml` is used for
  prod via `workflow_dispatch inputs.app_env=prod`. The fix is
  therefore also a prerequisite for any future prod deploy — verify
  the same content lives on `prod` branch before next prod push.
