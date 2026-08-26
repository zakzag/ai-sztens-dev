#!/usr/bin/env bash
# scripts/install-prerequisites.sh
# -----------------------------------------------------------------------------
# Single entry point that prepares a fresh Raspberry Pi (or any
# Debian/Ubuntu-based Linux server) with everything required to run the
# AI-assistant stack.
#
# It orchestrates:
#   - scripts/setup-system.sh    (timezone, locales, swap, cgroup, UFW)
#   - scripts/setup-docker.sh    (Docker Engine + Compose plugin)
#
# After this script succeeds you can:
#   bash scripts/generate-env.sh
#   docker compose up -d livekit
#   bash scripts/smoke-test-livekit.sh
#
# All flags are forwarded to the underlying scripts. See their --help.
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/colors.sh
source "${SCRIPT_DIR}/lib/colors.sh"
# shellcheck source=lib/logging.sh
source "${SCRIPT_DIR}/lib/logging.sh"

usage() {
  cat <<'EOF'
Usage: install-prerequisites.sh [options]

Pass-through flags for the underlying scripts:
  -y, --yes            Non-interactive (forwarded to setup-system.sh & setup-docker.sh)
      --skip-os-update Skip OS update/upgrade
      --dry-run        Print actions without applying them
      --help           Show this help
EOF
}

PASS_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    *) PASS_ARGS+=("$1"); shift ;;
  esac
done

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "Please run with sudo: sudo bash $0 $*"
    exit 2
  fi
}
require_root

info "===== AI Assistant prerequisite installer ====="
info "Step 1/2: System preparation"
bash "${SCRIPT_DIR}/setup-system.sh" "${PASS_ARGS[@]}"

info "Step 2/2: Docker installation"
bash "${SCRIPT_DIR}/setup-docker.sh" "${PASS_ARGS[@]}"

ok "All prerequisites installed."
info "Next steps:"
info "  1. Re-login if your user was added to the 'docker' group"
info "  2. cp .env.example .env   # and edit if you want non-default keys"
info "  3. docker compose up -d livekit"
info "  4. bash scripts/smoke-test-livekit.sh"
