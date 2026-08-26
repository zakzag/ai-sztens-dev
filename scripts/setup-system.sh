#!/usr/bin/env bash
# scripts/setup-system.sh
# -----------------------------------------------------------------------------
# Prepares a Raspberry Pi (or any Debian/Ubuntu-based Linux) for the
# AI-assistant stack. Only the M1-relevant steps are performed:
#
#   1. OS / arch check
#   2. apt update + upgrade
#   3. timezone set to Europe/Budapest (overridable via TZ env)
#   4. en_US.UTF-8 / hu_HU.UTF-8 locales generated
#   5. swap size increased to 2 GB if current < 2 GB
#   6. cgroup memory flags ensured in /boot/cmdline.txt (Pi only)
#   7. optional UFW rule scaffold (asked interactively unless -y)
#
# Flags:
#   -y, --yes              Non-interactive; assume 'yes' to all questions
#       --skip-os-update   Do not run apt update/upgrade
#       --dry-run           Print what would happen, do not change the system
#       --help              Show this help and exit
#
# Exit codes:
#   0 success
#   1 generic error
#   2 not root
#   5 unsupported OS
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/colors.sh
source "${SCRIPT_DIR}/lib/colors.sh"
# shellcheck source=lib/logging.sh
source "${SCRIPT_DIR}/lib/logging.sh"
# shellcheck source=lib/checks.sh
source "${SCRIPT_DIR}/lib/checks.sh"

# ---------- Defaults & flags ----------
ASSUME_YES=0
SKIP_OS_UPDATE=0
DRY_RUN=0
TARGET_TZ="${TZ:-Europe/Budapest}"
DESIRED_SWAP_MB=2048

usage() {
  cat <<'EOF'
Usage: setup-system.sh [options]

  -y, --yes            Non-interactive
      --skip-os-update Skip 'apt update && apt upgrade'
      --dry-run        Print actions without applying them
      --help           Show this help

Environment:
  TZ                  Timezone to set (default Europe/Budapest)
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    --skip-os-update) SKIP_OS_UPDATE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

confirm() {
  # confirm "<question>" -> returns 0 if user agrees, 1 otherwise
  local prompt="$1"
  if [ "${ASSUME_YES}" = "1" ]; then
    info "${prompt} [auto-yes]"
    return 0
  fi
  if [ ! -t 0 ]; then
    warn "${prompt} [no TTY, assuming no]"
    return 1
  fi
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "${reply}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

run() {
  # run "<command...>"  -> runs the command unless --dry-run
  if [ "${DRY_RUN}" = "1" ]; then
    info "DRY-RUN: $*"
  else
    info "Running: $*"
    "$@"
  fi
}

# ---------- Pre-flight ----------
require_root
require_arch arm64 amd64
require_os bookworm jammy noble

require_disk_free / 5G

ok "System pre-flight passed."

# ---------- 1. apt update + upgrade ----------
if [ "${SKIP_OS_UPDATE}" = "0" ]; then
  info "Updating package lists..."
  run apt-get update
  info "Upgrading installed packages (this can take a while)..."
  run env DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
else
  info "Skipping apt update/upgrade (--skip-os-update)."
fi

# ---------- 2. Required base packages ----------
info "Installing base packages required for Docker and this script set..."
run env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg lsb-release jq rsync

# ---------- 3. Timezone ----------
if command -v timedatectl >/dev/null 2>&1; then
  info "Setting timezone to ${TARGET_TZ}..."
  run timedatectl set-timezone "${TARGET_TZ}"
else
  warn "timedatectl not available; set TZ manually if needed."
fi

# ---------- 4. Locales ----------
info "Ensuring en_US.UTF-8 and hu_HU.UTF-8 locales are generated..."
run sed -i -E 's/^#?\s*(en_US\.UTF-8|hu_HU\.UTF-8)\s*/\1 /' /etc/locale.gen
run locale-gen
if command -v update-locale >/dev/null 2>&1; then
  run update-locale LANG=en_US.UTF-8
fi

# ---------- 5. Swap ----------
if command -v dphys-swapfile >/dev/null 2>&1 && [ -f /etc/dphys-swapfile ]; then
  current_swapsize="$(grep -E '^[[:space:]]*CONF_SWAPSIZE=' /etc/dphys-swapfile | tail -n1 | cut -d= -f2 || echo 0)"
  current_swapsize="${current_swapsize:-0}"
  if [ "${current_swapsize}" -lt "${DESIRED_SWAP_MB}" ]; then
    info "Increasing swap from ${current_swapsize}MB to ${DESIRED_SWAP_MB}MB..."
    run sed -i -E "s/^(CONF_SWAPSIZE=).*/\\1${DESIRED_SWAP_MB}/" /etc/dphys-swapfile
    run dphys-swapfile setup
    run dphys-swapfile swapon
  else
    ok "Swap already >= ${DESIRED_SWAP_MB}MB (currently ${current_swapsize}MB)."
  fi
else
  warn "dphys-swapfile not present (not Raspberry Pi OS?). Skipping swap tuning."
fi

# ---------- 6. cgroup flags for memory accounting ----------
if [ -f /boot/cmdline.txt ]; then
  if ! grep -q "cgroup_memory=1" /boot/cmdline.txt; then
    if confirm "Add cgroup memory flags to /boot/cmdline.txt (requires reboot)"; then
      run bash -c "sed -i '1s/^\(.*\)$/\1 cgroup_memory=1 cgroup_enable=memory/' /boot/cmdline.txt"
      warn "Reboot required for cgroup changes to take effect."
    fi
  else
    ok "cgroup memory flags already present in /boot/cmdline.txt"
  fi
fi

# ---------- 7. Optional UFW scaffold ----------
if command -v ufw >/dev/null 2>&1; then
  if confirm "Enable UFW and open SSH (22) port? (HTTPS/7880-7892 will be opened later by setup-docker.sh)"; then
    run ufw allow OpenSSH
    run ufw --force enable
    ok "UFW enabled with OpenSSH allowed."
  fi
else
  info "ufw not installed; skipping firewall scaffold."
fi

ok "System preparation complete."
info "Next step: bash ${SCRIPT_DIR}/setup-docker.sh"
