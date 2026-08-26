#!/usr/bin/env bash
# scripts/lib/checks.sh
# -----------------------------------------------------------------------------
# Pre-flight checks for installer / setup scripts.
#
# Source with:
#     source "$(dirname "${BASH_SOURCE[0]}")/lib/checks.sh"
#
# Public API:
#     require_root                - exits 2 if not root
#     require_command "docker"    - exits 3 if command missing
#     require_arch arm64|amd64   - exits 4 if current arch not in list
#     require_os  bookworm|jammy - exits 5 if current OS not in list
#     require_disk_free "/path" 1G - exits 6 if less than the requested size free
#     exit codes:
#       2 = not root
#       3 = missing command
#       4 = unsupported architecture
#       5 = unsupported OS
#       6 = insufficient disk space
# -----------------------------------------------------------------------------

if [ -n "${__CHECKS_SH_SOURCED:-}" ]; then
  return 0
fi
__CHECKS_SH_SOURCED=1

# Ensure colours / logging helpers are available. They are no-ops if already
# sourced.
SCRIPT_DIR_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=colors.sh
source "${SCRIPT_DIR_LIB}/colors.sh"
# shellcheck source=logging.sh
source "${SCRIPT_DIR_LIB}/logging.sh"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "This step requires root privileges (run with sudo)."
    exit 2
  fi
  ok "Running as root"
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    err "Required command not found: ${cmd}"
    exit 3
  fi
  ok "Found required command: ${cmd}"
}

require_arch() {
  local allowed=""
  for a in "$@"; do allowed="${allowed}|${a}"; done
  allowed="${allowed#|}"
  local current
  current="$(uname -m)"
  case "${current}" in
    x86_64) current="amd64" ;;
    aarch64) current="arm64" ;;
  esac
  if ! printf '%s' "${current}" | grep -Eq "^(${allowed})$"; then
    err "Unsupported architecture: ${current} (allowed: $*)."
    exit 4
  fi
  ok "Architecture OK: ${current}"
}

require_os() {
  local allowed=""
  for o in "$@"; do allowed="${allowed}|${o}"; done
  allowed="${allowed#|}"
  local current=""
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    current="${ID:-unknown}-${VERSION_CODENAME:-unknown}"
  else
    current="$(uname -s)"
  fi
  case "${current%%-*}" in
    debian) current="${current#debian-}"; current="bookworm" ;; # best-effort
    ubuntu) current="${VERSION_CODENAME:-unknown}" ;;
    raspbian) current="bookworm" ;;
  esac
  if ! printf '%s' "${current}" | grep -Eq "^(${allowed})$"; then
    err "Unsupported OS codename: ${current} (allowed: $*)."
    exit 5
  fi
  ok "OS OK: ${current}"
}

# require_disk_free <path> <size>
# size accepts K, M, G suffixes (case-insensitive). Uses df -k for portability.
require_disk_free() {
  local path="$1"
  local required="$2"
  local required_kb=0
  case "${required}" in
    *[kK]) required_kb=$(( ${required%[kK]} )) ;;
    *[mM]) required_kb=$(( ${required%[mM]} * 1024 )) ;;
    *[gG]) required_kb=$(( ${required%[gG]} * 1024 * 1024 )) ;;
    *)     required_kb=$(( ${required} * 1024 )) ;;
  esac
  local available_kb
  available_kb="$(df -Pk "${path}" 2>/dev/null | awk 'NR==2 {print $4}')"
  if [ -z "${available_kb}" ]; then
    warn "Could not determine free disk space at ${path}; skipping check."
    return 0
  fi
  if [ "${available_kb}" -lt "${required_kb}" ]; then
    err "Insufficient free disk space at ${path}: need ${required}, have $((available_kb/1024))M."
    exit 6
  fi
  ok "Disk space OK at ${path} (have $((available_kb/1024))M, need ${required})"
}
