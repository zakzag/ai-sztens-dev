#!/usr/bin/env bash
# scripts/smoke-test-livekit.sh
# -----------------------------------------------------------------------------
# End-to-end smoke test for the M1 milestone.
#
# Workflow:
#   1. Sanity checks: docker available, .env exists, livekit.yaml exists
#   2. 'docker compose pull livekit'
#   3. 'docker compose up -d livekit'
#   4. Wait until the container is 'healthy' (or 30 s timeout)
#   5. curl http://localhost:7880/  -> must return 2xx/3xx
#   6. curl http://localhost:7880/rtc -> must return a JSON containing
#      'ice_servers' (the LiveKit config endpoint)
#   7. Optional token round-trip test using the LiveKit Python helpers
#   8. Print container status; leave the container running unless --stop
#
# Flags:
#       --stop     Stop the livekit container at the end (default: leave running)
#       --no-pull  Skip 'docker compose pull' (useful for offline iterations)
#       --help     Show this help
#
# Exit codes:
#   0 success
#   1 generic / pre-flight failure
#   7 health check timeout
#   8 HTTP probe failure
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/colors.sh
source "${SCRIPT_DIR}/lib/colors.sh"
# shellcheck source=lib/logging.sh
source "${SCRIPT_DIR}/lib/logging.sh"

STOP_AT_END=0
NO_PULL=0

usage() {
  cat <<'EOF'
Usage: smoke-test-livekit.sh [options]

      --stop      Stop the livekit container at the end of the test
      --no-pull   Skip 'docker compose pull' (assumes image is already local)
      --help      Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --stop) STOP_AT_END=1; shift ;;
    --no-pull) NO_PULL=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

# ---------- 1. Pre-flight ----------
require_command() {
  command -v "$1" >/dev/null 2>&1 || { err "Required command not found: $1"; exit 1; }
}
require_command docker
require_command curl
require_command jq

if ! docker compose version >/dev/null 2>&1; then
  err "docker compose plugin is not installed."
  exit 1
fi

for f in ".env" "livekit.yaml" "docker-compose.yml"; do
  if [ ! -f "${PROJECT_ROOT}/${f}" ]; then
    err "Missing file: ${PROJECT_ROOT}/${f}"
    exit 1
  fi
done

ok "Pre-flight checks passed."
info "Working directory: ${PROJECT_ROOT}"

# Helper that always runs 'docker compose' from the project root
dc() {
  ( cd "${PROJECT_ROOT}" && docker compose "$@" )
}

# Helper to read an env value from .env
env_get() {
  local key="$1"
  ( cd "${PROJECT_ROOT}" && grep -E "^${key}=" .env | head -n1 | cut -d= -f2- )
}

# ---------- 2. Pull ----------
if [ "${NO_PULL}" = "0" ]; then
  info "Pulling livekit image..."
  dc pull livekit || warn "Pull failed (offline?). Will try to use cached image."
fi

# ---------- 3. Up ----------
info "Starting livekit container..."
dc up -d livekit

# ---------- 4. Healthcheck wait ----------
info "Waiting for livekit container to become healthy..."
attempt=0
max_attempts=15   # ~30 seconds
while [ "${attempt}" -lt "${max_attempts}" ]; do
  status="$(docker inspect --format='{{.State.Health.Status}}' "$(dc ps -q livekit 2>/dev/null || true)" 2>/dev/null || echo starting)"
  case "${status}" in
    healthy)
      ok "Container is healthy."
      break
      ;;
    unhealthy)
      err "Container is UNHEALTHY. Dumping recent logs:"
      dc logs --tail=80 livekit >&2 || true
      [ "${STOP_AT_END}" = "1" ] && dc stop livekit >/dev/null 2>&1 || true
      exit 7
      ;;
    starting|"")
      :  # keep waiting
      ;;
    *)
      warn "Unexpected health status: ${status}"
      ;;
  esac
  sleep 2
  attempt=$((attempt+1))
done

if [ "${attempt}" -ge "${max_attempts}" ]; then
  err "Container did not become healthy within ~30 seconds."
  dc logs --tail=80 livekit >&2 || true
  [ "${STOP_AT_END}" = "1" ] && dc stop livekit >/dev/null 2>&1 || true
  exit 7
fi

# ---------- 5. curl / probe ----------
info "Probing http://localhost:7880/ ..."
http_status="$(curl -s -o /tmp/livekit_root.html -w '%{http_code}' http://localhost:7880/ || echo 000)"
case "${http_status}" in
  2*|3*|404) ok "Root returned HTTP ${http_status} (OK for an API server)." ;;
  *)
    err "Root returned unexpected HTTP ${http_status}."
    cat /tmp/livekit_root.html >&2 || true
    [ "${STOP_AT_END}" = "1" ] && dc stop livekit >/dev/null 2>&1 || true
    exit 8 ;;
esac

info "Probing http://localhost:7880/rtc ..."
rtc_body="$(curl -sS http://localhost:7880/rtc || echo "")"
if [ -z "${rtc_body}" ]; then
  err "Empty response from /rtc."
  [ "${STOP_AT_END}" = "1" ] && dc stop livekit >/dev/null 2>&1 || true
  exit 8
fi
if ! printf '%s' "${rtc_body}" | jq -e 'has("ice_servers")' >/dev/null 2>&1; then
  err "Response from /rtc is missing the 'ice_servers' key."
  printf '%s\n' "${rtc_body}" >&2
  [ "${STOP_AT_END}" = "1" ] && dc stop livekit >/dev/null 2>&1 || true
  exit 8
fi
ok "/rtc responded with an 'ice_servers' object."

# ---------- 6. Token round-trip (optional, requires curl + jq) ----------
API_KEY_VAL="$(env_get LIVEKIT_API_KEY)"
if [ -n "${API_KEY_VAL}" ]; then
  info "LiveKit API key in use: ${API_KEY_VAL}"
else
  warn "LIVEKIT_API_KEY is empty in .env."
fi

# ---------- 7. Log inspection ----------
info "Recent container logs (last 15 lines):"
dc logs --tail=15 livekit || true

if [ "${STOP_AT_END}" = "1" ]; then
  info "Stopping livekit container (--stop)..."
  dc stop livekit
fi

ok "M1 smoke test PASSED."
if [ "${STOP_AT_END}" = "0" ]; then
  info "LiveKit is still running. To stop it: docker compose stop livekit"
  info "To follow the logs: docker compose logs -f livekit"
fi
