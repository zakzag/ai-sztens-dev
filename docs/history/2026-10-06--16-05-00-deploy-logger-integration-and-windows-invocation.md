# Deploy logger integration + Windows invocation fix

**Date:** 2026-10-06 16:05
**Status:** done
**Scope:** [`deploy/deploy.sh`](../../deploy/deploy.sh), [`deploy/lib/logger.sh`](../../deploy/lib/logger.sh), [`deploy/deploy.ps1`](../../deploy/deploy.ps1) (new), `deploy/.env` (seeded, gitignored), [`deploy/README.md`](../../deploy/README.md), [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md) §6.1, [`scripts/test/_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh), [`scripts/test/_deploy-sh-logger-test.sh`](../../scripts/test/_deploy-sh-logger-test.sh)
**Related:** [logging plan](2026-10-06-deploy-script-logging-plan.md), [milestone](../milestones/2026-10-06--16-05-00-deploy-logger-integration-and-windows-invocation.milestone.md)

---

## 1. Symptom reported

> "If I run `deploy/deploy.sh` with any parameter (`up`, `ps`, …) it does nothing — a CLI window
> opens and closes immediately. I cannot see whether there is an error, and if there is, what it
> is. Please use the `deploy/lib/logger.sh` logger and let me see the error. And fix the bug."

## 2. Investigation (all facts measured, not assumed)

Reflection list of candidate causes, and their verdict:

| # | Candidate | Verdict | Evidence |
|---|---|---|---|
| 1 | CRLF line endings → bad interpreter / `$'\r'` | **ruled out** | `deploy.sh` is CR=0 / LF=404; [`.gitattributes`](../../.gitattributes:22) forces `*.sh text eol=lf` |
| 2 | Windows `.sh` file association | **confirmed** | `assoc .sh` → `sh_auto_file`; `ftype` → `"C:\Progs\Git\git-bash.exe" --no-cd "%L" %*` |
| 3 | Missing `deploy/.env` | **confirmed** | `dir /b deploy` has no `.env`; `HOST="${HOST:?…}"` aborts |
| 4 | Logger never wired in | **confirmed** | zero matches for `logger` / `deploy_log_init` in `deploy.sh` |
| 5 | `ERR` trap installed long before `log()` is defined | **confirmed (latent)** | trap at former line 52, `log()` at former line 128 |
| 6 | `exec > >(tee …)` swallowing output | not applicable | the redirect was never executed (see #4) |
| 7 | PowerShell/cmd cannot execute `.sh` (no PATHEXT) → ShellExecute | **confirmed** | this is the mechanism behind #2 |

Micro-tests run with bash directly:

```
T1  trap 'echo TRAP_FIRED' ERR; X=${Y:?boom}
    → Y: boom                 (trap never fires: no banner, no log)
T2  trap 'log oops' ERR; false
    → log: command not found  (the real error is destroyed by the trap itself)
T3  bash -c "E:\...\deploy\deploy.sh ps"
    → E:projectsAI2026-...-devdeploydeploy.sh: command not found
```

Reproduction with an explicit interpreter:

```
$ bash deploy/deploy.sh ps
deploy/deploy.sh: line 59: HOST: Set HOST= in deploy/.env      # exit 1, nothing logged
```

## 3. Root causes and fixes

### 3.1 "A window opens and closes" — the Windows file association, not the script

Typing `deploy/deploy.sh up` resolves `.sh` through `git-bash.exe --no-cd "%L" %*`, which opens a
**new, throwaway** MinTTY window and hands bash a backslash Windows path it cannot resolve (T3).
The window closes before the message can be read, and it is not the terminal that was invoked, so
the output has nowhere to go.

Fixed by [`deploy/deploy.ps1`](../../deploy/deploy.ps1): a wrapper that locates a real bash
(Git for Windows / MSYS2, never the WSL stub), converts the path to `/e/...`, runs bash as a child
of the current console (no new window), forwards the exit code, prints the tail of
`deploy/log/latest.log` on failure and keeps the window open for a double-clicked run. In addition
`deploy.sh` now refuses to run under a non-bash shell, and its usage text documents the three
supported invocations.

### 3.2 The script really did abort instantly — `HOST` was unset

`deploy/.env` did not exist, so `HOST="${HOST:?Set HOST= in deploy/.env}"` killed the shell. Micro-test
T1 shows that `${VAR:?}` exits **without** firing the `ERR` trap, so the M1 stage banner never
printed either. Replaced by an explicit, logged guard (`log_error` × 3 + `exit 1`) that names the
missing variable and the exact command to fix it. `deploy/.env` was seeded from `.env.example`
(gitignored) so the next run has a file to fill in.

### 3.3 The logger was written but never connected

`deploy.sh` never sourced `deploy/lib/logger.sh`, so no `deploy/log/` artefact was ever produced —
which is exactly why the failure was unforensible. Now: the logger is sourced before anything else
can fail, `export DEPLOY_LOG_DIR_PARENT="$SCRIPT_DIR"`, and `deploy_log_init "${1:-}"` runs
**before** the first guard, so even an abort during configuration parsing leaves a complete log
with header, error and footer.

### 3.4 The `ERR` trap could mask the real error

`on_err` called `log()`, which was defined 76 lines below the trap (micro-test T2: the trap prints
`log: command not found` and the original error is lost). The trap is now declared after the logger
is sourced, and it uses `log_error`, whose `[stage=…]` tag the logger adds automatically (so the
`CURRENT_STAGE` variable no longer has to be hand-maintained).

### 3.5 Four further bugs found while reviving the offline logger test

The suite was red, which is why none of the above was caught earlier:

| Bug in `deploy/lib/logger.sh` | Consequence | Fix |
|---|---|---|
| `DEPLOY_LOG_FILE` / `DEPLOY_LOG_LEVEL` / `DEPLOY_LOG_KEEP` were read only at *source* time | a caller that set them afterwards was silently ignored (the file was written under a different name) | knobs are re-read live in `deploy_log_init` / `deploy_log_prune` |
| `latest.log` was chosen as the **first** glob match (the oldest file) | "read the last failed deploy in one command" pointed at a stale run | selection by mtime, ties broken by name |
| `latest.log` was refreshed at *init* time | on Windows `ln -s` degrades to `cp`, so the copy stopped at the header, before the run did anything | refresh moved to `deploy_log_finish`, after the footer |
| `xargs stat \| sort -nr \| cut \| tail` for retention | on Windows a bare `sort` resolves to `C:\Windows\System32\sort.exe`; `sort -nr` treats `-nr` as a filename → `The system cannot find the file specified.` | replaced with pure bash + a `stat -c`/`stat -f` helper |
| the footer went through the `tee` pipe | a run that exits from a subshell tears `tee` down before it flushes — the log kept only the header (observed: 381 bytes, header only) | footer appended **directly** to the file; the capture is flushed first and unconditionally (fds 8/9 are parked in `deploy_log_init`) |

The test itself was also broken: `setup_temp()` `export`ed inside `$( )`, i.e. in a subshell, so the
variables never reached the parent (`R1 FAIL`, then `DEPLOY_LOG_FILE: unbound variable`). It now
hands the directory back through a parent-shell variable.

### 3.6 `help` and no-args were unreachable

`deploy_log_init` and the `HOST` guard both run before the command `case`, so `deploy.sh help`
(and a bare `deploy.sh`) aborted with the `HOST` error instead of printing the command list: the
usage branch was dead code unless a droplet was already configured. `print_usage()` is now invoked
from an early dispatch placed directly after `deploy_log_init` — `help|-h|--help` prints the usage
and exits **0**, no argument prints it and exits 1, and the final `*)` branch reports an unknown
command with the same text on stderr (so it lands in the log).

## 4. Changed files

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | sources the logger before the guards; calls `deploy_log_init`; drops the local `log()`/`log_stage()`; logs the resolved (non-secret) config; explicit logged `HOST` guard; `ERR` trap after the logger; bash guard; usage text + `--verbose` |
| [`deploy/lib/logger.sh`](../../deploy/lib/logger.sh) | live env reads; fd 8/9 capture + guaranteed flush; idempotent footer written directly to the file; mtime-based `latest.log` helper refreshed at the end of a run; sort-free retention |
| [`deploy/deploy.ps1`](../../deploy/deploy.ps1) | **new** Windows wrapper (see 3.1) |
| `deploy/.env` | **new** (gitignored), seeded from `.env.example`, `HOST` left for the operator |
| [`deploy/README.md`](../../deploy/README.md) | "How to run the deploy script on Windows" callout + §10 "Deploy logs" |
| [`docs/Specs/Production-Runbook.md`](../Specs/Production-Runbook.md) | §6.1 banner format, `deploy/log/` triage, Windows invocation note; header date refreshed |
| [`scripts/test/_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh) | rewritten: sources the real logger, asserts the trap ordering, the banner, the log capture and the footer (7 assertions) instead of testing a stale copy |
| [`scripts/test/_deploy-sh-logger-test.sh`](../../scripts/test/_deploy-sh-logger-test.sh) | fixed the subshell-export bug; now 10/10 green |

## 5. Verification

```
bash -n deploy/deploy.sh deploy/lib/logger.sh scripts/test/_deploy-sh-{m1,logger}-test.sh   # all clean

bash scripts/test/_deploy-sh-m1-test.sh       # ALL_OK  (7/7 PASS)
bash scripts/test/_deploy-sh-logger-test.sh   # Results: 10 passed, 0 failed

bash deploy/deploy.sh help                    # usage text, exit 0 (also captured in the log)
bash deploy/deploy.sh                         # usage text, exit 1 (no command given)
bash deploy/deploy.sh ps                      # 3 actionable [ERROR] lines + footer, exit 1
type deploy\log\latest.log                    # complete log: header, errors, footer

powershell -File deploy\deploy.ps1 ps         # streams into this console, dumps log tail, exit 1
```

The generated `deploy/log/deploy-*.log` and `latest.log` are gitignored (verified with
`git status --untracked-files=all deploy/log`).

## 6. Follow-ups

* `scripts/test/_deploy-sh-m3-test.sh` is red **independently of this change**: its Test 1 requires
  `infra/.env`, which is gitignored and absent from a fresh checkout (only `infra/.env.dev` exists).
  It also still mirrors the pre-three-env resolution logic. Worth rewriting against the current
  `upload()` block the next time `infra/.env*` handling is touched.
* The `ERR` trap path (remote `ps -a` + `logs` dump on a mid-deploy failure) is verified
  structurally, not dynamically: exercising it requires a reachable droplet. On the next real deploy
  failure, confirm the banner carries `[stage=…]` and that the same lines are in
  `deploy/log/latest.log`.
* `deploy/lib/logger.sh` is now ready to be shared with [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh)
  and [`scripts/dev-stack.sh`](../../scripts/dev-stack.sh), which still define their own `log()`.
