# Plan — structured logging for `deploy/deploy.sh` into `deploy/log/`

**Date:** 2026-10-06
**Status:** draft, awaiting approval
**Author:** architect mode
**Scope:** [`deploy/deploy.sh`](../../deploy/deploy.sh:1) (+ a new `deploy/lib/logger.sh`), the
`deploy/log/` artefact, and the docs/tests that must follow the change.
**Related:** [`deploy/README.md`](../../deploy/README.md:1),
[`scripts/test/_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh:1),
[`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md:1),
[`.gitignore`](../../.gitignore:14)

---

## 1. Goal

Every run of `deploy/deploy.sh` must leave a complete, timestamped, human-readable log in
`deploy/log/` (created automatically when missing), while the operator still sees the same live
output on the terminal. The log must contain:

- every log line the script itself emits (stages, progress, errors) with level + timestamp;
- the **output of every command the script runs** (`pnpm`, `rsync`, `ssh`, `scp`,
  `docker compose` over ssh) — today that output goes only to the terminal;
- a header (who/when/where/what) and a footer (exit code, duration);
- **no secrets** (the script sources `deploy/.env`, and that file must never leak into the log).

Non-goals: remote-side log files on the droplet (the compose output arrives through ssh and is
captured anyway), log shipping/aggregation, and changing what the deploy actually does.

## 2. Current state (facts)

| Fact | Where |
|---|---|
| The script runs on the **operator's machine** (Git Bash / WSL on Windows, or Linux) and drives the droplet over ssh/rsync | [`deploy/deploy.sh:2-4`](../../deploy/deploy.sh:2) |
| `set -euo pipefail`; a `CURRENT_STAGE` breadcrumb + `ERR` trap already exist | [`deploy/deploy.sh:18`](../../deploy/deploy.sh:18), [`deploy/deploy.sh:32-52`](../../deploy/deploy.sh:32) |
| Logging today is one primitive: `log() { echo "[deploy] $*"; }` | [`deploy/deploy.sh:128`](../../deploy/deploy.sh:128) |
| ~30 call sites use `log` / `log_stage` (no levels, no timestamps, no file) | [`deploy/deploy.sh:35`](../../deploy/deploy.sh:35) and the functions `ensure_spa_env`, `build_spas`, `upload_dists`, `render_caddyfile`, `upload`, `prune_legacy_stack` |
| Long-running command output is not captured by the script at all (inherited stdout/stderr): `pnpm install`, `pnpm build:*`, `rsync -az`, `scp`, `ssh "docker compose up -d --build"` | [`deploy/deploy.sh:183-187`](../../deploy/deploy.sh:183), [`deploy/deploy.sh:251`](../../deploy/deploy.sh:251), [`deploy/deploy.sh:385`](../../deploy/deploy.sh:385) |
| `deploy/.env` is sourced with `set -a` (export-all) — the canonical secret-leak path if `set -x` is ever enabled | [`deploy/deploy.sh:54-57`](../../deploy/deploy.sh:54) |
| Existing offline tests for deploy.sh copy the trap block and define their own `log()` — they must keep working (or be updated deliberately) | [`scripts/test/_deploy-sh-m1-test.sh:8`](../../scripts/test/_deploy-sh-m1-test.sh:8), [`scripts/test/_deploy-sh-m3-test.sh:14`](../../scripts/test/_deploy-sh-m3-test.sh:14) |
| `.gitignore` already ignores `logs` and `*.log`; shell scripts are forced to LF by `.gitattributes` | [`.gitignore:14-15`](../../.gitignore:14), [`.gitattributes:25`](../../.gitattributes:25) |
| CI does **not** call `deploy.sh` — the workflow mirrors its steps, so CI logs stay in GitHub | [`.github/workflows/deploy.yml:3`](../../.github/workflows/deploy.yml:3) |

## 3. Requirements

| # | Requirement | Why |
|---|---|---|
| R1 | Create `deploy/log/` on demand (`mkdir -p`), never fail if it exists | requested |
| R2 | One file **per run**, timestamped; keep a stable pointer to the newest (`deploy/log/latest.log`) | finding the last failed deploy must take one command |
| R3 | Levels (`DEBUG/INFO/WARN/ERROR`) + ISO-8601 timestamps + the stage breadcrumb in every line | the current `[deploy] …` prefix carries no time or severity |
| R4 | Capture **subprocess output** too, not just `log()` calls | the interesting failures (rsync, compose, pnpm) print themselves |
| R5 | Keep the terminal UX: colour-free but unchanged stream, same exit codes | operators watch it live; CI parses the exit code |
| R6 | Never write secrets (no `set -x` on the sourcing path; no dumping of `.env`) | `deploy/.env`, `infra/.env`, `INFRA_ENV_*` |
| R7 | No new runtime dependency; must work in Git Bash, WSL, Ubuntu CI runners and macOS | the deploy path must stay executable on a bare machine |
| R8 | Retention: keep the last N runs (default 20) so the directory cannot grow forever | unattended use |
| R9 | Testable offline (no droplet needed) + `bash -n`/shellcheck clean | the repo already tests deploy.sh's guards offline |
| R10 | Existing API (`log`, `log_stage`) keeps working so the diff stays reviewable | 30 call sites |

## 4. Logger options (internet research)

Candidates found and evaluated (2026-10-06):

| Option | Type | Pros | Cons / verdict |
|---|---|---|---|
| [GingerGraham/bash-logger](https://github.com/GingerGraham/bash-logger) (MIT, 19★, active, CI + test suite) | library, `logging.sh` | Full syslog level set, colour console output, stdout/stderr split, **file output**, optional journald, INI config, runtime config, sensitive-data helpers, ANSI/newline sanitisation, TOCTOU-safe file creation | Large single file to vendor and keep updated; its own `init_logger` + `log_info` API must be adapted to ours; journald/INI/TOCTOU features unused; still does **not** capture subprocess output (R4 needs `exec | tee` anyway). **Best library choice if we want third-party code.** |
| [Zordrak/bashlog](https://github.com/Zordrak/bashlog) (MIT, 95★) | library, `log.sh` | Rich API (`log info|warn|error|debug`), optional file/JSON/syslog sinks, `prev_cmd` debug trap | **Unmaintained** (3 commits, no recent activity); **sets `set -uo pipefail` on source** (side effects in the caller); drops into an **interactive debug shell** on error (hostile to automation/CI); no rotation; no tee. Rejected. |
| D4rth-C0d3r/bash_logger | library | lightweight, colour, rotation, tracing | small/unproven project, same vendoring cost. Rejected. |
| fredpalmer/log4bash | library | historically popular | effectively unmaintained for years. Rejected. |
| `logger(1)` (util-linux) → syslog/journald | system tool | zero code, integrates with journald | writes to the OS log, **not** to `deploy/log/`; on Git Bash/Windows there is no syslog; the deploy runs on the *operator's* machine, where syslog is the wrong destination. Rejected as the primary sink. |
| `ts` (moreutils) as `exec > >(ts … | tee -a log)` | system tool | clean timestamping | **not installed by default** (moreutils on Debian, brew on macOS, absent in Git Bash) → new hard dependency in the critical path (violates R7). |
| `script(1)` session capture | system tool | forensic full-session capture incl. child processes | flag differences Linux vs BSD/macOS, ANSI-laden `typescript` output, spawns a pty, awkward to combine with `set -e` semantics. Not worth it here. |
| systemd `StandardOutput=journal` | systemd only | free structured logs | `deploy.sh` is not a systemd unit (it is a developer-machine script). N/A. |
| **Custom, dependency-free logger** (`deploy/lib/logger.sh`, `exec > >(tee -a …) 2>&1`) | ~80 lines we own | satisfies R1–R10 exactly; no vendoring, no network, no new packages; works in Git Bash/WSL/Ubuntu/macOS; keeps `log()`/`log_stage()`; chosen place to add retention + secret rules; the `tee` capture is required by any option above anyway | we own the ~80 lines and their tests |

### 4.1 Recommendation: custom logger — and why

1. **The capture mechanism is needed regardless.** No shell logger library captures the output of
   the commands a script spawns; that needs an `exec > >(tee -a "$LOG_FILE") 2>&1` redirect (or a
   per-command `| tee`). So a library would only add the *formatting/level* layer on top — roughly
   20 lines of the ~80 — while adding a vendored dependency.
2. **Portability is non-negotiable (R7).** deploy.sh runs from Git Bash/WSL/Ubuntu/macOS. A
   dependency-free logger uses only bash builtins + `date`/`mkdir`/`ls`/`tail`/`rm`, which exist
   everywhere the script already runs. `ts`, `logger`, `script` and `journald` do not.
3. **No supply-chain surprise in the deploy path.** A deploy script that downloads or vendors
   third-party code is a new failure mode (and a review burden) for a script whose job is to be
   boring and repeatable.
4. **Exact API fit.** The script already has `log`/`log_stage` plus an `ERR` trap that must log into
   the same file. Keeping those names means the review diff stays small (R10) and the existing
   offline deploy tests keep their structure.
5. **Secret safety (R6) is project-specific.** We need a rule as much as a feature: no `set -x`
   after sourcing `deploy/.env`, plus a documented "never echo the env files" policy. A small,
   reviewed logger is the cheapest place to enforce it — and it is trivially auditable.

### 4.2 When to choose bash-logger instead

Adopt (and vendor) [GingerGraham/bash-logger](https://github.com/GingerGraham/bash-logger) if the
project wants: syslog/journald shipping, INI-based configuration for several scripts, or a
third-party test suite behind the logger. In that case the integration is:
`deploy/lib/vendor/bash-logger/logging.sh` + a thin `deploy/lib/logger.sh` adapter that calls
`init_logger --log "$LOG_FILE" ...` and exposes our `log_info/log_warn/log_error/log_stage` names,
and R4 is still implemented with the `exec | tee` redirect. Decision point in §9.

## 5. Design

### 5.1 Layout

```
deploy/
  deploy.sh              # sources lib/logger.sh right after SCRIPT_DIR/REPO_DIR are known
  lib/
    logger.sh            # NEW: the whole logging layer (LF endings, .sh => .gitattributes)
  log/                   # NEW (gitignored except .gitkeep)
    deploy-20261006-124501-up.log
    latest.log -> deploy-20261006-124501-up.log
    .gitkeep
```

### 5.2 API of `deploy/lib/logger.sh`

| Function | Behaviour |
|---|---|
| `deploy_log_init <command> [--verbose]` | `mkdir -p "$LOG_DIR"`; compute `LOG_FILE="$LOG_DIR/deploy-<YYYYmmdd-HHMMSS>-<command>.log"`; `touch` it; **set up the capture**: `exec > >(tee -a "$LOG_FILE") 2>&1` (remember the `tee` PID); write the header; install an `EXIT` trap that writes the footer and `wait`s for `tee` so the file is flushed before the shell exits |
| `log_debug` / `log_info` / `log_warn` / `log_error` | `printf '%s [%-5s] [deploy]%s%s %s\n'` with ISO-8601 local timestamp, level, optional `[stage=x]`, message; `log_debug` is a no-op unless `DEPLOY_LOG_LEVEL=DEBUG` |
| `log <msg>` | **kept**, alias of `log_info` (backwards compatible with all 30 call sites) |
| `log_stage <name>` | sets `CURRENT_STAGE` and logs at INFO (moved here from deploy.sh, same signature) |
| `log_cmd <cmd...>` | DEBUG line that echoes the command about to run (never used with secrets) |
| `deploy_log_finish <exit_code>` | footer line: exit code, duration, log path; flushes `tee` |
| `deploy_log_prune` | keeps the newest `DEPLOY_LOG_KEEP` (default 20) files, deletes the rest; refreshes `latest.log` |

Environment knobs (all optional, safe to put in `deploy/.env`):

| Variable | Default | Meaning |
|---|---|---|
| `DEPLOY_LOG_DIR` | `$SCRIPT_DIR/log` | where the logs go (`deploy/log`) |
| `DEPLOY_LOG_LEVEL` | `INFO` | `DEBUG` enables `log_debug` + `log_cmd` |
| `DEPLOY_LOG_KEEP` | `20` | retention count |
| `DEPLOY_LOG_FILE` | unset | override the whole filename (tests / one-off runs) |

### 5.3 Log line format

```
2026-10-06T12:45:01+02:00 [INFO ] [deploy] [stage=upload_rsync] Uploading /repo -> root@host:/opt/aisztens ...
2026-10-06T12:45:33+02:00 [ERROR] [deploy] [stage=compose_up] FAILED at stage=compose_up line=385 exit=1 after 92s
```

Header (written by `deploy_log_init`):

```
===== AIsztens deploy =====
command      : up
started      : 2026-10-06T12:45:01+02:00
host         : aisztens.hu (root@aisztens.hu, REMOTE_DIR=/opt/aisztens)
env          : APP_ENV=dev SPA_BUILD_MODE=dev DOMAIN=aisztens.hu
git          : main @ 4531701 (dirty)
shell        : bash 5.2.15, pwd /repo
log file     : /repo/deploy/log/deploy-20261006-124501-up.log
```

Footer: `===== finished: exit=0 duration=2m14s =====` (+ the same line at ERROR level if non-zero).

### 5.4 Capture strategy

- One `exec > >(tee -a "$LOG_FILE") 2>&1` in `deploy_log_init` captures **everything** afterwards:
  our `log*` lines *and* the stdout/stderr of `pnpm`, `rsync`, `scp`, `ssh` (R4), while the
  operator keeps seeing the live stream (R5). Exit codes are untouched by `exec` redirection.
- The known bash pitfall is the flush race: the `tee` subprocess may still be writing when the
  script exits. Mitigation: remember `TEE_PID=$!` and `wait "$TEE_PID"` in the `EXIT` trap
  (`deploy_log_finish`), so the trailing output (footer included) is always on disk.
- `ERR` trap: the existing [`on_err`](../../deploy/deploy.sh:36) keeps its body, but its `log` call is
  now timestamped + staged, and it calls `deploy_log_finish "$exit_code"` before `exit`
  (otherwise the footer never runs on the failure path).
- `pipefail` interaction: the `exec > >(…)` redirect is not part of any pipeline, so
  `set -o pipefail` semantics for our own commands are unchanged.
- DEBUG adds `log_cmd`/`run_logged` output only when `DEPLOY_LOG_LEVEL=DEBUG` (a `--verbose` flag on
  `deploy.sh` sets it); the noisy `docker compose up -d --build` output is captured either way.

### 5.5 Secret safety (R6)

- **No `set -x`** anywhere after [`deploy/.env`](../../deploy/deploy.sh:54) is sourced: `set -a` exports
  everything from that file, so `set -x` would print SSH key paths and any future secret value.
  Enforced by a comment next to the sourcing block + a check in the offline test
  (`grep -n 'set -x' deploy/deploy.sh` must be empty).
- The logger never reads/echoes the env files; it only prints the *names* of the resolved values
  (`APP_ENV`, `DOMAIN`, host) and never `SSH_KEY`, `PASSWORD*`, `SECRET*`, `TOKEN*`.
- Optional hardening (cheap, recommended): `log_secret_safe` is not needed if the rule above holds;
  instead add a single `-o`-style guard in `deploy_log_init` that refuses to start if
  `BASH_XTRACEFD`/`SHELLOPTS` already contain `xtrace`, so a caller running `bash -x deploy.sh`
  cannot silently dump secrets into the log.

### 5.6 Retention (R8)

`deploy_log_prune` sorts `deploy/log/deploy-*.log` by mtime, keeps the newest `DEPLOY_LOG_KEEP`
files (+ `latest.log`), deletes the rest. Called at the end of `deploy_log_init` (before creating the
new run's file) so the directory is bounded even when a run dies early. `latest.log` is a symlink
(Git Bash provides `ln -s`; on filesystems without symlinks the code falls back to a copy).

### 5.7 `deploy/deploy.sh` integration (concrete edits)

| # | Location | Change |
|---|---|---|
| 1 | after [`deploy.sh:21`](../../deploy/deploy.sh:21) | `source "$SCRIPT_DIR/lib/logger.sh"` (keeps `SCRIPT_DIR`/`REPO_DIR` semantics) |
| 2 | new, after the env is sourced ([`deploy.sh:57`](../../deploy/deploy.sh:57)) | `deploy_log_init "${1:-}"` (+ `--verbose` detection); this is the first point where the command name and `deploy/.env` values are known |
| 3 | [`deploy.sh:35`](../../deploy/deploy.sh:35) + [`deploy.sh:128`](../../deploy/deploy.sh:128) | delete the local `log()`/`log_stage()` definitions (they now come from the logger); no call-site changes required |
| 4 | [`deploy.sh:36-51`](../../deploy/deploy.sh:36) | `on_err()` additionally calls `deploy_log_finish "$exit_code"` before `exit` |
| 5 | each noisy step (`build_spas`, `upload_dists`, `upload`, `render_caddyfile`) | optional `log_cmd` (DEBUG) before the command; no `| tee` needed thanks to the global redirect |
| 6 | end of `case` ([`deploy.sh:342-404`](../../deploy/deploy.sh:342)) | normal path calls `deploy_log_finish 0`; the usage branch logs the usage into the file as well |
| 7 | header comment ([`deploy.sh:6-16`](../../deploy/deploy.sh:6)) | document the `--verbose` flag and where logs land |
| 8 | (optional) new subcommand `log [n]` | `tail -n "${2:-200}" deploy/log/latest.log` — a convenient counterpart to the existing `logs` (container logs) subcommand; make the naming explicit in the usage text to avoid confusion |

`.gitignore`: add an explicit `deploy/log/` block that keeps the directory:
`deploy/log/*` + `!deploy/log/.gitkeep` (the existing `*.log` rule already covers the files, this
makes the intent obvious and keeps the folder in git).

### 5.8 Reuse & follow-ups

- `deploy/bootstrap.sh` and `scripts/dev-stack.sh` can source the same `deploy/lib/logger.sh`
  later (they have their own `log()` today) — deliberately **not** part of this change to keep the
  blast radius small.
- CI: the workflow does not call `deploy.sh`; if that ever changes, the run log can be uploaded with
  `actions/upload-artifact`.

## 6. Verification plan

**Offline (always runnable, no droplet):**

1. `bash -n deploy/lib/logger.sh deploy/deploy.sh` + `shellcheck` if available.
2. New test `scripts/test/_deploy-sh-logger-test.sh` (mirrors the existing
   [`_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh:1) style) that:
   - runs `deploy_log_init up` in a temp `DEPLOY_LOG_DIR`,
   - asserts the directory was created when missing (R1),
   - asserts the file name pattern + header fields (R2/R3),
   - emits `log_info/log_warn/log_error` and a step that prints to stdout/stderr, then asserts both
     appear in the file (R4),
   - asserts a non-zero exit still writes the footer and preserves the exit code (R5),
   - asserts `set -x`-flag detection refuses to start (R6),
   - seeds 25 old `deploy-*.log` files and asserts only 20 remain + `latest.log` points at the
     newest (R8).
3. `scripts/test/_deploy-sh-m1-test.sh` / `_deploy-sh-m3-test.sh`: keep them green — either they
   keep their local `log()` (they are standalone repros, so this is fine) or they source the new
   logger; verify both files after the change.
4. Re-run the deploy syntax guard `bash -n deploy/deploy.sh` on a Windows-sourced checkout as well
   (CRLF regression guard: `.gitattributes` forces LF, and the new `lib/logger.sh` must be LF).

**End-to-end (needs the droplet, optional but recommended once):**

5. `bash deploy/deploy.sh ps` → assert exactly one `deploy/log/deploy-*-ps.log` appeared, contains
   the ssh output, header/footer, and `latest.log` resolves to it.
6. `bash deploy/deploy.sh up` → assert the log contains the full compose build output and no
   occurrence of the words from the secret set (`grep -Ei 'PASSWORD|SECRET|TOKEN|PRIVATE KEY' deploy/log/latest.log` → only the variable *names* may appear, never values).
7. Failure path: run `deploy.sh` with a deliberately wrong `HOST` (or `COMPOSE_ARGS` typo) and
   confirm the ERR trap writes `FAILED at stage=…` **and** the footer with the non-zero code.

## 7. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `tee` flush race → truncated log | log misses the tail (often the error) | `TEE_PID` + `wait` in the `EXIT` trap; verified by the offline test |
| `exec` redirect hides output from the terminal | operator blind | `tee` keeps stdout live; only the file writes are new |
| Secrets leak through `set -x` or an echoed env file | credential exposure | no `set -x` rule + xtrace guard + documented policy (§5.5) + grep test |
| Log directory grows forever | disk usage on the operator machine | retention (`DEPLOY_LOG_KEEP=20`) + `latest.log` |
| Git Bash lacks `ln -s`/`readlink -f` | `latest.log` breaks | feature-detect and fall back to `cp` |
| Test files for deploy.sh drift from the real script | false confidence | keep the repro-style tests explicit; add the new logger test as a real sourcing test (not a copy) |
| Symlink `latest.log` inside the repo on Windows | confusing `git status` | `deploy/log/*` gitignored; only `.gitkeep` tracked |

## 8. Out of scope

- Rotating/retaining logs **on the droplet** (the compose logs are handled by the existing
  `deploy.sh logs` / runbook).
- JSON/structured output or shipping to a collector (a `DEPLOY_LOG_FORMAT=json` could be a later
  extension of the same module).
- Replacing the `[deploy]` prefix contract that the current offline tests match on.

## 9. Open decisions (need a call before implementation)

1. **Logger choice:** custom `deploy/lib/logger.sh` (recommended, §4.1) or vendor
   GingerGraham/bash-logger behind a thin adapter (§4.2)?
2. **Retention:** 20 runs (proposed) or another number? Also: is a `latest.log` symlink wanted?
3. **Extra subcommand:** add `deploy.sh log [n]` to tail the newest deploy log (next to the existing
   `logs` which tails container logs), or keep the CLI untouched?
4. **Scope:** log only `deploy.sh`, or immediately share `lib/logger.sh` with
   [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:1) and [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh:1)?
