# 2026-10-07 — Plan: deploy SSH key via environment variable (local) and secret (CI)

**Status:** PLAN ONLY — no code changed yet. Diagnosis must be confirmed by the operator before step 1 of §6 is executed.
**Author:** Debug mode (diagnosis + plan).
**Requested by / trigger:** "`deploy/.env.dev` uses `SSH_KEY` which points to `./deploy/ssh-keys/deploy.private.key` which is not in the repo. Why don't you use an ENV variable and for the CI/CD it would be a secret?"

---

## 1. Problem statement

Local deploys authenticate with a private key whose **path is written into a gitignored file and points inside the repository checkout**:

```dotenv
# deploy/.env.dev  (gitignored, local only)
SSH_KEY=./deploy/ssh-keys/deploy.private.key
```

The file the value points at is also gitignored ([`.gitignore:78`](../../.gitignore:78), `*.private.key`), so:

* the credential is referenced through a path that **cannot be reproduced by cloning the repository** — every operator has to place the key at that exact repo-relative location by hand;
* the reference is **relative to the process CWD**, so the same env file resolves differently depending on where the script is started from;
* the local path has **no equivalent of a secret**: the CI path already receives *key material* from `secrets.DROPLET_SSH_KEY` (consumed by `appleboy/*-action` at [`.github/workflows/deploy.yml:143`](../../.github/workflows/deploy.yml:143)), so the two deploy paths — which the docs advertise as *interchangeable* — use two structurally different credential channels.

## 2. Measured evidence

| # | Check | Command / artefact | Result |
|---|---|---|---|
| 1 | The key is not tracked by git | `git ls-files deploy/` | tracked: `.env.example`, `README.md`, `bootstrap.sh`, `deploy.ps1`, `deploy.sh`, `lib/logger.sh`, `log/.gitignore`, `log/.gitkeep`, `ssh-keys/.gitignore`, `ssh-keys/README.md` — **no `deploy.private.key`** |
| 2 | Why it cannot be tracked | [`.gitignore:78`](../../.gitignore:78) | `*.private.key`, plus `deploy/.env.dev` itself at [`.gitignore:69`](../../.gitignore:69) |
| 3 | The value is consumed as a bare `-i <path>` | [`deploy/deploy.sh:457`](../../deploy/deploy.sh:457), [`459`](../../deploy/deploy.sh:459) | `SSH_CMD=(ssh … ${SSH_KEY:+-i "$SSH_KEY"})`, same for `SCP`; no resolution, no existence check |
| 4 | The relative path is CWD-dependent | `cd /d "E:\projects\AI" & dir deploy\ssh-keys\deploy.private.key` | `PROBE1_RELATIVE_KEY_PATH_BREAKS_FROM_PARENT` — resolves only when the CWD happens to be the repo root |
| 5 | No env-var channel exists on the local side | `git grep -n "SSH_KEY"` | only `DROPLET_SSH_KEY` (the CI **secret**) and the `SSH_KEY` **env-file key**; no `DEPLOY_SSH_KEY`/`DEPLOY_SSH_KEY_FILE` anywhere |
| 6 | CI uses secret material, not a path | [`.github/workflows/deploy.yml:31`](../../.github/workflows/deploy.yml:31) | `key: ${{ secrets.DROPLET_SSH_KEY }}` in 7 steps |
| 7 | Consumers of `SSH_KEY` that must move together | `git grep -n "SSH_KEY"` | [`deploy/.env.example:41`](../../deploy/.env.example:41), [`deploy/deploy.sh:364`](../../deploy/deploy.sh:364) + `:446` + `:457`/`:459` + `:654` (icacls hint hard-codes the path), [`deploy/README.md:81`](../../deploy/README.md:81) + `:199` + `:253`, [`deploy/ssh-keys/README.md:31`](../../deploy/ssh-keys/README.md:31), [`scripts/env-test/check-env-live.sh:113`](../../scripts/env-test/check-env-live.sh:113)–`:161`, [`scripts/ssh/_remove-ssh-passphrase.sh:77`](../../scripts/ssh/_remove-ssh-passphrase.sh:77), [`scripts/ssh/README.md:162`](../../scripts/ssh/README.md:162) |
| 8 | Raised, not hidden | [`deploy/ssh-keys/README.md:26`](../../deploy/ssh-keys/README.md:26) | the README already calls the file "the deploy key … gitignored": the docs knowingly place a secret inside the checkout |
| 9 | **A process-environment override is silently discarded** (found while answering "which key does `up`/`bootstrap` use?") | probe: `SSH_USER=root SSH_KEY=/tmp/from-the-environment; set -a; . deploy/.env.dev; set +a` → `SSH_USER=deployer`, `SSH_KEY=./deploy/ssh-keys/deploy.private.key` ([`deploy/deploy.sh:350`](../../deploy/deploy.sh:350), [`373`](../../deploy/deploy.sh:373)) | `set -a; . file` runs *after* the environment, so the env file always wins: the documented `SSH_USER=root ./deploy/deploy.sh bootstrap` override ([`deploy/README.md:116`](../../deploy/README.md:116)) cannot take effect while `deploy/.env.dev` contains `SSH_USER=deployer` |

## 3. Candidate sources (reflection), distilled

| # | Candidate source | Verdict |
|---|---|---|
| 1 | Path embedded in a gitignored file, pointing *into* the checkout | **kept — primary** |
| 2 | `SSH_KEY` is a path while CI uses key *material*: two channels, no shared resolution | **kept — primary** |
| 3 | Relative path resolved against CWD (no `$REPO_DIR` anchoring, no `~` expansion) | contributing (same fix site) |
| 4 | No fail-fast validation of the key (missing/unreadable key surfaces as ssh's `Load key … No such file or directory` mid-run) | contributing |
| 5 | `deploy/ssh-keys/` used as the home of a *private* key while `.gitignore` excludes it | symptom of #1, doc-level |
| 6 | The private key leaks to the droplet via `upload()`'s rsync | **rejected** — [`deploy/deploy.sh:685`](../../deploy/deploy.sh:685) already has `--exclude 'deploy/ssh-keys/'` |
| 7 | `IdentitiesOnly=yes` + wrong key ⇒ `Permission denied (publickey)` | **rejected** — orthogonal, already guarded by the preflight in [`assert_remote_ready()`](../../deploy/deploy.sh:603) |

**Diagnosis (to be confirmed):** the credential *location* is defined inside a gitignored file as a repo-relative path (candidate 1), and the local path has no env-var/secret channel equivalent to CI's `secrets.DROPLET_SSH_KEY` (candidate 2). Historical note supporting this: the *original* convention documented on 2026-09-23 was a path **outside** the repo (`SSH_KEY=/home/<you>/.ssh/aisztens_deployer`, [`docs/history/2026-09-23--19-16-40-ssh-key-config-in-deploy-sh.md:54`](2026-09-23--19-16-40-ssh-key-config-in-deploy-sh.md:54)); the repo-local path was introduced later on 2026-10-07.

**Additional finding, measured (row 9) — an env-var-based design only works if the env file cannot clobber it.** Triggered by the operator's question *"which key will be used when I start `deploy.sh up` or `bootstrap`?"*. Today the answer is **the same key in both cases** — [`deploy/.env.dev:19`](../../deploy/.env.dev:19) `SSH_KEY=./deploy/ssh-keys/deploy.private.key`, i.e. the passphrase-less ed25519 deploy key (`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINI4k0yp3DLE2O6vwgsGcA4J0OXBDQ2NvPJPPOtsGGf3`, public half documented in [`deploy/ssh-keys/README.md:45`](../../deploy/ssh-keys/README.md:45)) — with `-o IdentitiesOnly=yes`, so **no other agent key is offered**. The *account* is what must differ for `bootstrap` (`root`, because `deployer` has no passwordless sudo), and that part of the documented workflow is currently unreachable (row 9). So the plan must not merely *add* env-var tiers; it must fix the **precedence direction** as well.

## 4. Design

### 4.1 One credential, four sources, fixed precedence

Add `resolve_ssh_key()` to [`deploy/deploy.sh`](../../deploy/deploy.sh:1) (kept as one responsibility: *produce a usable key source or abort*). Highest precedence first — mirroring the existing `argument > APP_ENV > default` precedent of the target selection:

| Order | Source | Semantics | Typical use |
|---|---|---|---|
| 1 | `DEPLOY_SSH_KEY_FILE` (exported) | path to an existing private key, **outside** the repo; `~` expanded | normal local deploy (`~/.ssh/aisztens-deployer`) |
| 2 | `DEPLOY_SSH_KEY` (exported) | key **material** (OpenSSH/PEM, or base64 with `DEPLOY_SSH_KEY_B64=1`) | CI, ephemeral shells, one-off runs |
| 3 | `SSH_KEY` in `deploy/.env.<target>` | **legacy, kept for compatibility**; relative paths resolved against `$REPO_DIR`, `~` expanded | existing setups, no migration required |
| 4 | (empty) | no `-i` at all → ssh-agent + `~/.ssh` defaults | ssh-agent users |

Behaviour of the function:

* **Source 2** writes the material to `mktemp "${TMPDIR:-/tmp}/deploy-ssh-XXXXXX"` under `umask 077` + `chmod 600`, registers an `EXIT` trap to delete it, and **never** echoes the material or the temp path.
* **Fail fast**: source 1 or 3 that does not exist / is unreadable aborts *before* `assert_remote_ready()` with a message naming the source, the value and the fix. Today that failure only appears as ssh's `Load key … No such file or directory` deep inside the preflight.
* **Warning, not error**, when the resolved path is inside `$REPO_DIR` (`log_warn`: "key inside the checkout; gitignored and travels nowhere — prefer `~/.ssh/…` + `DEPLOY_SSH_KEY_FILE`"), so no existing setup breaks.
* **Redaction**: the log records the *source label* and, for file sources, the path only when it came from `SSH_KEY`/`DEPLOY_SSH_KEY_FILE` (a path, not a secret); for source 2 only `ssh key: DEPLOY_SSH_KEY (material)`. Consistent with [`deploy/deploy.sh:446`](../../deploy/deploy.sh:446) ("never SSH_KEY").
* `SSH_CMD`/`SCP` ([`deploy/deploy.sh:457`](../../deploy/deploy.sh:457)–`:459`) switch from `$SSH_KEY` to the single resolved variable, so `ssh`, `scp` and `rsync -e` can never disagree.
* The hard-coded icacls hint at [`deploy/deploy.sh:654`](../../deploy/deploy.sh:654) uses the resolved path instead of `deploy\ssh-keys\deploy.private.key`.

**Precedence direction (required by row 9).** The process environment must win over the env file — for the new variables *and* for `SSH_USER`/`SSH_KEY`, otherwise the documented `SSH_USER=root ./deploy/deploy.sh bootstrap` remains broken (measured: the sourced file overwrites an exported `SSH_USER`). The pattern already exists in the script for exactly this class of bug: `APP_ENV_PREEXISTING` is captured *before* sourcing ([`deploy/deploy.sh:178`](../../deploy/deploy.sh:178)) and later used to warn about a shadowing env file ([`:326`](../../deploy/deploy.sh:326)). Reuse it:

```bash
SSH_USER_PREEXISTING="${SSH_USER:-}"; SSH_KEY_PREEXISTING="${SSH_KEY:-}"   # before `set -a; . file`
# after sourcing: pre-existing value wins, with a log_warn naming the env-file line it shadowed
```

This keeps the §4.1 table valid (tiers 1–2 are *different names*, so they survive sourcing anyway) and additionally makes tier 3 and `SSH_USER` overridable from the command line, which is what the operator expects when typing `SSH_USER=root … bootstrap`.

### 4.2 CI side

`secrets.DROPLET_SSH_KEY` already is key material and already matches source 2 semantics — **no secret change, no operator action**. Only:

* document the shared contract in the workflow header ([`.github/workflows/deploy.yml:29`](../../.github/workflows/deploy.yml:29)–`:52`) and in `deploy/README.md` §8.1;
* add a workflow step running the new offline test suite (source 2 parity is then CI-verified);
* **do not rename** the secret (`DEPLOY_SSH_KEY` would be symmetry-only and renaming a GitHub secret requires the operator to re-add it).

### 4.3 Alternatives considered

| Option | Why not |
|---|---|
| **A.** Only change the default to `$HOME/.ssh/aisztens-deployer` (no new variables) | simplest, but nothing can be injected by a shell/automation that cannot write the env file |
| **C.** Store key material as a multi-line value in `deploy/.env.<target>` | env files are sourced with `set -a; . file` ([`deploy/deploy.sh:350`](../../deploy/deploy.sh:350)) and parsed as `KEY=value`; multi-line values break both that and [`scripts/env-test/check-env-syntax.sh`](../../scripts/env-test/check-env-syntax.sh:9) |
| **D.** Mandate ssh-agent (`ssh-add`) and drop the file channel | breaks unattended/one-off runs and does not help CI, which needs material anyway |

**Chosen:** B (env-var-first precedence chain) + optional A as the *documented default* value of `DEPLOY_SSH_KEY_FILE` in the operator's shell profile, with C rejected and D retained as the fallback tier.

## 5. Non-goals

* No change to `bootstrap`'s root-login requirement, to `SSH_USER=deployer`, or to the remote account model.
* No key rotation (the current key stays valid); the change is about *where the reference lives*, not *which key is used*.
* No new secret in GitHub, no change to `INFRA_ENV_DEV`/`INFRA_ENV_PROD`.
* No change to `upload()`'s rsync exclusions (already correct).

## 6. Implementation steps

### PR-1 — resolution + validation (code, backward compatible)

1. `deploy/deploy.sh`: add `resolve_ssh_key()` (source table of §4.1), temp-file creation + `EXIT` cleanup, existence validation, in-repo warning, source-label logging; repoint `SSH_CMD`/`SCP`/`SSH` and the icacls hint; extend the header + `print_usage()` docs. In the same commit, capture `SSH_USER`/`SSH_KEY` before sourcing and let the pre-existing (process-environment) value win, with a `log_warn` when the env file shadowed it — this is the measured bug of §2 row 9 and the prerequisite for the operator-facing `SSH_USER=root … bootstrap` command.
2. New `scripts/test/_deploy-sh-ssh-key-resolution-test.sh` following the existing offline harness ([`scripts/test/_deploy-sh-env-selection-test.sh:32`](../../scripts/test/_deploy-sh-env-selection-test.sh:32): sandbox repo + stubbed `ssh`/`scp`/`rsync`/`pnpm` on `PATH`) with scenarios:
   1. no source → no `-i` in the stubbed ssh args (agent fallback);
   2. `DEPLOY_SSH_KEY_FILE` → `-i <path>` present in `ssh` **and** in `rsync -e`/`scp`;
   3. `DEPLOY_SSH_KEY` material → temp file created `0600`, passed as `-i`, **removed** after the run;
   4. precedence: `DEPLOY_SSH_KEY_FILE` **beats** the env-file `SSH_KEY` (assert the logged source label);
   5. env-file `SSH_KEY=./deploy/ssh-keys/x` resolves against `$REPO_DIR` when the test runs from an unrelated CWD;
   6. env-file `SSH_KEY` → missing file ⇒ exit 1, message names the source;
   7. the material string from scenario 3 never appears in `deploy/log/latest.log`;
   8. `SSH_USER=root bash deploy/deploy.sh bootstrap dev` uses `root` (assert the logged `SSH_USER=root`, and that the abort — if any — comes from the remote `sudo -n true` probe, **not** from the env file resetting the user).
3. `scripts/test-syntax.ps1` + shellcheck must stay green (`bash -n`).

### PR-2 — documentation + operator migration

4. `deploy/.env.example`: document the three variables and the precedence; keep `SSH_KEY=` (legacy) with a deprecation note.
5. `deploy/README.md` §1 and §8.1, `deploy/ssh-keys/README.md` "The deploy key": state that the private key lives **outside** the checkout (`~/.ssh/aisztens-deployer`), that `deploy/ssh-keys/` holds public halves only, and give the migration one-liner:
   ```bash
   mv deploy/ssh-keys/deploy.private.key ~/.ssh/aisztens-deployer && chmod 600 ~/.ssh/aisztens-deployer
   # deploy/.env.dev: replace the SSH_KEY line with
   #   DEPLOY_SSH_KEY_FILE=~/.ssh/aisztens-deployer
   ```
6. `docs/Specs/Production-Runbook.md` + `docs/Specs/Three-Env-Verification.md`: refresh the key-reference description and the "Utolsó frissítés" line.
7. History entry for the change (`docs/history/<ts>-deploy-ssh-key-env-var.md`) + milestone `docs/milestones/<ts>-deploy-ssh-key-channel.milestone.md` (non-trivial change touching script, docs, CI and operator procedure).

### PR-3 — consumers + CI parity

8. `scripts/env-test/check-env-live.sh` (+ its `.ps1` twin): resolve the key with the same precedence; print the **source**, never material; keep the "missing file ⇒ FAIL" behaviour for source 1/3.
9. `scripts/ssh/_remove-ssh-passphrase.sh` ([`:77`](../../scripts/ssh/_remove-ssh-passphrase.sh:77)) and `scripts/ssh/README.md`: read `DEPLOY_SSH_KEY_FILE` as well, and print the new guidance.
10. `.github/workflows/deploy.yml`: header comment update + a step running `scripts/test/_deploy-sh-ssh-key-resolution-test.sh`; `appleboy` `key:` inputs unchanged.
11. `scripts/README.md` / `scripts/test/README.md`: add the new suite to the tables.

### Operator actions (after merge)

12. Move the key out of the checkout (one-liner in §6 step 5) and set `DEPLOY_SSH_KEY_FILE`; keep `DROPLET_SSH_KEY` in GitHub as-is.

## 7. Verification

| Check | Command | Expected |
|---|---|---|
| local deploy with the new channel | `bash deploy/deploy.sh ps dev` | log line `ssh key: file ~/.ssh/aisztens-deployer` (source label), preflight `WRITABLE`, then `ps` output |
| no CWD coupling | `cd /tmp && bash <repo>/deploy/deploy.sh ps dev` | identical result (previously the relative `SSH_KEY` broke) |
| pure-material path | `DEPLOY_SSH_KEY="$(cat ~/.ssh/aisztens-deployer)" bash deploy/deploy.sh ps dev` | succeeds with **no** key file on disk; `ls ${TMPDIR:-/tmp}/deploy-ssh-*` empty afterwards |
| no material in logs | `grep -r "PRIVATE KEY" deploy/log/` | no hits |
| backward compatibility | `SSH_KEY=~/old/legacy.key bash deploy/deploy.sh ps dev` | still works (tier 3), with a deprecation note |
| identity override actually works (§2 row 9) | `SSH_USER=root bash deploy/deploy.sh bootstrap dev` | log line `SSH_USER=root`; the run must not be rejected with "'bootstrap' must run as root, but deployer@… has no passwordless sudo" |
| today's (pre-fix) behaviour, for the record | `bash deploy/deploy.sh ps dev` | `ssh … -o IdentitiesOnly=yes -i ./deploy/ssh-keys/deploy.private.key deployer@ssh.aisztens.hu` — every command uses that one key |
| offline suites | `bash scripts/test/_deploy-sh-ssh-key-resolution-test.sh && bash scripts/test/_deploy-sh-env-selection-test.sh && bash scripts/env-test/check-env-syntax.sh` | all green (0 FAIL) |
| CI | push to `dev` (or `workflow_dispatch app_env=dev`) | deploy + smoke test green; the resolution suite runs as a step |

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| An exported `DEPLOY_SSH_KEY_FILE` silently overrides the env file and points at the wrong key | log the winning **source label** on every run ([`deploy/deploy.sh:448`](../../deploy/deploy.sh:448) pattern) and print a `log_warn` when a lower tier is shadowed; `IdentitiesOnly=yes` already limits what ssh offers |
| Material written to a temp file leaks on Windows (Git Bash `$TMPDIR` under `%TEMP%` with loose ACLs) | `umask 077` + `chmod 600` + `EXIT` trap; docs recommend `DEPLOY_SSH_KEY_FILE` (source 1) as the primary local channel and reserve material for CI |
| Temp files orphaned on SIGKILL | documented limitation; files are named `deploy-ssh-*` and are safe to delete; follow-up could prefer `$RUNNER_TEMP`/`$XDG_RUNTIME_DIR` when set |
| Docs/scripts drift (the 2026-10-07 pattern repeating) | every consumer of `SSH_KEY` is enumerated in §2 row 7 and touched in PR-2/PR-3; the new offline suite pins the contract |
| Renaming the GitHub secret by mistake | explicitly out of scope (§4.2) |

## 9. Rollback

PR-1 is additive and keeps `SSH_KEY` working, so rollback is `git revert` of that commit; `deploy/.env.dev` (untracked) can keep `SSH_KEY=./deploy/ssh-keys/deploy.private.key` and the script falls back to it. No secret, droplet or compose artefact is involved.

## 10. Open questions for the operator

1. Variable **names**: `DEPLOY_SSH_KEY_FILE` / `DEPLOY_SSH_KEY` (recommended, namespaced) or shorter `SSH_KEY_FILE` / `SSH_KEY_CONTENT`?
2. Should the in-repo `SSH_KEY` tier keep working forever, or become a **deprecation warning with a removal date** (e.g. removed when prod is provisioned)?
3. Should `deploy/.env.dev`'s committed template keep an example pointing inside the repo at all (today [`deploy/.env.example:40`](../../deploy/.env.example:40) does), or switch the example to `~/.ssh/aisztens-deployer`?
