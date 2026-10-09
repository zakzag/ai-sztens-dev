#!/usr/bin/env bash
# AIsztens — minimal logging layer for deploy scripts.
#
# Sourced by deploy/deploy.sh and (in the future) deploy/bootstrap.sh /
# scripts/dev-stack.sh. Owns the "every run leaves a complete log in
# deploy/log/" contract; see docs/history/2026-10-06-deploy-script-logging-plan.md.
#
# This module is intentionally dependency-free (bash + coreutils only) so it
# works identically on Git Bash, WSL, Ubuntu CI runners and macOS.
#
# Public API
# ----------
#   deploy_log_init <command> [--verbose]
#       Create deploy/log/ (mkdir -p), compute the per-run log filename,
#       park the caller's stdout/stderr on fd 8/9, install the
#       `exec > >(tee -a "$LOG_FILE") 2>&1` capture, write the header, and
#       install the EXIT trap that writes the footer and flushes the tee.
#
#   log_debug / log_info / log_warn / log_error
#       Timestamped, level-tagged lines. log_debug is a no-op unless
#       DEPLOY_LOG_LEVEL=DEBUG (or --verbose).
#
#   log <message>
#       Backwards-compatible alias of log_info (keeps the ~30 existing call
#       sites in deploy/deploy.sh untouched).
#
#   log_stage <stage>
#       Set CURRENT_STAGE and log at INFO. Replaces the local log_stage()
#       that deploy.sh used to define.
#
#   log_cmd <cmd...>
#       DEBUG line that echoes the command about to run. Never used with
#       secrets.
#
#   deploy_log_finish <exit_code>
#       Write the footer (exit code, duration, log path), then flush the
#       capture: restore the caller's stdout/stderr and wait for `tee` so the
#       file always ends with a complete footer + the last failed command's
#       output. Idempotent (safe to call from the EXIT trap *and* directly).
#
#   deploy_log_prune
#       Keep only the newest DEPLOY_LOG_KEEP files in $LOG_DIR; refresh
#       deploy/log/latest.log.
#
#   deploy_log_reset (tests only)
#       Clear the module state so a new scenario starts clean.
#
# Environment knobs
# ----------------
#   DEPLOY_LOG_FILE      default unset (the module computes its own
#                        per-run filename). When set, the parent dir of
#                        that path is where the log lives and what
#                        `latest.log` points at (used by tests + by
#                        `deploy.sh log`).
#   DEPLOY_LOG_DIR       default unset. Absolute path to the log dir; used
#                        by `deploy.sh log` and friends.
#   DEPLOY_LOG_DIR_PARENT default unset. When set, the log dir is
#                        ${DEPLOY_LOG_DIR_PARENT}/log (the caller's SCRIPT_DIR
#                        is what they pass here).
#   DEPLOY_LOG_LEVEL     default: INFO   (DEBUG enables log_debug + log_cmd)
#   DEPLOY_LOG_KEEP      default: 20
#
# Secret safety
# -------------
#   * No `set -x` after `deploy/.env` is sourced (deploy.sh enforces this).
#   * This module refuses to start when bash's xtrace is on, so `bash -x
#     deploy.sh` cannot dump secrets into the file.
#   * The logger only prints the *names* of resolved env values
#     (APP_ENV, DOMAIN, host) — never the contents of *.env files.

set -uo pipefail

# ---------------------------------------------------------------------------
# Internal state (prefixed to avoid clashing with the caller).
# ---------------------------------------------------------------------------
_LOG_DIR="${DEPLOY_LOG_DIR:-}"
_LOG_FILE="${DEPLOY_LOG_FILE:-}"
_LOG_LEVEL="${DEPLOY_LOG_LEVEL:-INFO}"
_LOG_KEEP="${DEPLOY_LOG_KEEP:-20}"
_LOG_TEE_PIDS=""
_LOG_TEE_PID=""
_LOG_START_TS=""
_LOG_COMMAND=""
_CURRENT_STAGE="init"
_DEPLOY_LOG_INITED=0
_LOG_FINISHED=0
_LOG_FDS_SAVED=0

# Numbering the levels avoids string-comparison pitfalls in 3-arg pipes.
_LOG_LEVEL_DEBUG=10
_LOG_LEVEL_INFO=20
_LOG_LEVEL_WARN=30
_LOG_LEVEL_ERROR=40

_log_threshold() {
  case "$1" in
    DEBUG|debug) printf '%d' "$_LOG_LEVEL_DEBUG" ;;
    INFO|info)  printf '%d' "$_LOG_LEVEL_INFO"  ;;
    WARN|warn)  printf '%d' "$_LOG_LEVEL_WARN"  ;;
    ERROR|error) printf '%d' "$_LOG_LEVEL_ERROR" ;;
    *)           printf '%d' "$_LOG_LEVEL_INFO"  ;;
  esac
}

_log_level_enabled() {
  [ "$(_log_threshold "$1")" -ge "$(_log_threshold "$_LOG_LEVEL")" ]
}

_log_format_ts() { date +%Y-%m-%dT%H:%M:%S%z | sed 's/\([+-][0-9]\{2\}\)\([0-9]\{2\}\)$/\1:\2/'; }

# _log_mtime <file> -> epoch seconds on stdout (0 when undeterminable).
#
# GNU `stat -c %Y` first, then BSD/macOS `stat -f %m`. Kept as a helper so the
# retention and the `latest.log` logic share a single definition of "newest",
# and so neither needs a `sort` pipeline (see deploy_log_prune for why a bare
# `sort` is a portability trap on Windows).
_log_mtime() {
  local ts
  ts="$(stat -c '%Y' -- "$1" 2>/dev/null || true)"
  if [ -z "$ts" ]; then
    ts="$(stat -f '%m' -- "$1" 2>/dev/null || true)"
  fi
  case "$ts" in
    ''|*[!0-9]*) ts=0 ;;
  esac
  printf '%s' "$ts"
}

_log_write() {
  # Three args: LEVEL, message, [stage]
  local level="$1" msg="$2" stage="${3:-${_CURRENT_STAGE:-}}"
  local ts; ts="$(_log_format_ts)"
  local stage_tag=""
  if [ -n "$stage" ] && [ "$stage" != "init" ]; then stage_tag=" [stage=$stage]"; fi
  printf '%s [%-5s] [deploy]%s %s\n' "$ts" "$level" "$stage_tag" "$msg"
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# deploy_log_init <command> [--verbose]
#
# Bootstrap the log file. Must be called AFTER the caller's env is
# loaded (deploy.sh sources `deploy/.env` first so that the header can
# print APP_ENV/DOMAIN values). Safe to call once per script invocation.
deploy_log_init() {
  local command="${1:-}"
  shift || true
  local verbose=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --verbose|-v) verbose=1 ;;
      *) ;;
    esac
    shift || break
  done
  # Pick up the environment knobs LIVE. They used to be read only at source
  # time (`_LOG_LEVEL="${DEPLOY_LOG_LEVEL:-INFO}"` at the top of the file),
  # which silently ignored a later `DEPLOY_LOG_LEVEL=DEBUG deploy_log_init`.
  if [ -n "${DEPLOY_LOG_LEVEL:-}" ]; then _LOG_LEVEL="${DEPLOY_LOG_LEVEL}"; fi
  # `--verbose` wins over the environment.
  [ "$verbose" = 1 ] && _LOG_LEVEL=DEBUG

  # XTrace guard (R6 / secret safety). `set -x` after `deploy/.env` is
  # sourced would print SSH key paths and any future secret value into the
  # captured stream — refuse to start instead.
  case "$-" in *x*) log_error "Refusing to start: bash xtrace is on (set -x). unset -x first."; return 2 ;; esac

  # Resolve the log directory. These knobs are read LIVE — not from the
  # snapshot taken when this file was sourced — because callers set them
  # *afterwards*: deploy.sh exports DEPLOY_LOG_DIR_PARENT once it knows
  # SCRIPT_DIR, and the offline test pins DEPLOY_LOG_FILE per scenario.
  # Reading only the source-time snapshot meant a later DEPLOY_LOG_FILE was
  # silently ignored: the file name was then computed fresh and written into a
  # different directory than the caller had pinned.
  #
  # Priority:
  #   1. DEPLOY_LOG_FILE      -> the file is pinned; its dir follows from it
  #   2. DEPLOY_LOG_DIR_PARENT -> ${DEPLOY_LOG_DIR_PARENT}/log (caller injects
  #      the *parent* so this module never has to know deploy.sh's SCRIPT_DIR)
  #   3. DEPLOY_LOG_DIR       -> absolute log dir
  #   4. an already-resolved _LOG_DIR (second init in the same shell)
  if [ -n "${DEPLOY_LOG_FILE:-}" ]; then
    _LOG_FILE="${DEPLOY_LOG_FILE}"
    _LOG_DIR="$(dirname -- "${DEPLOY_LOG_FILE}")"
  elif [ -n "${DEPLOY_LOG_DIR_PARENT:-}" ]; then
    _LOG_DIR="${DEPLOY_LOG_DIR_PARENT}/log"
  elif [ -n "${DEPLOY_LOG_DIR:-}" ]; then
    _LOG_DIR="${DEPLOY_LOG_DIR}"
  elif [ -z "$_LOG_DIR" ]; then
    log_error "deploy_log_init: set DEPLOY_LOG_DIR_PARENT, DEPLOY_LOG_DIR or DEPLOY_LOG_FILE before calling."; return 2
  fi
  mkdir -p "$_LOG_DIR" || { log_error "deploy_log_init: failed to mkdir -p '$_LOG_DIR'"; return 2; }

  # Per-run filename. Compute a fresh one if the caller did not pin one.
  if [ -z "$_LOG_FILE" ]; then
    local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
    # Sanitise the command: keep alnum + _ - ; everything else becomes '_'.
    local safe_cmd; safe_cmd="$(printf '%s' "$command" | tr -cs '[:alnum:]_-' '_')"
    [ -z "$safe_cmd" ] && safe_cmd="run"
    _LOG_FILE="${_LOG_DIR}/deploy-${stamp}-${safe_cmd}.log"
  fi
  : > "$_LOG_FILE" || { log_error "deploy_log_init: cannot write to '$_LOG_FILE'"; return 2; }

  _LOG_COMMAND="$command"
  _LOG_START_TS="$(date +%s)"
  _DEPLOY_LOG_INITED=1
  trap 'deploy_log_finish $?' EXIT

  # ----- the capture redirect ------------------------------------------
  # From this point on, every stdout/stderr line (our own log_* writes
  # AND the output of every spawned command) is mirrored into the log
  # file by tee. The operator still sees the same live stream on the
  # terminal because process substitution (`>(…)`) doesn't replace the
  # caller's fds — it creates a fresh one the reader process is wired to.
  #
  # The caller's ORIGINAL stdout/stderr are parked on fd 8/9 first. Without
  # that there is no portable way to close the pipe again, and an unclosed
  # pipe means `tee` never sees EOF: it either drops the tail of a failed
  # run (exactly the lines an operator needs) or blocks forever in `wait`.
  if [ "$_LOG_FDS_SAVED" = 0 ]; then
    exec 8>&1 9>&2
    _LOG_FDS_SAVED=1
  fi
  exec > >(tee -a "$_LOG_FILE") 2>&1
  # bash >= 5.1 exposes the process-substitution PID in $!; older shells leave
  # it stale/empty, in which case deploy_log_finish falls back to a bare
  # `wait` (safe here: callers run everything else in the foreground).
  _LOG_TEE_PID="${!:-}"
  _LOG_TEE_PIDS="${_LOG_TEE_PIDS} ${_LOG_TEE_PID}"
  # -------------------------------------------------------------------

  # Write the header directly to the file (not via the tee redirect) so the
  # file is never empty even if the redirect above lost the first lines of
  # output (process-substitution timing on some shells).
  {
    local git_line shell_line user_line host_line
    git_line="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
    shell_line="bash ${BASH_VERSION:-?}, $(date -u +'%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo '?')"
    user_line="${USER:-${LOGNAME:-$(id -un 2>/dev/null || echo '?')}}"
    host_line="$(hostname 2>/dev/null || echo '?')"
    printf '===== AIsztens deploy =====\n'
    printf 'command      : %s\n' "${_LOG_COMMAND}"
    printf 'started      : %s\n' "$(_log_format_ts)"
    printf 'host         : %s (user=%s)\n' "$host_line" "$user_line"
    printf 'env          : APP_ENV=%s SPA_BUILD_MODE=%s DOMAIN=%s\n' "${APP_ENV:-?}" "${SPA_BUILD_MODE:-${APP_ENV:-?}}" "${DOMAIN:-?}"
    printf 'git          : %s (%s)\n' "$git_line" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    printf 'shell        : %s, pwd %s\n' "$shell_line" "$(pwd)"
    printf 'log file     : %s\n' "$_LOG_FILE"
    printf '============================\n'
  } >> "$_LOG_FILE"

  # Prune older runs before we start writing the new one, so the
  # directory is bounded even when a run dies early (R8).
  deploy_log_prune
}

deploy_log_finish() {
  local exit_code="${1:-0}"
  [ "$_DEPLOY_LOG_INITED" = 1 ] || return 0

  # ---- flush the capture FIRST, unconditionally --------------------------
  # Everything the run printed went into the tee pipe, and `tee` only writes
  # it out once its stdin reaches EOF. Restoring the caller's stdout/stderr
  # closes the write end; the `wait` then guarantees `tee` has drained before
  # the shell exits.
  #
  # This runs before — and independently of — the idempotency guard below,
  # because it must happen exactly once no matter how many times the function
  # is entered (deploy.sh relies on the EXIT trap, the offline test calls it
  # explicitly, and both may happen in one run).
  #
  # Losing this costs the whole run: observed on MSYS2, where a run that exits
  # from a subshell tears the `tee` child down before it flushes, leaving the
  # log with only the header (appended directly) and none of the actual error.
  if [ "$_LOG_FDS_SAVED" = 1 ]; then
    exec 1>&8 2>&9
    exec 8>&- 9>&-
    _LOG_FDS_SAVED=0
    # Prefer the recorded PID; bash < 5.1 leaves $! stale for process
    # substitutions and `wait` on a non-child fails — then fall back to a bare
    # `wait`, which is safe because callers keep every other command in the
    # foreground, so our own tee is the only child left.
    if [ -n "$_LOG_TEE_PID" ] && ! wait "$_LOG_TEE_PID" 2>/dev/null; then
      wait 2>/dev/null || true
    fi
  fi

  # Idempotent from here: writing the footer twice would duplicate the last
  # line of every log file.
  [ "$_LOG_FINISHED" = 0 ] || return 0
  _LOG_FINISHED=1

  local end_ts; end_ts="$(date +%s)"
  local duration=$(( end_ts - _LOG_START_TS ))
  local duration_human
  if [ "$duration" -ge 60 ]; then
    duration_human="$(( duration / 60 ))m$(( duration % 60 ))s"
  else
    duration_human="${duration}s"
  fi

  # The footer is appended DIRECTLY to the file instead of going through the
  # capture pipe: the pipe is closed by now, and this is the single most
  # important line of a failed run (exit code + log path). It is mirrored to
  # the console, which points at the operator's terminal again at this point.
  local level="INFO"
  [ "$exit_code" = 0 ] || level="ERROR"
  local footer
  footer="$(printf '%s [%-5s] [deploy] ===== finished: exit=%s duration=%s log=%s =====' \
    "$(_log_format_ts)" "$level" "$exit_code" "$duration_human" "$_LOG_FILE")"
  printf '%s\n' "$footer" >> "$_LOG_FILE"
  printf '%s\n' "$footer"

  # Refresh the pointer only now, after the run's last line exists (see the
  # helper for why init-time is too early).
  _deploy_log_refresh_latest
}

# ---------------------------------------------------------------------------
# Point deploy/log/latest.log at the newest per-run log.
#
# Called from deploy_log_prune (so a brand-new run is discoverable even if it
# dies without finishing) and again from deploy_log_finish (so the pointer is
# rewritten after the run's last line).
#
# The second call is what makes this correct on Windows: there `ln -s` is not
# available on most filesystems, so the symlink degrades to a plain `cp`, and a
# copy taken at init time stops at the header — before the run had done
# anything. Refreshing it at the end guarantees latest.log is the complete run.
# ---------------------------------------------------------------------------
_deploy_log_refresh_latest() {
  [ -n "$_LOG_DIR" ] && [ -d "$_LOG_DIR" ] || return 0
  # Picked by mtime, not by name: the per-run name is `<stamp>-<command>`, so
  # two runs inside the same second make a name sort ambiguous. The original
  # implementation took the FIRST glob match — i.e. the OLDEST file — which
  # pointed `latest.log` at a stale run and broke the "find the last failed
  # deploy in one command" contract. Ties break towards the later file name,
  # which for the zero-padded stamp is the newer run.
  local newest="" newest_ts="" f ts
  for f in "$_LOG_DIR"/deploy-*.log; do
    [ -f "$f" ] || continue
    ts="$(_log_mtime "$f")"
    if [ -z "$newest_ts" ] \
       || [ "$ts" -gt "$newest_ts" ] \
       || { [ "$ts" -eq "$newest_ts" ] && [[ "$f" > "$newest" ]]; }; then
      newest_ts="$ts"; newest="$f"
    fi
  done
  [ -n "$newest" ] || return 0
  rm -f "$_LOG_DIR/latest.log" 2>/dev/null || true
  if ln -s "$(basename -- "$newest")" "$_LOG_DIR/latest.log" 2>/dev/null; then
    : # real symlink — it always reflects the live file
  else
    cp -- "$newest" "$_LOG_DIR/latest.log" 2>/dev/null || true
  fi
}

deploy_log_prune() {
  [ -n "$_LOG_DIR" ] && [ -d "$_LOG_DIR" ] || return 0
  # Live read: the offline test (and an operator) sets DEPLOY_LOG_KEEP per call.
  local keep="${DEPLOY_LOG_KEEP:-${_LOG_KEEP:-20}}"
  local f ts

  # Retention: drop the oldest *completed* runs until `keep` remain. The run
  # currently being written ($_LOG_FILE) is never a candidate, so the meaning
  # is "keep the last N finished runs, plus this one".
  #
  # Everything here is pure bash + `stat` on purpose. The previous
  # `xargs stat | sort -nr | cut | tail` pipeline broke on Windows, where a
  # bare `sort` resolves to C:\Windows\System32\sort.exe as soon as /usr/bin is
  # not first in PATH: `sort -nr` then treats "-nr" as a filename and the whole
  # step fails with "The system cannot find the file specified."
  # Re-globbing per iteration keeps it readable and avoids array surgery; n is
  # the retention budget (tens of files), so the O(n^2) `stat` calls are free.
  while : ; do
    local -a current=()
    for f in "$_LOG_DIR"/deploy-*.log; do
      [ -f "$f" ] || continue
      [ "$f" = "$_LOG_FILE" ] && continue
      current+=("$f")
    done
    [ "${#current[@]}" -gt "$keep" ] || break
    local oldest="" oldest_ts=""
    for f in "${current[@]}"; do
      ts="$(_log_mtime "$f")"
      if [ -z "$oldest_ts" ] || [ "$ts" -lt "$oldest_ts" ]; then
        oldest_ts="$ts"; oldest="$f"
      fi
    done
    [ -n "$oldest" ] || break
    rm -f -- "$oldest" || true
  done

  # Retention is done; point latest.log at the newest remaining run.
  _deploy_log_refresh_latest
}

log_debug() { _log_level_enabled DEBUG || return 0; _log_write DEBUG "$1" "${2:-${_CURRENT_STAGE:-}}"; }
log_info()  { _log_level_enabled INFO  || return 0; _log_write INFO  "$1" "${2:-${_CURRENT_STAGE:-}}"; }
log_warn()  { _log_level_enabled WARN  || return 0; _log_write WARN  "$1" "${2:-${_CURRENT_STAGE:-}}"; }
log_error() { _log_level_enabled ERROR || return 0; _log_write ERROR "$1" "${2:-${_CURRENT_STAGE:-}}"; }

# Backwards-compat: keep the original `log` name so the ~30 call sites in
# deploy/deploy.sh keep working.
log() { log_info "$1" "${2:-${_CURRENT_STAGE:-}}"; }

log_stage() {
  _CURRENT_STAGE="$1"
  log_info "stage=$1"
}

log_cmd() {
  _log_level_enabled DEBUG || return 0
  log_info "exec: $*"
}

# ---------------------------------------------------------------------------
# Test helpers (not used by deploy.sh). Sourced only by the offline test.
# ---------------------------------------------------------------------------
deploy_log_reset() {
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
