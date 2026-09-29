#!/usr/bin/env bash
# Offline test for the M1 (ERR trap) addition in deploy.sh.
# Reproduces the trap block the deploy script now uses and confirms the
# banner + non-zero exit are produced.
set -uo pipefail
CURRENT_STAGE="init"
DEPLOY_START_TS="$(date +%s)"
log() { echo "[deploy] $*"; }
log_stage()  { CURRENT_STAGE="$1"; log "stage=$1"; }
on_err() {
  local exit_code=$?
  local line=${1:-?}
  log "FAILED at stage=$CURRENT_STAGE line=$line exit=$exit_code after $(( $(date +%s) - DEPLOY_START_TS ))s"
  exit "$exit_code"
}
trap 'on_err $LINENO' ERR

log_stage "synthetic_phase"
false   # any failing command
echo "should_not_reach_here"
exit 0
