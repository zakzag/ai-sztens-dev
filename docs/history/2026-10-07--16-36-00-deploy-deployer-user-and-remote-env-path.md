# 2026-10-07 16:36 — local deploy switches to `deployer`; both deploy paths agree on `infra/.env`

**Status:** implemented and verified live against the dev droplet.
**Plan:** [`docs/history/2026-10-07-deploy-deployer-user-plan.md`](2026-10-07-deploy-deployer-user-plan.md).
**Milestone:** [`docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md`](../milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md).

> **Requested change.** "No, please use `deployer` not `root` for deployment." The CI already
> used `deployer` in all seven steps; the **local** `deploy.sh` was the outlier. This also
> restores the intent recorded on 2026-09-23 ("after bootstrap, switch `SSH_USER` to `deployer`").

---

## 1. Measured evidence

| # | Check | Result |
|---|---|---|
| 1 | `deploy.sh ps dev` before this change | authenticated as `root`, then aborted: `couldn't find env file: /opt/aisztens/infra/.env.dev` — **every** remote compose command (`ps`, `logs`, `up`, `down`, `restart`) was dead |
| 2 | Cause | [`deploy.sh:396`](../../deploy/deploy.sh) built `COMPOSE_ARGS="--env-file infra/.env.${APP_ENV} …"` and executed it **on the droplet**, where the upload deliberately lands the file as `infra/.env` |
| 3 | Mirror-image bug in CI | step 3 scp'd to `target: $REMOTE_DIR/infra/.env` while steps 5/6/8 asked for `--env-file "infra/.env.$APP_ENV"` |
| 4 | Droplet state (root SSH) | `/opt/aisztens` = `tkovari:tkovari 777`; `/opt/aisztens/infra/.env` is a **file** (2721 B, `755 root:root`), no stray `.env/` directory; `deployer` has **no** passwordless sudo (`/etc/sudoers.d/` has only `90-cloud-init-users` for `root`) |
| 5 | `deploy.sh up dev` on the previous HEAD | would have died with `app: unbound variable` at the upload (see §3.1) — never reached in production because only `ps` was exercised recently |

---

## 2. What changed

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | `SSH_USER` defaults to `deployer`; header/usage gained an IDENTITY + REMOTE PATHS block; `COMPOSE_ENV_FILE_LOCAL` (per-env **source**) split from `COMPOSE_ENV_FILE_REMOTE` (`infra/.env`) and `COMPOSE_ARGS` now names the remote path; new `assert_remote_ready()` preflight; `bootstrap` refuses to run as a user without `sudo -n`; `ensure_spa_env()` bug fixed |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Render step writes `infra/.env`; step 3 scp's `source: infra/.env` into `target: …/infra`; the five `--env-file` occurrences in steps 5/6/8 are `"infra/.env"`; header/secrets comments rewritten |
| [`deploy/.env.example`](../../deploy/.env.example) | `SSH_USER=deployer`, `SSH_KEY=./deploy/ssh-keys/deploy.private.key`, comments explain the single exception (`bootstrap`) and the writability requirement |
| `deploy/.env.dev` (gitignored) | Same two values; verified intact after the live tests |
| [`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md) | "The deploy key" section rewritten for the rename and the shared `deployer` identity |
| [`deploy/README.md`](../../deploy/README.md) | §1/§2 (`bootstrap` = the one root-only step, the ownership probe + fix), §8.1 secrets row, §8.2 step list (`infra/.env`), §8.4 limitations |
| [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md) | Header note; §1d rewritten into the real invariant (local per-env source ⇄ remote `infra/.env`); §1f2 (offline suites); §3.2; §3.8; §5.4; four new §7 rows |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md), [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | `ssh root@` examples became `deployer@`, with the root-only exceptions spelled out; "Utolsó frissítés" refreshed |
| [`scripts/README.md`](../../scripts/README.md), [`scripts/test/README.md`](../../scripts/test/README.md) | `test/` now documents the offline `_deploy-sh-*` suites; new table describing each one |
| `scripts/test/_deploy-sh-remote-compose-path-test.sh` (new) | Offline regression suite: stub `ssh`/`scp`/`rsync`/`pnpm` on `PATH`, 6 scenarios, **32 assertions, all green** |
| `scripts/test/_deploy-sh-env-selection-test.sh` | Fixtures updated to `SSH_USER=deployer` |

### The deploy key was renamed

`deploy/ssh-keys/root.private.key` → **`deploy/ssh-keys/deploy.private.key`** (approved at
review; the key is now used only as `deployer`). The GitHub secret holds key *material*, so it
needed no change; `.gitignore`'s `*.private.key` still covers the file. Public half:
`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3 aisztens.hu-root-no-passphrase`.

---

## 3. Three bugs found while implementing

### 3.1 `ensure_spa_env()` aborted every upload (`app: unbound variable`)

```bash
local app="$1" mode="$2" env_file="$REPO_DIR/apps/$app/.env.$mode"   # broken
```

bash expands **every word** of a command before the builtin runs, so `$app` was still unset at
expansion time and `set -u` aborted the script. This was latent on `HEAD` — `deploy.sh up dev`
could not have completed — and the new offline suite caught it in scenario 3. Fixed by one
`local` per line, with a comment so it does not regress. (The same trap had already been fixed
in `scripts/env-test/check-env-syntax.sh` earlier the same day.)

### 3.2 The preflight's first version was a silent no-op

The first live run (WSL) reported `Preflight OK — /root/aisztens-preflight-test is writable`
for a directory the user cannot write: the SSH client had refused the key **before the probe
ran**, and "no evidence of failure" was read as success. The guard now passes **only** on an
explicit `WRITABLE` marker, and it distinguishes three cases (see §4).

### 3.3 WSL cannot be used to run the deploy

`bash` in this workspace is **WSL**, and `/mnt/e` is mounted as 9p **without metadata**, so
every file reports `0777`; `chmod` is a no-op and OpenSSH refuses the key:

```
Permissions 0777 for './deploy/ssh-keys/deploy.private.key' are too open.
```

Git for Windows is installed (at `C:\Progs\Git`, not `C:\Program Files\Git`), and its bash
sees the real ACL — `deployer@ssh.aisztens.hu` logs in and `id -Gn` returns
`deployer sudo docker`. Verified live with:

```bash
"C:\Progs\Git\bin\bash.exe" deploy/deploy.sh ps dev
```

The preflight now prints that guidance when it sees the OpenSSH wording.

---

## 4. Verification (all commands actually run)

```bash
# Offline, no droplet: 32 / 29 / 10 / ALL_OK green
"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-remote-compose-path-test.sh   # 32 passed, 0 failed
"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-env-selection-test.sh        # 29 passed, 0 failed
"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-logger-test.sh               # 10 passed, 0 failed
"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-m1-test.sh                   # ALL_OK
"C:\Progs\Git\bin\bash.exe" scripts/env-test/check-env-syntax.sh                 # passed=41 failed=0

# Identity: the key logs in as the least-privilege account
"C:\Progs\Git\bin\bash.exe" -c "ssh -i deploy/ssh-keys/deploy.private.key \
  -o IdentitiesOnly=yes deployer@ssh.aisztens.hu 'id -un; id -Gn'"
# → deployer / deployer sudo docker

# The blocking bug, fixed end to end (exit=0)
"C:\Progs\Git\bin\bash.exe" deploy/deploy.sh ps dev
# → aisztens-api-1 Up 2 hours (healthy); caddy Up (80/443); monitor Up; postgres Up (healthy)
#   footer: ===== finished: exit=0 duration=6s log=…/deploy-20261007-162721-ps-dev.log =====

# The preflight's failure path, against the real droplet (REMOTE_DIR overridden to
# /root/aisztens-preflight-test, restored by the script's EXIT trap; no upload happened)
"C:\Progs\Git\bin\bash.exe" scripts/test/_tmp-preflight-live-check.sh
# → exit=1, "deployer@ssh.aisztens.hu cannot write /root/aisztens-preflight-test
#    (owner:group mode = stat: cannot statx …: Permission denied)" + the chown one-liner
#   (the temporary helper was deleted afterwards; `dir scripts\test` confirms it)
```

Log trail: [`deploy/log/deploy-20261007-162721-ps-dev.log`](../../deploy/log/) — `SSH_USER=deployer`,
`env file: local source infra/.env.dev -> remote infra/.env (APP_ENV=dev)`.

---

## 5. Pre-existing issues found, deliberately not fixed

| Issue | Detail |
|---|---|
| `_deploy-sh-m3-test.sh` always fails | It re-implements the *pre-per-env* `infra/.env` lookup in a local function (never calling `deploy.sh`) and this checkout has only `infra/.env.dev`. Recorded in `Three-Env-Verification.md` §7. |
| `_deploy-sh-env-selection-test.sh` scenario 6 is flaky | The assertion greps `deploy/log/latest.log` right after a run that aborts on the empty `HOST`, racing the `tee`/`latest.log` refresh: **28/1 under WSL, 29/0 under Git Bash** for the same commit, and 28/1 on pre-change `HEAD` — not a regression, but it should read the per-run file. |
| `/opt/aisztens` is `777` | World-writable. The preflight passes, but the operator should run `chown -R deployer:deployer /opt/aisztens`. |
| `/opt/aisztens/infra/.env` is `755 root:root` | A secret file that is world-readable; `chmod 600` is recommended. |
| `docs/history/*`, `docs/milestones/*` | Left as the historical record; only the living docs were updated. |

---

## 6. Recommended commit message

```text
feat(deploy): deploy as `deployer` and use infra/.env on the droplet

Both deploy paths now share one identity and one remote env-file path:
local deploy.sh and GitHub Actions log in as `deployer` (the CI already
did) and every remote `docker compose` runs with `--env-file infra/.env`
— the droplet hosts one environment, so the per-env name exists only
locally, as the source (`infra/.env.${APP_ENV}`).

That last point was a live bug: deploy.sh executed the local per-env name
on the droplet, so ps/logs/up/down/restart all died with
"couldn't find env file: /opt/aisztens/infra/.env.dev". The CI had the
mirror image of it (scp target vs. --env-file).

Also:
* assert_remote_ready(): preflight that proves REMOTE_DIR is writable
  before the first rsync, passing only on an explicit WRITABLE marker —
  a refused SSH connection must never read as success (it did in the
  first version, under WSL).
* `bootstrap` is now the one root-only command, and it says so instead
  of half-uploading a tree.
* fix a latent `local a="$1" b="$a"` unbound-variable bug in
  ensure_spa_env() that broke every upload.
* rename the deploy key to deploy/ssh-keys/deploy.private.key.
* new offline suite scripts/test/_deploy-sh-remote-compose-path-test.sh
  (32 assertions) plus refreshed living docs and an updated
  Three-Env-Verification spec.

Verified live: deployer@ssh.aisztens.hu, `deploy.sh ps dev` exit=0.
```
