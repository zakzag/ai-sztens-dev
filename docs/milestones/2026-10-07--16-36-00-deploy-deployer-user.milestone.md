# Milestone — deploy runs as `deployer`, and both deploy paths agree on `infra/.env`

**Date:** 2026-10-07 16:36 (Europe/Budapest) · **Author:** code mode (Zoo)
**Narrative:** [`docs/history/2026-10-07--16-36-00-deploy-deployer-user-and-remote-env-path.md`](../history/2026-10-07--16-36-00-deploy-deployer-user-and-remote-env-path.md) · **Plan:** [`…-deploy-deployer-user-plan.md`](../history/2026-10-07-deploy-deployer-user-plan.md)

## 1. Problem / feature

The local deploy logged in as `root`. The requester wanted the least-privilege `deployer`
account — the one GitHub Actions has always used — for the local path too. While doing that,
the deploy turned out to be **broken independently of any key change**.

## 2. Measured data / evidence

| # | Check | Result |
|---|---|---|
| 1 | `deploy.sh ps dev` (before) | authenticated as `root`, then `couldn't find env file: /opt/aisztens/infra/.env.dev` — `ps`, `logs`, `up`, `down`, `restart` were **all** dead |
| 2 | Cause | `COMPOSE_ARGS` named the local per-env file but was executed **on the droplet**, where the upload lands the file as `infra/.env` |
| 3 | CI had the mirror bug | scp target `…/infra/.env` vs. `--env-file "infra/.env.$APP_ENV"` in steps 5/6/8 |
| 4 | Droplet (root SSH) | `/opt/aisztens` `tkovari:tkovari 777`; `infra/.env` is a file (2721 B, `755 root:root`); `deployer` has **no** passwordless sudo |
| 5 | `deploy.sh up dev` on pre-change HEAD | would die at `app: unbound variable` in `ensure_spa_env()` — latent, never reached because only `ps` was exercised |
| 6 | First live preflight run | printed `Preflight OK` for `/root/…` although the key was refused before the probe ran — a silent no-op |
| 7 | WSL vs. the key | WSL's `/mnt/e` is 9p without metadata → the key shows `0777`, `chmod` is a no-op, OpenSSH refuses it |

## 3. Root cause / design rationale

* **Two names for one thing.** A droplet hosts exactly one environment, so its runtime env file
  is always `infra/.env`; the per-env name is a *local source* name. Four consumers already
  assumed that (`stack-smoke.sh`, `check-env-live.sh`, `deploy/README.md` §3, the droplet's own
  disk); only the remote `COMPOSE_ARGS` disagreed, and the CI disagreed with itself.
* **Identity.** `deployer` (docker group + sudo) can do everything the deploy needs — `docker
  compose`, rsync/scp into the tree — so root is required only for the one-off `bootstrap`.
* **Guards must demand positive evidence.** "Nothing looked wrong" is not success: a refused
  SSH connection produces no output at all, so the preflight passes only on an explicit
  `WRITABLE` marker. Alternatives considered: chowning `/opt/aisztens` in a wrapper script
  (rejected — the operator may be on Windows), or prefixing remote commands with `sudo`
  (rejected — no passwordless sudo exists for `deployer`).

## 4. Solution / implementation

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | `SSH_USER` defaults to `deployer`; `COMPOSE_ENV_FILE_LOCAL` (source) split from `COMPOSE_ENV_FILE_REMOTE` (`infra/.env`); `assert_remote_ready()` preflight; `bootstrap` requires `sudo -n`; `ensure_spa_env()` `set -u` fix |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | renders `infra/.env`, scp's it into `…/infra`, and every compose step uses `--env-file infra/.env`; comments rewritten |
| [`deploy/.env.example`](../../deploy/.env.example), `deploy/.env.dev` | `SSH_USER=deployer`, `SSH_KEY=./deploy/ssh-keys/deploy.private.key` |
| [`deploy/README.md`](../../deploy/README.md), [`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md) | identity model, the root-only `bootstrap`, the ownership probe + fix, the key rename |
| `scripts/test/_deploy-sh-remote-compose-path-test.sh` (new) | 32 offline assertions: identity, remote env-file path, preflight pass / not-writable / mkdir-refused / probe-never-ran |
| [`docs/Specs/Three-Env-Verification.md`](../../docs/Specs/Three-Env-Verification.md), [`Production-Runbook.md`](../../docs/Specs/Production-Runbook.md), [`Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md), [`scripts/*/README.md`](../../scripts/README.md) | living docs updated (`root@` examples → `deployer@`, the local-source ⇄ remote-path invariant, new failure modes) |

The deploy key was renamed `root.private.key` → **`deploy.private.key`** (the secret holds key
*material*, so nothing had to be rotated).

## 5. Outcome and how to verify

```bash
# run the deploy from Git Bash (WSL cannot chmod /mnt/e; the script says so)
"C:\Progs\Git\bin\bash.exe" deploy/deploy.sh ps dev
# → exit=0, container table: api Up (healthy), caddy Up, monitor Up, postgres Up (healthy)

"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-remote-compose-path-test.sh   # 32 passed, 0 failed
"C:\Progs\Git\bin\bash.exe" scripts/test/_deploy-sh-env-selection-test.sh        # 29 passed, 0 failed
"C:\Progs\Git\bin\bash.exe" scripts/env-test/check-env-syntax.sh                 # passed=41 failed=0
```

Log proof: `deploy/log/deploy-20261007-162721-ps-dev.log` records `SSH_USER=deployer` and
`env file: local source infra/.env.dev -> remote infra/.env (APP_ENV=dev)` (footer `exit=0`).

## 6. Follow-ups

* **Operator, once:** `chown -R deployer:deployer /opt/aisztens` (it is `777` today) and
  `chmod 600 /opt/aisztens/infra/.env` (world-readable secret).
* **CI:** set the `DROPLET_SSH_KEY` secret and run the workflow once to exercise the corrected
  scp target and `--env-file infra/.env` end to end.
* **Tests:** `_deploy-sh-m3-test.sh` is stale (it re-implements the pre-per-env lookup and
  needs a legacy local `infra/.env`); `_deploy-sh-env-selection-test.sh` scenario 6 is flaky
  (28/1 under WSL, 29/0 under Git Bash, and 28/1 on pre-change HEAD — it races
  `latest.log`). Both are recorded in `Three-Env-Verification.md` §7.
* **Full deploy drill:** `deploy.sh up dev` was not re-run in this session; `ps` proves the
  remote compose path, but a complete `up` (rsync + SPA build + image rebuild) is still worth
  one run, together with the CI workflow.
* The one-off `bootstrap` path was not re-exercised (it requires root and is not part of the
  day-to-day loop).
