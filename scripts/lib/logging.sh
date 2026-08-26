#!/usr/bin/env bash
# scripts/lib/logging.sh
# -----------------------------------------------------------------------------
# Consistent structured logging across all scripts in scripts/.
#
# Source with:
#     source "$(dirname "${BASH_SOURCE[0]}")/lib/logging.sh"
#
# Public API:
#     log "LEVEL" "message"           - logs to stderr (so stdout stays clean
#                                       for piping). Format:
#                                       [2026-08-26T15:21:58Z] [LEVEL] message
#     LOG_LEVEL=DEBUG        - env var, default INFO
#     LOG_FILE=/path/to.log  - if set, also appends to this file
#     DEBUG=1                - shortcut to force DEBUG level
#
# Numeric level values:
#     DEBUG=10, INFO=20, WARN=30, ERROR=40
# -----------------------------------------------------------------------------

if [ -n "${__LOGGING_SH_SOURCED:-}" ]; then
  return 0
fi
__LOGGING_SH_SOURCED=1

# Numeric log level (default INFO=20, can be overridden via env).
__LOG_LEVEL_NUM=20
case "${LOG_LEVEL:-INFO}" in
  DEBUG|debug) __LOG_LEVEL_NUM=10 ;;
  INFO|info)   __LOG_LEVEL_NUM=20 ;;
  WARN|WARN)   __LOG_LEVEL_NUM=30 ;;
  ERROR|error) __LOG_LEVEL_NUM=40 ;;
esac
if [ "${DEBUG:-0}" = "1" ]; then
  __LOG_LEVEL_NUM=10
fi

__log_should_emit() {
  # $1 = numeric level of the message
  [ "$1" -ge "${__LOG_LEVEL_NUM}" ]
}

__log_now() {
  # ISO 8601 UTC timestamp, e.g. 2026-08-26T15:21:58Z
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

__log_emit() {
  # $1 = numeric level, $2 = level label, $3 = message
  local now level label msg
  now="$(__log_now)"
  level="$1"
  label="$2"
  msg="$3"
  local line
  line="[${now}] [${label}] ${msg}"

  # Always emit to stderr so stdout can be piped.
  printf '%s\n' "${line}" >&2

  # Optionally append to a log file.
  if [ -n "${LOG_FILE:-}" ]; then
    printf '%s\n' "${line}" >> "${LOG_FILE}"
  fi
}

log_debug() { __log_should_emit 10 && __log_emit 10 DEBUG "$*"; }
log_info()  { __log_should_emit 20 && __log_emit 20 INFO  "$*"; }
log_warn()  { __log_should_emit 30 && __log_emit 30 WARN  "$*"; }
log_error() { __log_should_emit 40 && __log_emit 40 ERROR "$*"; }

# Convenience aliases matching colors.sh naming. We re-export them only if
# no function with the same name is defined, so colours and logging compose
# cleanly.
if ! declare -F info >/dev/null 2>&1; then
  info() { log_info "$*"; }
fi
if ! declare -F warn >/dev/null 2>&1; then
  warn() { log_warn "$*"; }
fi
if ! declare -F err >/dev/null 2>&1; then
  err() {
    log_error "$*"
    return 1
  }
fi
