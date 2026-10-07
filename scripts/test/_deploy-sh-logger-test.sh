#!/usr/bin/env bash
# Offline test for deploy/lib/logger.sh.
#
# Verifies the contract documented in
# docs/history/2026-10-06-deploy-script-logging-plan.md:
#   * the log directory is created on demand (R1)
#   * the per-run file name pattern + header fields (R2, R3)
#   * subprocess output is captured too (R4)
#   * the script's exit code is preserved and a footer is written on
#     both success and failure paths (R5)
#   * the xtrace guard refuses to start when bash is set -x (R6)
#   * the retention prunes to the newest DEPLOY_LOG_KEEP and refreshes
#     the latest.log pointer (R8)
#
# The test does not need the droplet, ssh or docker — it spawns a
# subshell that exercises the public API of the logger and inspects
# the resulting log files with grep / awk.
set -uo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/../../deploy/lib/logger.sh"

PASS=0
FAIL=0
log_test() {
  if [ "$1" = "ok" ]; then
    PASS=$((PASS + 1))
    printf '  [ OK ] %s\n' "$2"
  else
    FAIL=$((FAIL + 1))
    printf '  [FAIL] %s\n' "$2"
  fi
}

# Reset the logger module state between scenarios (reset() lives in
# logger.sh and is intended for tests).
reset_state() {
  deploy_log_reset
  # Clear the *environment* knobs too. Exported values survive in the parent
  # shell, and deploy_log_init() prefers DEPLOY_LOG_FILE over DEPLOY_LOG_DIR —
  # so a stale export from the previous scenario silently sent the next run
  # into the previous scenario's directory (this is what broke R8).
  unset DEPLOY_LOG_FILE DEPLOY_LOG_DIR_PARENT DEPLOY_LOG_DIR
  _LOG_DIR=""
  _LOG_FILE=""
  _LOG_LEVEL="INFO"
  _LOG_KEEP="20"
  _LOG_TEE_PIDS=""
  _LOG_TEE_PID=""
  _LOG_START_TS=""
  _LOG_COMMAND=""
  _CURRENT_STAGE="init"
  _DEPLOY_LOG_INITED=0
  _LOG_FINISHED=0
  _LOG_FDS_SAVED=0
  trap - EXIT
}

# Each test scenario runs in its own temp dir + uses a dedicated log
# filename, so the tests do not depend on each other.
#
# NOTE: do NOT call this as `tmp="$(setup_temp)"`. Command substitution runs the
# function in a *subshell*, so every `export` made inside it is discarded on
# return and deploy_log_init() aborts with
#   set DEPLOY_LOG_DIR_PARENT, DEPLOY_LOG_DIR or DEPLOY_LOG_FILE before calling
# which made R1 fail and the later scenarios die on `DEPLOY_LOG_FILE: unbound
# variable`. The directory is handed back through SETUP_TMP (a parent-shell
# variable) and applied with use_temp_env().
SETUP_TMP=""
setup_temp() { SETUP_TMP="$(mktemp -d)"; }

use_temp_env() {
  # Keep the two knobs consistent: DEPLOY_LOG_DIR_PARENT (=$SETUP_TMP) makes
  # the module create $SETUP_TMP/log, and pinning DEPLOY_LOG_FILE inside that
  # same directory satisfies the DEPLOY_LOG_FILE-first precedence while giving
  # each scenario a stable, predictable filename for the assertions below.
  export DEPLOY_LOG_DIR_PARENT="$SETUP_TMP"
  export DEPLOY_LOG_FILE="$SETUP_TMP/log/deploy-test.log"
}

# -----------------------------------------------------------------------
# R1: deploy_log_init creates the log directory when it does not exist.
# -----------------------------------------------------------------------
setup_temp
tmp="$SETUP_TMP"
use_temp_env
deploy_log_init up
if [ -d "$tmp/log" ] && [ -f "$tmp/log/$(basename -- "$DEPLOY_LOG_FILE")" ]; then
  log_test ok "R1: directory + file are created on first run"
else
  log_test fail "R1: directory + file are created on first run (tmp=$tmp)"
fi
reset_state

# -----------------------------------------------------------------------
# R2 + R3: filename pattern, header fields, level tags, ISO-8601 ts.
# -----------------------------------------------------------------------
setup_temp
tmp="$SETUP_TMP"
use_temp_env
DEPLOY_LOG_KEEP=50 deploy_log_init up
log_info "hello world"
log_warn "be careful"
log_error "boom"
deploy_log_finish 0
content="$(cat "$DEPLOY_LOG_FILE")"
if echo "$content" | grep -q "^===== AIsztens deploy =====" \
   && echo "$content" | grep -q "command      : up" \
   && echo "$content" | grep -q "log file     : " \
   && echo "$content" | grep -q "============================"; then
  log_test ok "R2: file has a stable name + header/footer"
else
  log_test fail "R2: file has a stable name + header/footer (log=$DEPLOY_LOG_FILE)"
fi
if printf '%s\n' "$content" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2} \[INFO \] \[deploy\] hello world$'; then
  log_test ok "R3: timestamps + level (without stage, when no stage set)"
else
  log_test fail "R3: timestamps + level (without stage, when no stage set)"
fi
if echo "$content" | grep -q "\[WARN \]" && echo "$content" | grep -q "\[ERROR\]"; then
  log_test ok "R3: warn + error levels are tagged"
else
  log_test fail "R3: warn + error levels are tagged"
fi
reset_state

# -----------------------------------------------------------------------
# R4: stdout/stderr from a spawned command lands in the log.
# -----------------------------------------------------------------------
setup_temp
tmp="$SETUP_TMP"
use_temp_env
deploy_log_init up
printf 'STDOUT_FROM_SUBPROCESS\n'
printf 'STDERR_FROM_SUBPROCESS\n' >&2
deploy_log_finish 0
if grep -q "STDOUT_FROM_SUBPROCESS" "$DEPLOY_LOG_FILE" \
   && grep -q "STDERR_FROM_SUBPROCESS" "$DEPLOY_LOG_FILE"; then
  log_test ok "R4: subprocess stdout and stderr are captured"
else
  log_test fail "R4: subprocess stdout and stderr are captured (log=$DEPLOY_LOG_FILE)"
fi
reset_state

# -----------------------------------------------------------------------
# R5: the script's exit code is preserved + the footer reports it.
# We spawn a child shell that sources the logger and then returns a
# non-zero code.
# -----------------------------------------------------------------------
fail_tmp="$(mktemp -d)"
LOGFILE="${fail_tmp}/exit.log"
set +e
( set -e
  DEPLOY_LOG_FILE="$LOGFILE" deploy_log_init up >/dev/null 2>&1
  log_info "about to fail"
  false
) >/dev/null 2>&1
got=$?
set -e
if [ "$got" != 0 ] && grep -q "exit=${got}" "$LOGFILE"; then
  log_test ok "R5: failure path keeps the exit code + writes the footer (got=$got)"
else
  log_test fail "R5: failure path keeps the exit code + writes the footer (got=$got, log=$LOGFILE)"
fi
reset_state

# -----------------------------------------------------------------------
# R6: xtrace guard refuses to start when `set -x` is on.
# -----------------------------------------------------------------------
set +e
( set -x; deploy_log_init up >/dev/null 2>&1 ) >/dev/null 2>&1
xrc=$?
set -e
if [ "$xrc" = 2 ]; then
  log_test ok "R6: xtrace guard refuses to start (exit=2)"
else
  log_test fail "R6: xtrace guard refuses to start (exit=$xrc)"
fi
reset_state

# -----------------------------------------------------------------------
# R8: retention keeps the newest DEPLOY_LOG_KEEP files and refreshes
# latest.log.
# -----------------------------------------------------------------------
prune_tmp="$(mktemp -d)"
DEPLOY_LOG_DIR="${prune_tmp}/log"
DEPLOY_LOG_KEEP=3
mkdir -p "$DEPLOY_LOG_DIR"
# Seed 5 fake old runs (use the file-name pattern the real logger writes).
for i in 1 2 3 4 5; do
  printf 'old %d\n' "$i" > "$DEPLOY_LOG_DIR/deploy-20260101-00000${i}-up.log"
  touch -d "2026-01-01 00:00:0${i}" "$DEPLOY_LOG_DIR/deploy-20260101-00000${i}-up.log"
done
# Add one current run.
deploy_log_init up
log_info "current"
deploy_log_finish 0
# Now there should be 4 (the current + the 3 newest of the 5).
count="$(ls -1 "$DEPLOY_LOG_DIR"/deploy-*.log 2>/dev/null | wc -l | tr -d ' ')"
if [ "$count" = 4 ]; then
  log_test ok "R8: retention keeps 3 (3 old + 1 new = 4)"
else
  log_test fail "R8: retention expected 4 files, got $count"
fi
if [ -e "$DEPLOY_LOG_DIR/latest.log" ] && grep -q "current" "$DEPLOY_LOG_DIR/latest.log"; then
  log_test ok "R8: latest.log points at the newest run"
else
  log_test fail "R8: latest.log is missing or stale"
fi
reset_state

# -----------------------------------------------------------------------
# Sanity: the public `log` alias still works (deploy.sh has ~30 sites).
# -----------------------------------------------------------------------
setup_temp
tmp="$SETUP_TMP"
use_temp_env
deploy_log_init up
log "backwards-compatible"
deploy_log_finish 0
if grep -q "backwards-compatible" "$DEPLOY_LOG_FILE"; then
  log_test ok "compatibility: legacy log alias still writes through the redirect"
else
  log_test fail "compatibility: legacy log alias still writes through the redirect"
fi
reset_state

echo
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
