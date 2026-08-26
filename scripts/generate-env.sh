#!/usr/bin/env bash
# scripts/generate-env.sh
# -----------------------------------------------------------------------------
# Interactive .env generator for the AI-assistant stack.
#
# For M1 (LiveKit only) it asks for the minimum set of keys:
#   - PROJECT_NAME, ENVIRONMENT, TZ
#   - LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
#
# If no input is given, the values from .env.example are kept and the user
# is warned about the DEV-only keys.
#
# Validation rules:
#   - LIVEKIT_API_KEY     >= 8 chars, [A-Za-z0-9_]
#   - LIVEKIT_API_SECRET  >= 16 chars
#   - LIVEKIT_URL         starts with ws:// or wss://
#
# Flags:
#   -y, --yes     Accept all defaults from .env.example (no questions)
#       --force   Overwrite an existing .env without asking
#       --help    Show this help
#
# Exit codes:
#   0 success
#   1 generic
#   2 invalid input
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/colors.sh
source "${SCRIPT_DIR}/lib/colors.sh"
# shellcheck source=lib/logging.sh
source "${SCRIPT_DIR}/lib/logging.sh"

ASSUME_YES=0
FORCE=0

usage() {
  cat <<'EOF'
Usage: generate-env.sh [options]

  -y, --yes    Use .env.example values without asking
      --force  Overwrite an existing .env without confirmation
      --help   Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    --force) FORCE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

ENV_FILE="${PROJECT_ROOT}/.env"
EXAMPLE_FILE="${PROJECT_ROOT}/.env.example"

if [ ! -f "${EXAMPLE_FILE}" ]; then
  err ".env.example not found at ${EXAMPLE_FILE}"
  exit 1
fi

# ---------- Helpers ----------
# Ask a question; if user enters empty, use default.
ask() {
  # ask "<prompt>" "<default>" -> echoes chosen value
  local prompt="$1"
  local default="$2"
  local reply
  if [ "${ASSUME_YES}" = "1" ]; then
    printf '%s' "${default}"
    return
  fi
  if [ ! -t 0 ]; then
    warn "No TTY on stdin, using default for: ${prompt}"
    printf '%s' "${default}"
    return
  fi
  read -r -p "${prompt} [${default}]: " reply
  if [ -z "${reply}" ]; then
    printf '%s' "${default}"
  else
    printf '%s' "${reply}"
  fi
}

# Confirm yes/no.
confirm() {
  local prompt="$1"
  if [ "${ASSUME_YES}" = "1" ]; then return 0; fi
  if [ ! -t 0 ]; then return 1; fi
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "${reply}" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# Validate LIVEKIT_API_KEY
validate_key() {
  local v="$1"
  if [ "${#v}" -lt 8 ]; then
    err "LIVEKIT_API_KEY must be at least 8 characters long."
    return 1
  fi
  if ! printf '%s' "${v}" | grep -qE '^[A-Za-z0-9_]+$'; then
    err "LIVEKIT_API_KEY may only contain [A-Za-z0-9_] characters."
    return 1
  fi
}

# Validate LIVEKIT_API_SECRET
validate_secret() {
  local v="$1"
  if [ "${#v}" -lt 16 ]; then
    err "LIVEKIT_API_SECRET must be at least 16 characters long."
    return 1
  fi
}

# Validate LIVEKIT_URL
validate_url() {
  local v="$1"
  case "${v}" in
    ws://*|wss://*) return 0 ;;
    *) err "LIVEKIT_URL must start with ws:// or wss://"; return 1 ;;
  esac
}

# ---------- Read defaults from .env.example ----------
parse_default() {
  local key="$1"
  grep -E "^${key}=" "${EXAMPLE_FILE}" | head -n1 | cut -d= -f2-
}

DEFAULT_PROJECT_NAME="$(parse_default PROJECT_NAME)"
DEFAULT_ENVIRONMENT="$(parse_default ENVIRONMENT)"
DEFAULT_TZ="$(parse_default TZ)"
DEFAULT_API_KEY="$(parse_default LIVEKIT_API_KEY)"
DEFAULT_API_SECRET="$(parse_default LIVEKIT_API_SECRET)"
DEFAULT_URL="$(parse_default LIVEKIT_URL)"

# ---------- Existing .env handling ----------
if [ -f "${ENV_FILE}" ]; then
  if [ "${FORCE}" = "0" ] && ! confirm ".env already exists. Overwrite?"; then
    info "Aborted. Existing .env was kept."
    exit 0
  fi
fi

info "Generating .env from .env.example (DEV-ONLY keys)"
info "Press ENTER to accept the default value for each prompt."
info "---"

PROJECT_NAME="$(ask 'PROJECT_NAME' "${DEFAULT_PROJECT_NAME}")"
ENVIRONMENT="$(ask 'ENVIRONMENT' "${DEFAULT_ENVIRONMENT}")"
TZ_VAL="$(ask 'TZ' "${DEFAULT_TZ}")"
LIVEKIT_URL_VAL="$(ask 'LIVEKIT_URL' "${DEFAULT_URL}")"

# LiveKit keys: warn about dev-only then loop until valid
while true; do
  LIVEKIT_API_KEY_VAL="$(ask 'LIVEKIT_API_KEY (>=8 chars, [A-Za-z0-9_])' "${DEFAULT_API_KEY}")"
  if validate_key "${LIVEKIT_API_KEY_VAL}"; then break; fi
  warn "Please try again."
done

while true; do
  LIVEKIT_API_SECRET_VAL="$(ask 'LIVEKIT_API_SECRET (>=16 chars)' "${DEFAULT_API_SECRET}")"
  if validate_secret "${LIVEKIT_API_SECRET_VAL}"; then break; fi
  warn "Please try again."
done

while true; do
  LIVEKIT_URL_VAL="$(ask 'LIVEKIT_URL (ws:// or wss://)' "${DEFAULT_URL}")"
  if validate_url "${LIVEKIT_URL_VAL}"; then break; fi
  warn "Please try again."
done

# ---------- Remind the user about DEV keys ----------
if [ "${LIVEKIT_API_KEY_VAL}" = "${DEFAULT_API_KEY}" ] || \
   [ "${LIVEKIT_API_SECRET_VAL}" = "${DEFAULT_API_SECRET}" ]; then
  warn "You are using DEV-ONLY LiveKit keys from .env.example."
  warn "Replace them before exposing the server to any non-local network."
fi

# ---------- Write .env ----------
TMP_ENV="$(mktemp)"
trap 'rm -f "${TMP_ENV}"' EXIT

cat > "${TMP_ENV}" <<EOF
# =============================================================================
# .env  -  AI Hangasszisztens Rendszer
# -----------------------------------------------------------------------------
# Generated by scripts/generate-env.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ").
# This file is gitignored - never commit the real .env!
# =============================================================================

PROJECT_NAME=${PROJECT_NAME}
ENVIRONMENT=${ENVIRONMENT}
TZ=${TZ_VAL}
LOG_LEVEL=INFO

LIVEKIT_API_KEY=${LIVEKIT_API_KEY_VAL}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET_VAL}
LIVEKIT_URL=${LIVEKIT_URL_VAL}
LIVEKIT_HOST=livekit
EOF

# Preserve safe permissions: 600 if umask allows, then explicitly chmod.
umask 077
mv "${TMP_ENV}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
trap - EXIT

ok ".env written to ${ENV_FILE} (mode 600)."
info "Next step: docker compose --env-file .env config  # to validate"
info "Then:     docker compose up -d livekit"
