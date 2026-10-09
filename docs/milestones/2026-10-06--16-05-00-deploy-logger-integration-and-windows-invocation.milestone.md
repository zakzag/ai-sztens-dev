# Deploy logging integration and the "window closes instantly" fix

**Date:** 2026-10-06 16:05
**Status:** done
**Scope:** `deploy/` (`deploy.sh`, `lib/logger.sh`, `deploy.ps1`, `.env`), `docs/Specs/Production-Runbook.md` §6.1, `scripts/test/_deploy-sh-{m1,logger}-test.sh`
**History entry:** `docs/history/2026-10-06--16-05-00-deploy-logger-integration-and-windows-invocation.md`

## 1. Problem / feature

On Windows, `deploy/deploy.sh <any command>` appeared to do nothing: a terminal window opened and
closed immediately, no error was visible, and no log was left to inspect. The request was to use the
existing `deploy/lib/logger.sh`, make failures visible while they happen, and fix the underlying bug.

## 2. Measured data / evidence

| Check | Observation |
|---|---|
| `assoc .sh` + `ftype sh_auto_file` | `.sh=sh_auto_file` → `"C:\Progs\Git\git-bash.exe" --no-cd "%L" %*` |
| `bash -c "E:\…\deploy\deploy.sh ps"` | `E:projectsAI2026-…-devdeploydeploy.sh: command not found` |
| `dir /b deploy` | `.env` absent (only `.env.example`) |
| `bash deploy/deploy.sh ps` | `line 59: HOST: Set HOST= in deploy/.env` → exit 1, nothing logged |
| matches for `logger` in `deploy.sh` | **0** — `deploy/lib/logger.sh` was never sourced |
| micro-test: `trap 'echo T' ERR; X=${Y:?boom}` | trap did **not** fire — `${VAR:?}` exits first (no stage banner) |
| micro-test: `trap 'log oops' ERR; false` | `log: command not found` — the trap replaces the real error |
| `_deploy-sh-logger-test.sh` | red: `R1 FAIL`, then `DEPLOY_LOG_FILE: unbound variable` |
| `deploy.sh` line endings | CR=0 / LF=404 — CRLF ruled out |

## 3. Root cause / design rationale

Three independent causes, plus a latent one:

1. **Invocation.** Typing `deploy/deploy.sh up` (or double-clicking) resolves `.sh` through the Git
   Bash association: a *new, throwaway* window is spawned and handed a backslash Windows path bash
   cannot resolve. The window dies before the message can be read.
2. **The script genuinely aborted on its first real check.** `deploy/.env` was missing, and
   `HOST="${HOST:?…}"` exits *before* the `ERR` trap can run — so even with a correct invocation
   there was no banner, no log and no hint about which value was missing.
3. **The logging layer was dead code.** The logger existed and was tested only offline; `deploy.sh`
   never sourced it, so a failed run left no artefact. This is why the failure was uninvestigable.
4. **Latent:** the `ERR` trap called `log()`, defined 76 lines below it — any failure in between
   would have been reported as `log: command not found`.

The logger's own offline suite was red, which is why none of this had been caught; reviving it
exposed five further defects (see §4).

Rejected alternatives: documenting "use Git Bash" without a wrapper (leaves the trap in place for
every future operator, and the M1 plan already promised a stage banner on abort); giving the script
a `deploy.ps1` twin that reimplements the deploy logic (duplicates the source of truth, drifts).

## 4. Solution / implementation

| File | Change |
|---|---|
| `deploy/deploy.sh` | sources `lib/logger.sh` **before** the guards; `export DEPLOY_LOG_DIR_PARENT="$SCRIPT_DIR"`; `deploy_log_init "${1:-}"` runs before the first check so every abort is logged; local `log()`/`log_stage()` removed (now from the logger); `HOST` guard becomes a logged, actionable `exit 1`; `ERR` trap declared after the logger and uses `log_error` (stage tag added by the logger); non-bash guard; usage text documents the three supported invocations; `--verbose` |
| `deploy/lib/logger.sh` | env knobs read **live** (a later `DEPLOY_LOG_FILE` was silently ignored); caller's stdout/stderr parked on fd 8/9 so the `tee` capture is closed and waited on; footer appended **directly** to the file (a subshell exit tore `tee` down before it flushed — the log kept only the header); idempotent; `latest.log` selection by mtime instead of first glob match, refreshed at the **end** of the run (on Windows `ln -s` degrades to `cp`); retention rewritten without `sort`/`xargs` (a bare `sort` resolves to `System32\sort.exe` on Windows) |
| `deploy/deploy.ps1` | **new** Windows wrapper: finds Git Bash/MSYS2 (never the WSL stub), converts to `/e/...`, runs bash in the current console, forwards the exit code, dumps the log tail on failure and holds a double-clicked window open |
| `deploy/.env` | **new** (gitignored), seeded from `.env.example`; `HOST` deliberately left for the operator |
| `deploy/README.md` | Windows invocation callout + §10 "Deploy logs" |
| `docs/Specs/Production-Runbook.md` | §6.1 rewritten for the new banner format + `deploy/log/` triage; header date refreshed |
| `scripts/test/_deploy-sh-m1-test.sh` | rewritten to source the real logger and assert trap ordering, banner, log capture and footer (7 assertions) instead of testing a stale copy that exited 1 by design |
| `scripts/test/_deploy-sh-logger-test.sh` | `setup_temp()` exported inside `$( )` (subshell) so the vars never reached the parent — fixed |

## 5. Outcome and how to verify

```
bash -n deploy/deploy.sh deploy/lib/logger.sh scripts/test/_deploy-sh-{m1,logger}-test.sh

bash scripts/test/_deploy-sh-m1-test.sh       # ALL_OK (7/7)
bash scripts/test/_deploy-sh-logger-test.sh   # 10 passed, 0 failed

bash deploy/deploy.sh help                    # usage text, exit 0 (also logged)
bash deploy/deploy.sh                         # usage text, exit 1 (no command given)

# a failing run is now visible AND logged:
bash deploy/deploy.sh ps                      # 3 actionable [ERROR] lines, exit 1
type deploy\log\latest.log                    # header + errors + footer (exit code, log path)

# Windows, the recommended path:
powershell -File deploy\deploy.ps1 ps         # streams here, dumps the log tail, exit 1
```

Expected on a fresh checkout: `deploy.sh` exits 1 with
`HOST is not set — there is nothing to deploy to.` plus the `cp deploy/.env.example deploy/.env`
instruction, logged to `deploy/log/latest.log`. Log files stay untracked (verified with
`git status --untracked-files=all deploy/log`).

## 6. Follow-ups

* `scripts/test/_deploy-sh-m3-test.sh` is red for a pre-existing, unrelated reason: Test 1 needs
  `infra/.env`, which is gitignored and absent from a fresh checkout. It also mirrors the
  pre-three-env resolution logic — worth rewriting alongside the next `infra/.env*` change.
* The `ERR` trap's remote `ps -a` + `logs` dump is verified structurally only; confirm it on the next
  real mid-deploy failure (banner must carry `[stage=…]`, same lines in `deploy/log/latest.log`).
* `deploy/lib/logger.sh` can now be shared with `deploy/bootstrap.sh` and `scripts/dev-stack.sh`,
  which still define their own `log()`.
