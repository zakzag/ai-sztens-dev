#!/usr/bin/env bash
# AIsztens — stack smoke test prelude.
#
# Shared helpers and global state for the smoke test suite. Sourced by
# scripts/test/stack-smoke.sh before any check runs. Defines:
#
#   * path resolution (REPO_ROOT, COMPOSE_FILE, ENV_FILE)
#   * thin wrappers around `docker compose` so check code stays readable
#   * logging helpers with automatic TTY colorization
#   * assertion helpers (assert_service, assert_log_contains)
#   * preflight_stack_up — aborts with code 2 if nothing is running
#   * summary_and_exit — prints totals and returns the aggregate exit code
#
# All counters (PASS_COUNT, FAIL_COUNT) live in this file so the same module
# owns both the increments and the final report.

set -euo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

# Resolve the repository root from this file's location so the script can be
# invoked from any working directory. We intentionally do NOT rely on
# ${BASH_SOURCE[0]} because:
#   * When this file is sourced via `source <(...)` (process substitution)
#     BASH_SOURCE[0] is empty, which combined with `set -u` aborts the run.
#   * When it is sourced via `bash -c "... source ..."` the same is true.
# Instead we use $0 from the entrypoint script (which knows its own argv[0])
# or fall back to a derived path from REPO_ROOT_OVERRIDE (also exported).
#
# Convention: the entrypoint sets SMOKE_ENTRYPOINT to its own $0 before
# sourcing this file. We walk from there: scripts/test/<file> -> repo root.
if [ -n "${SMOKE_ENTRYPOINT:-}" ] && [ -f "$SMOKE_ENTRYPOINT" ]; then
  _ENTRYPOINT_DIR="$(cd "$(dirname "$SMOKE_ENTRYPOINT")" && pwd)"
elif [ -n "${REPO_ROOT_OVERRIDE:-}" ]; then
  _ENTRYPOINT_DIR="$REPO_ROOT_OVERRIDE/scripts/test"
else
  # Last-resort fallback: walk from CWD. Useful when the script is run as
  # `bash scripts/test/stack-smoke.sh` from the repo root.
  _ENTRYPOINT_DIR="$(pwd)/scripts/test"
fi

TEST_DIR="$(cd "$_ENTRYPOINT_DIR" && pwd)"
TEST_LIB_DIR="$TEST_DIR/lib"
SCRIPTS_DIR="$(cd "$TEST_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
unset _ENTRYPOINT_DIR

# Defaults can be overridden via flags on stack-smoke.sh. We export them so
# the helper scripts in 10/20/99 can read them without re-parsing $@.
export REPO_ROOT
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose.yml}"
export ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env}"

# Flag-driven options (set by stack-smoke.sh before sourcing this file):
#   SMOKE_OPT_UP    — non-empty means also run `docker compose up -d --build`
#   SMOKE_OPT_DOWN  — non-empty means run `docker compose down` after success
#   SMOKE_OPT_YES   — non-empty means skip teardown confirmation prompt
#
# The image-based deploy model changed how `dc up` resolves files. The
# base infra/docker-compose.yml references pre-built GHCR images only,
# so a fresh checkout cannot `up -d --build` against it: the images are
# not on the developer's machine. The local override re-adds `build:`
# blocks for every application service, so a local run merges both
# files. The droplet-side call (CI) uses just the base compose file.
LOCAL_COMPOSE_OVERRIDE="$REPO_ROOT/infra/docker-compose.local.yml"
if [ -f "$LOCAL_COMPOSE_OVERRIDE" ]; then
  export COMPOSE_LOCAL_OVERRIDE="$LOCAL_COMPOSE_OVERRIDE"
else
  export COMPOSE_LOCAL_OVERRIDE=""
fi

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------

PASS_COUNT="${PASS_COUNT:-0}"
FAIL_COUNT="${FAIL_COUNT:-0}"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

_smoke_color_on=""
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  _smoke_color_on=1
fi

_smoke_green()  { [ -n "$_smoke_color_on" ] && printf '\033[32m%s\033[0m' "$1" || printf '%s' "$1"; }
_smoke_red()    { [ -n "$_smoke_color_on" ] && printf '\033[31m%s\033[0m' "$1" || printf '%s' "$1"; }
_smoke_yellow() { [ -n "$_smoke_color_on" ] && printf '\033[33m%s\033[0m' "$1" || printf '%s' "$1"; }
_smoke_gray()   { [ -n "$_smoke_color_on" ] && printf '\033[90m%s\033[0m' "$1" || printf '%s' "$1"; }

log_info()    { echo "  $(_smoke_gray '[..]')$*"; }
log_pass()    { echo "  $(_smoke_green '[ OK ]')$*"; }
log_fail()    { echo "  $(_smoke_red '[FAIL]')$*"; }
log_section() { echo ""; echo "$(_smoke_yellow "$*")"; }

# ---------------------------------------------------------------------------
# docker compose wrappers
# ---------------------------------------------------------------------------

# dc <subcmd...> — invoke docker compose with the resolved files.
dc() {
  # --project-directory anchors the compose call to the repo root so the
  # `context: ..` build in infra/app/Dockerfile resolves correctly even when
  # the script is invoked from a different cwd.
  # When the local override exists we merge it on top of the base so a
  # developer can `up -d --build` without a registry (the override
  # re-adds `build:` blocks for api/web/admin/monitor). On the droplet
  # the local override is never present and only the base compose file
  # is used.
  local -a files
  files=(-f "$COMPOSE_FILE")
  if [ -n "${COMPOSE_LOCAL_OVERRIDE:-}" ] && [ -f "$COMPOSE_LOCAL_OVERRIDE" ]; then
    files+=(-f "$COMPOSE_LOCAL_OVERRIDE")
  fi
  docker compose \
    --project-directory "$REPO_ROOT" \
    --env-file "$ENV_FILE" \
    "${files[@]}" \
    "$@"
}

# dc_exec <service> <cmd...> — run a command inside a running container.
# Uses -T to disable pseudo-tty allocation so output is safe to capture.
dc_exec() {
  local service="$1"; shift
  dc exec -T "$service" "$@"
}

# dc_logs <service> [args...] — fetch logs for a service.
dc_logs() {
  local service="$1"; shift
  dc logs "$service" "$@"
}

# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------

# assert_service <name> <description> <command...>
#
# Runs <command...> and treats exit code 0 as PASS, anything else as FAIL.
# On failure the captured stderr is shown (one line at a time) to help
# diagnose. The exit status of the command itself is intentionally discarded
# because we want to keep going and report every check.
assert_service() {
  local name="$1"
  local description="$2"
  shift 2

  local err_out
  if err_out="$("$@" 2>&1 1>/dev/null)"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    log_pass "$name: $description"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_fail "$name: $description"
    if [ -n "$err_out" ]; then
      # Indent stderr to make the failure block easy to scan.
      printf '%s\n' "$err_out" | sed 's/^/      /'
    fi
  fi
}

# assert_service_out <name> <description> <expected_substring> <command...>
#
# Like assert_service but also asserts that stdout contains <expected_substring>.
# This is the right helper for HTTP-body checks where "did it respond 200" is
# not enough — we also want to see the expected payload.
assert_service_out() {
  local name="$1"
  local description="$2"
  local expected="$3"
  shift 3

  local out
  if ! out="$("$@" 2>&1)"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_fail "$name: $description"
    printf '%s\n' "$out" | sed 's/^/      /'
    return 0
  fi

  if printf '%s' "$out" | grep -q -- "$expected"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    log_pass "$name: $description"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_fail "$name: $description (expected substring: $expected)"
    printf '%s\n' "$out" | sed 's/^/      /'
  fi
}

# assert_log_contains <name> <description> <service> <pattern> [tail_lines]
#
# Reads the last <tail_lines> log lines of <service> (default 50) and asserts
# that at least one line matches <pattern>. Used to verify that watchdogs have
# actually ticked.
assert_log_contains() {
  local name="$1"
  local description="$2"
  local service="$3"
  local pattern="$4"
  local tail_lines="${5:-50}"

  local out
  if ! out="$(dc_logs "$service" --tail="$tail_lines" 2>&1)"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_fail "$name: $description (could not read logs)"
    printf '%s\n' "$out" | sed 's/^/      /'
    return 0
  fi

  if printf '%s' "$out" | grep -qE -- "$pattern"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    log_pass "$name: $description"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_fail "$name: $description (no log line matched /$pattern/)"
    log_info "Last $tail_lines log lines for '$service':"
    printf '%s\n' "$out" | sed 's/^/      /'
  fi
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

# preflight_stack_up
#
# Confirms the docker compose project has at least one running container.
# Returns 2 (a special exit code) if nothing is running, so the caller can
# distinguish "stack down" from "stack up but checks failed" (exit 1).
preflight_stack_up() {
  local ps_json
  if ! ps_json="$(dc ps --format json 2>&1)"; then
    echo "$(_smoke_red '[FAIL]') docker compose is not reachable. Is the Docker daemon running?" 1>&2
    echo "$ps_json" | sed 's/^/      /' 1>&2
    exit 2
  fi

  # `docker compose ps --format json` emits one JSON object per service. We
  # only need to know whether ANY object has State=running.
  local running
  running="$(printf '%s' "$ps_json" | grep -c '"State":"running"' || true)"

  if [ "${running:-0}" -eq 0 ]; then
    cat 1>&2 <<EOF
$(_smoke_red '[FAIL]') No service is currently running.

Start the stack first:
    pnpm test:stack:up

or, on the droplet:
    bash deploy/deploy.sh up
EOF
    exit 2
  fi

  log_info "Preflight OK — $running service(s) reported State=running"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

# summary_and_exit
#
# Prints the aggregate result and returns the appropriate exit code:
#   * 0 if every check passed
#   * 1 if at least one check failed
#
# Preflight failures already exited with 2 before we got here.
summary_and_exit() {
  local total=$((PASS_COUNT + FAIL_COUNT))
  echo ""
  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "$(_smoke_green "${PASS_COUNT}/${total} checks passed")"
    exit 0
  fi
  local passed_msg="$(_smoke_green "${PASS_COUNT}")"
  echo "$(_smoke_red "${FAIL_COUNT}/${total} checks failed") (${passed_msg} passed)"
  exit 1
}
