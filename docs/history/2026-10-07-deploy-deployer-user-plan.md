# Plan — deploy as `deployer` instead of `root` (local + CI)

**Date:** 2026-10-07
**Status:** awaiting approval
**Scope:** [`deploy/deploy.sh`](../../deploy/deploy.sh:1), [`deploy/.env.example`](../../deploy/.env.example:1), `deploy/.env.dev` (gitignored), [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1), `deploy/README.md`, [`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md:1), `docs/Specs/*`, plus one new offline regression test.

> **Requested change.** "Please use `deployer` not `root` for deployment." The GitHub Actions workflow already logs in as `deployer` in all 7 steps; the **local** deploy is the one still using `root`. This also restores the intent recorded in [git-history 2026-09-23](../../docs/history/2026-09-23--19-16-40-ssh-key-config-in-deploy-sh.md:72) ("after bootstrap switches `SSH_USER` to `deployer`").

---

## 1. Evidence gathered before writing this plan

| # | Check | Result | Source |
|---|---|---|---|
| 1 | Local deploy login user | `SSH_USER=root` with `SSH_KEY=./deploy/ssh-keys/root.private.key` | [`deploy/.env.example:32`](../../deploy/.env.example:32), `deploy/.env.dev` |
| 2 | `deploy.sh` default when the env file omits it | `SSH_USER="${SSH_USER:-root}"` | [`deploy/deploy.sh:338`](../../deploy/deploy.sh:338) |
| 3 | Remote compose command built by `deploy.sh` | `--env-file infra/.env.${APP_ENV}` — i.e. `infra/.env.dev`, evaluated **on the droplet** | [`deploy/deploy.sh:385`](../../deploy/deploy.sh:385) |
| 4 | Reality on the dev droplet | `couldn't find env file: /opt/aisztens/infra/.env.dev` — every remote compose call (`ps`, `logs`, `up`, `down`, `restart`) aborts. Measured live during the key-switch work, recorded in [`docs/history/2026-10-07--15-35-00-deploy-key-root-and-deployer.md`](2026-10-07--15-35-00-deploy-key-root-and-deployer.md:48) | measured |
| 5 | What the droplet actually has | one file, `/opt/aisztens/infra/.env` (2721 bytes, `755 root:root`) — no per-env name | [`docs/history/2026-10-02--20-42-00-infra-env-restore-and-monitor-watchdog.md`](2026-10-02--20-42-00-infra-env-restore-and-monitor-watchdog.md:51) |
| 6 | Three independent places that already assume the droplet path is `infra/.env` | smoke suite default ([`scripts/test/lib/00-prelude.sh:54`](../../scripts/test/lib/00-prelude.sh:54)), live env checks ([`scripts/env-test/check-env-live.sh:187`](../../scripts/env-test/check-env-live.sh:187)), README §3 ([`deploy/README.md:122`](../../deploy/README.md:122)) | code |
| 7 | CI: mirror-image bug | step 4 scp's the rendered file with `target: ${{ env.REMOTE_DIR }}/infra/.env` ([`deploy.yml:169`](../../.github/workflows/deploy.yml:169)) while steps 5/6/8 ask for `--env-file "infra/.env.$APP_ENV"` ([`deploy.yml:248`](../../.github/workflows/deploy.yml:248), [`272`](../../.github/workflows/deploy.yml:272), [`326`](../../.github/workflows/deploy.yml:326)) | code |
| 8 | Compose host bind mounts | only read-only ones (`./postgres/init:ro`, `./caddy/Caddyfile.rendered:ro`, the two SPA dist dirs `:ro`) plus the named volume `pgdata` — **no** host dir needs root ownership | [`infra/docker-compose.yml:88`](../../infra/docker-compose.yml:88) |
| 9 | `bootstrap` command needs root | runs `sudo bash deploy/bootstrap.sh` ([`deploy/deploy.sh:643`](../../deploy/deploy.sh:643)); `bootstrap.sh` itself asserts `id -u == 0` ([`deploy/bootstrap.sh:152`](../../deploy/bootstrap.sh:152)) | code |

Two facts are therefore settled by measurement, not preference:

* the droplet's env file is `infra/.env` (one environment per droplet) — so `deploy.sh`'s remote argument is wrong, not the droplet;
* the whole-tree write as a non-root user is what the CI has always tried to do, and it needs `/opt/aisztens` owned by that user.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | The local deploy logs in as **`deployer`** (`deploy/.env.dev`, `.env.example`, and the `deploy.sh` default) | one identity for both deploy paths; least privilege; the key is already authorised for `deployer` |
| D2 | `/opt/aisztens` is **owned by `deployer`** (one-time `chown` over root SSH) | rsync `--delete`, `mkdir -p` and `scp` all need write access to the tree; the CI has always done exactly this |
| D3 | `deploy.sh` gains a **remote preflight guard** that fails with the exact remediation command | the failure mode we hit was an opaque remote compose error; the guard turns it into a one-line fix |
| D4 | `bootstrap` stays a **root-only, run-once** operation, guarded with a clear message | it installs packages and creates users; it is not part of the day-to-day loop |
| D5 | The droplet keeps **one** env file: `infra/.env`. The **source** stays per-env: `infra/.env.${APP_ENV}` | matches the three existing consumers (item 6) and needs no droplet change, no downtime |
| D6 | CI keeps `username: deployer` and the same key | already correct; only its env-file path is fixed |

### Target flow

```mermaid
flowchart LR
    A[local: deploy.sh up dev] --> B[deployer@ssh.aisztens.hu]
    C[CI: deploy.yml] --> B
    B --> D[preflight: writable /opt/aisztens]
    D --> E[rsync repo + scp deploy/.env]
    E --> F[scp infra/.env.APP_ENV to infra/.env]
    F --> G[docker compose --env-file infra/.env up -d --build]
    H[one-time root ssh] --> I[chown -R deployer:deployer /opt/aisztens]
    I --> D
```

---

## 3. Changes

### 3.1 [`deploy/deploy.sh`](../../deploy/deploy.sh:1)

1. **Login default** — [`deploy.sh:338`](../../deploy/deploy.sh:338): `SSH_USER="${SSH_USER:-root}"` → `${SSH_USER:-deployer}`, with the comment updated to say why (a droplet bootstrapped by `bootstrap.sh` always has `deployer`, and the same identity is used by CI).
2. **Split local source from remote path** — [`deploy.sh:385-396`](../../deploy/deploy.sh:385): keep the existing local pick (`infra/.env.${APP_ENV}`, legacy `infra/.env` fallback) as `COMPOSE_ENV_FILE_LOCAL`, and add
   ```bash
   # The droplet is a single environment: the upload scp's the local
   # per-env SOURCE onto exactly this REMOTE path, so the remote compose
   # calls must name the remote path, never the local per-env name.
   COMPOSE_ENV_FILE_REMOTE="infra/.env"
   COMPOSE_ARGS="--env-file ${COMPOSE_ENV_FILE_REMOTE} -f infra/docker-compose.yml"
   ```
   `COMPOSE_ARGS` is used **only** inside remote commands ([`prune_legacy_stack:620`](../../deploy/deploy.sh:620), the command dispatch at [`683`](../../deploy/deploy.sh:683) onward, and the error trap at [`130`](../../deploy/deploy.sh:130)), so this is a pure fix. Add a `log_debug` line showing both the local source and the remote path.
3. **New `assert_remote_ready()` preflight**, called at the top of `upload()` ([`deploy.sh:537`](../../deploy/deploy.sh:537)) — before the first rsync. One remote probe that reports: the login name, whether `REMOTE_DIR` exists, whether it is writable by that user (create + remove a dotfile probe), and its `owner:group mode`. On failure it logs, in the established `log_error` house style, *which* check failed and the exact one-time fix, then aborts before touching anything:
   ```text
   [deploy] ERROR: the remote user 'deployer' cannot write /opt/aisztens (owner: root, mode 755).
   [deploy] Fix (once, over root SSH):
   [deploy]   ssh -i <key> root@<host> 'chown -R deployer:deployer /opt/aisztens'
   [deploy] Aborted before any upload or remote command was executed.
   ```
   Note: the existing offline suites only cover scenarios that abort **before** any ssh call ([`scripts/test/_deploy-sh-env-selection-test.sh:12`](../../scripts/test/_deploy-sh-env-selection-test.sh:12)), so this guard cannot make them reach the network.
4. **Guard the `bootstrap` branch** — [`deploy.sh:640-644`](../../deploy/deploy.sh:640): before running it, probe `sudo -n true` as the configured user. If it fails, abort with guidance instead of a half-uploaded tree:
   ```text
   [deploy] ERROR: 'bootstrap' must run as root (it installs packages and creates users).
   [deploy] Run it once with the root account:   SSH_USER=root ./deploy/deploy.sh bootstrap
   [deploy] Day-to-day deploys then run as 'deployer'.
   ```
5. **Comments/usage** — the header block ([`deploy.sh:6-58`](../../deploy/deploy.sh:6)) and `print_usage()` ([`deploy.sh:217`](../../deploy/deploy.sh:217)) to state: deploy logins are `deployer`, `bootstrap` is the single root-only command, and the remote env file is `infra/.env`.

### 3.2 [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:1)

1. **Render step** ([`deploy.yml:101-122`](../../deploy.yml:101)): write the secret to `infra/.env` (the exact path the droplet needs) instead of `infra/.env.${app_env}`; keep `APP_ENV` in `$GITHUB_ENV` exactly as today, and keep the file `chmod 600`.
2. **Upload step 4** ([`deploy.yml:162-170`](../../deploy.yml:162)): `source: "infra/.env"`, `target: ${{ env.REMOTE_DIR }}/infra` so the file really lands at `/opt/aisztens/infra/.env`. Step 3's exclusion list already excludes `infra/.env`, so the bulk upload cannot clobber it ([`deploy.yml:147`](../../deploy.yml:147)).
3. **Compose steps** ([`deploy.yml:248`](../../deploy.yml:248), [`272`](../../deploy.yml:272), [`326`](../../deploy.yml:326), [`329`](../../deploy.yml:329), [`334`](../../deploy.yml:334)): `--env-file "infra/.env.$APP_ENV"` → `--env-file "infra/.env"`.
4. **Header comments** ([`deploy.yml:4-24`](../../deploy.yml:4), [`26-46`](../../deploy.yml:26)): the step list and the secrets block now describe the `infra/.env` droplet path and the `deployer` identity for **both** paths (drop the "the same key is used locally as `root`" sentence).
5. Verify-on-the-droplet note in the same PR: check whether `/opt/aisztens/infra/.env` is a file or a directory created by the old scp target, and whether a stray `/opt/aisztens/infra/.env/infra/` exists; remove it if present.

### 3.3 Configuration and documentation

| File | Change |
|---|---|
| [`deploy/.env.example:29-37`](../../deploy/.env.example:29) | `SSH_USER=deployer`; comments describe one identity for both paths and the passphrase-less deploy key |
| `deploy/.env.dev` (gitignored) | `SSH_USER=deployer` (drop-in change; the key path is already `./deploy/ssh-keys/root.private.key`) |
| [`deploy/README.md:79-83`](../../deploy/README.md:79) §1, [`105-111`](../../deploy/README.md:105) §2, [`187-214`](../../deploy/README.md:187) §8.2, [`176`](../../deploy/README.md:176) §8.1, [`222-236`](../../deploy/README.md:222) §8.4 | deployer for local + CI; `bootstrap` documented as the one root-only, run-once command (with the chown step and the preflight guard); the env-file paragraph now reads `infra/.env` on the droplet |
| [`deploy/ssh-keys/README.md:24-43`](../../deploy/ssh-keys/README.md:24) | "The deploy key" — both paths log in as `deployer`; the key is no longer described as a local root credential |
| [`docs/Specs/Three-Env-Verification.md:272`](../../docs/Specs/Three-Env-Verification.md:272) §3.2/§3.8, [`493`](../../docs/Specs/Three-Env-Verification.md:493) §7 | `deploy.sh up dev` runs as `deployer`; add the "remote dir not writable" failure mode and its one-line fix |
| [`docs/Specs/Production-Runbook.md:154`](../../docs/Specs/Production-Runbook.md:154) §4 and the §6 diag matrix | any `root@` example becomes `deployer@`; add the guard's error text to the matrix |
| [`scripts/README.md`](../../scripts/README.md:1) | only if it names a login user for `deploy.sh` |

### 3.4 New offline regression test

`scripts/test/_deploy-sh-remote-compose-path-test.sh` — the bug fixed here was invisible to every existing test. The suite puts **stub `ssh`/`scp`/`rsync`** executables first on `PATH` (they record their argv and exit 0), copies `deploy.sh` + `lib/` into a sandbox like the existing suites do ([`_deploy-sh-env-selection-test.sh:35-39`](../../scripts/test/_deploy-sh-env-selection-test.sh:35)), then runs `deploy.sh ps dev` and asserts:

* the remote command string contains `--env-file infra/.env` and **not** `infra/.env.dev`;
* the login target is `deployer@…`;
* the preflight probe ran before the first rsync;
* with a stub that reports a non-writable `REMOTE_DIR`, the run aborts with the remediation message and exit code 1.

Also refresh `SSH_USER=root` → `deployer` in the sandbox fixtures ([`_deploy-sh-env-selection-test.sh:60`](../../scripts/test/_deploy-sh-env-selection-test.sh:60), [`206`](../../scripts/test/_deploy-sh-env-selection-test.sh:206)) so the fixtures match the new default.

---

## 4. One-time operator step (needs the root key)

```bash
ssh -i deploy/ssh-keys/root.private.key root@ssh.aisztens.hu \
  "mkdir -p /opt/aisztens && chown -R deployer:deployer /opt/aisztens && ls -ld /opt/aisztens"
# Expect: drwxr-xr-x ... deployer deployer ... /opt/aisztens
```

Nothing else on the droplet changes: no file is moved, no container restarts, no downtime. `bootstrap` is not re-run (the users already exist).

---

## 5. Verification

```bash
# 1. Offline suites (no droplet needed)
bash scripts/test/_deploy-sh-remote-compose-path-test.sh
bash scripts/test/_deploy-sh-env-selection-test.sh
bash scripts/test/_deploy-sh-logger-test.sh
bash scripts/test/_deploy-sh-m1-test.sh
bash scripts/test/_deploy-sh-m3-test.sh
bash scripts/env-test/check-env-syntax.sh

# 2. Identity + config resolution
bash deploy/deploy.sh ps dev --verbose
# Expect: config: ... SSH_USER=deployer ...
#   and:   [deploy] remote env file: infra/.env (source: infra/.env.dev)

# 3. The real deploy
bash deploy/deploy.sh up dev
# Expect: no "couldn't find env file"; api becomes healthy

# 4. Live checks
bash scripts/env-test/check-env-live.sh
ssh -i deploy/ssh-keys/root.private.key deployer@ssh.aisztens.hu \
  "cd /opt/aisztens && docker compose --env-file infra/.env ps"

# 5. Negative case for the guard: point REMOTE_DIR at a root-only path
#    (e.g. /root/aisztens-test) and confirm the run aborts with the
#    remediation message and exit code 1 — then unset it.

# 6. CI: run the workflow once (Actions → Deploy to droplet → app_env=dev)
#    and confirm the compose step's log line reads --env-file infra/.env.
```

---

## 6. Risks and rollback

| Risk | Mitigation |
|---|---|
| `chown -R` on a tree containing data the containers must own | only read-only bind mounts and the named volume `pgdata` exist (evidence 8); no host directory needs root ownership |
| `deployer` is not in the `docker` group | measured earlier: `deployer` is in `deployer sudo docker` |
| A stale `/opt/aisztens/infra/.env` **directory** left by the old CI scp target | explicit check in §3.2.5; remove it if present |
| CI mutation breaks deploys | steps 2/4/5/6/8 are comment/path changes only; the identity and key are untouched, so a reverted commit restores the old behaviour |
| `bootstrap` becomes unreachable for a fresh droplet | it stays reachable via `SSH_USER=root ./deploy/deploy.sh bootstrap`, documented in §2 of the README |

---

## 7. Explicitly out of scope

* No change to `bootstrap.sh` itself, to the droplet's user list, or to the app's runtime user.
* No change to the compose stack, the Caddyfile, or the droplets' container layout.
* `docs/history/` and `docs/milestones/` entries describing the older `root` login stay as the historical record; only the living docs in §3.3 are updated.

## 8. Approved amendment — the deploy key is renamed

Approved at review: the key is now used **only** as `deployer`, so the original filename
`deploy/ssh-keys/root.private.key` is misleading. It becomes
`deploy/ssh-keys/deploy.private.key`, and every living reference is updated
(`deploy/.env.dev`, `deploy/.env.example`, [`deploy/README.md`](../../deploy/README.md),
[`deploy/ssh-keys/README.md`](../../deploy/ssh-keys/README.md), the `deploy.yml` header).
The GitHub secret holds key *material*, so it needs no change; `.gitignore`'s
`*.private.key` still covers the file.

## 9. Approved amendment — the preflight must demand positive evidence

Approved at review, and then forced by the first live run: the guard passes **only** on an
explicit `WRITABLE` marker. A refused SSH connection produces no marker at all, and
"nothing looked wrong" must never be read as success — under WSL the key is visible as
`0777`, OpenSSH refuses it before the probe starts, and the first version reported
"Preflight OK" for a directory the deploy user cannot write. The offline suite covers the
"not writable" path, the "mkdir refused and `stat` says Permission denied" path, and the
"probe never ran" path.
