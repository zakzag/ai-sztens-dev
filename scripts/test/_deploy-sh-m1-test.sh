#!/usr/bin/env bash
# Offline regression test for the M1 (ERR trap) block of deploy/deploy.sh and
# for its logging integration (deploy/lib/logger.sh).
#
# HISTORY
# -------
# This file used to *reproduce* the trap block and define its own
# `log() { echo "[deploy] $*"; }`. That meant it kept passing while asserting
# nothing about the real script, and it silently diverged once deploy.sh began
# sourcing deploy/lib/logger.sh. Worse, its exit code was 1 by design (the trap
# it copied called `exit`), so it could not be used as a green/red signal.
#
# It now sources the real logger and asserts the two guarantees the
# integration depends on:
#
#   1. ORDERING. `log`/`log_error` must be defined *before* the ERR trap is
#      installed. deploy.sh used to declare the trap ~76 lines above its local
#      `log()`, so any failure in between replaced the real error with
#      `log: command not found` and the operator saw nothing useful.
#   2. REPORTING. A failing command must produce the `FAILED at line=…` banner,
#      a non-zero exit code, and a log file that ends with a footer carrying
#      that exit code (which also guards the tee flush in deploy_log_finish).
#
# Offline: needs no droplet, no ssh, no docker.
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$TEST_DIR/../.." && pwd)}"
LOGGER_LIB="$REPO_DIR/deploy/lib/logger.sh"

if [ ! -f "$LOGGER_LIB" ]; then
  echo "FAIL  logger library not found at $LOGGER_LIB"
  exit 1
fi

# shellcheck source=../../deploy/lib/logger.sh disable=SC1091
. "$LOGGER_LIB"

fail=0

assert_eq() {
  local got=$1 want=$2 label=$3
  if [ "$got" = "$want" ]; then
    echo "PASS  $label  ($got)"
  else
    echo "FAIL  $label  got=$got want=$want"
    fail=1
  fi
}

assert_grep() {
  local pattern=$1 file=$2 label=$3
  if grep -q -- "$pattern" "$file" 2>/dev/null; then
    echo "PASS  $label"
  else
    echo "FAIL  $label  (pattern '$pattern' not found in ${file##*/})"
    fail=1
  fi
}

assert_no_grep() {
  local pattern=$1 file=$2 label=$3
  if grep -q -- "$pattern" "$file" 2>/dev/null; then
    echo "FAIL  $label  (unexpected '$pattern')"
    fail=1
  else
    echo "PASS  $label"
  fi
}

tmp="$(mktemp -d)"
log_file="$tmp/run.log"
console_file="$tmp/console.txt"

# ---------------------------------------------------------------------------
# The scenario: the same declaration order deploy.sh uses.
#
# It runs in a child shell because on_err() exits, which would otherwise end
# this test. Note the logger is sourced BEFORE the trap is installed — that
# order is exactly what is being tested.
# ---------------------------------------------------------------------------
(
  set -euo pipefail
  # shellcheck disable=SC1091
  . "$LOGGER_LIB"

  # No redirection on this call: deploy_log_init installs the capture with
  # `exec > >(tee -a …)`, and attaching a redirect to the call would make bash
  # restore the previous fds when the function returns.
  DEPLOY_LOG_FILE="$log_file" deploy_log_init "m1-test"

  DEPLOY_START_TS="$(date +%s)"
  on_err() {
    local exit_code=$?
    local line=${1:-?}
    log_error "FAILED at line=$line exit=$exit_code after $(( $(date +%s) - DEPLOY_START_TS ))s"
    exit "$exit_code"
  }
  trap 'on_err $LINENO' ERR

  log_stage "synthetic_phase"
  false # any failing command
  echo "should_not_reach_here"
) >"$console_file" 2>&1
rc=$?

echo "--- trap + logging integration (log=$log_file) ---"

# 1. The failure must not be swallowed and must keep its exit code.
assert_eq "$rc" "1" "trap.exit-code-preserved"

# 2. The banner must be visible, and the trap must not have blown up on an
#    undefined logging function (the ordering regression).
assert_grep 'FAILED at line=' "$console_file" "trap.banner-on-console"
assert_no_grep 'log: command not found' "$console_file" "trap.log-defined-before-trap"

# 3. The trap must abort the run, not let it continue.
assert_no_grep 'should_not_reach_here' "$console_file" "trap.aborts-execution"

# 4. The stage breadcrumb and the banner must reach the log file, i.e. the
#    capture really mirrored the run (this is what the tee flush protects).
assert_grep 'stage=synthetic_phase' "$log_file" "log.stage-breadcrumb"
assert_grep 'FAILED at line=' "$log_file" "log.banner-in-log"

# 5. The log must end with the footer carrying the exit code.
assert_grep 'finished: exit=1' "$log_file" "log.footer-with-exit-code"

rm -rf -- "$tmp"

if [ "$fail" = "0" ]; then
  echo "ALL_OK"
  exit 0
fi
echo "SOME_FAILED"
exit 1
