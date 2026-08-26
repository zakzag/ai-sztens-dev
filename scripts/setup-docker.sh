#!/usr/bin/env bash
# scripts/setup-docker.sh
# -----------------------------------------------------------------------------
# Installs Docker Engine + Docker Compose plugin from Docker's official
# repository, on Debian/Ubuntu-based systems. Suitable for Raspberry Pi OS
# Bookworm (arm64) and Ubuntu 22.04/24.04 (amd64/arm64).
#
# Steps:
#   1. OS / arch check
#   2. Add docker.gpg key + apt repo
#   3. apt install docker-ce docker-ce-cli containerd.io \
#                  docker-buildx-plugin docker-compose-plugin
#   4. Optionally add invoking sudoer into the 'docker' group
#   5. Verify with 'docker --version', 'docker compose version',
#      and 'docker run --rm hello-world'
#
# Flags:
#   -y, --yes     Non-interactive
#       --dry-run Print actions without applying them
#       --help    Show this help and exit
#
# Exit codes:
#   0 success
#   1 generic
#   2 not root
#   3 docker apt install failed
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/colors.sh
source "${SCRIPT_DIR}/lib/colors.sh"
# shellcheck source=lib/logging.sh
source "${SCRIPT_DIR}/lib/logging.sh"
# shellcheck source=lib/checks.sh
source "${SCRIPT_DIR}/lib/checks.sh"

ASSUME_YES=0
DRY_RUN=0
SUDO_USER_TO_ADD="${SUDO_USER:-}"

usage() {
  cat <<'EOF'
Usage: setup-docker.sh [options]

  -y, --yes     Assume 'yes' for all questions (non-interactive)
      --dry-run Print actions without applying them
      --help    Show this help

Environment:
  SUDO_USER    Username to add to the 'docker' group (auto-detected when run via sudo)
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) err "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

confirm() {
  local prompt="$1"
  if [ "${ASSUME_YES}" = "1" ]; then return 0; fi
  if [ ! -t 0 ]; then return 1; fi
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "${reply}" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

run() {
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
require_command apt-get

ok "Pre-flight passed; installing Docker."

# ---------- 1. Pre-reqs ----------
info "Installing pre-requisite packages..."
run env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg

# ---------- 2. Repo ----------
install_dir="/etc/apt/keyrings"
if [ ! -d "${install_dir}" ]; then
  run install -m 0755 -d "${install_dir}"
fi

if [ ! -f "${install_dir}/docker.asc" ]; then
  info "Downloading Docker GPG key..."
  run curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "${ID}")/gpg \
    -o "${install_dir}/docker.asc"
  run chmod a+r "${install_dir}/docker.asc"
else
  ok "Docker GPG key already present."
fi

# Determine the right 'bookworm' or 'noble' suffix.
. /etc/os-release
case "${ID}" in
  debian|raspbian) REPO_CODENAME="${VERSION_CODENAME:-bookworm}" ;;
  ubuntu) REPO_CODENAME="${VERSION_CODENAME:-noble}" ;;
  *) err "Unsupported distribution: ${ID}"; exit 1 ;;
esac

DOCKER_LIST="/etc/apt/sources.list.d/docker.list"
DESIRED_LINE="deb [arch=$(dpkg --print-architecture) signed-by=${install_dir}/docker.asc] https://download.docker.com/linux/${ID} ${REPO_CODENAME} stable"

if [ -f "${DOCKER_LIST}" ] && grep -Fxq "${DESIRED_LINE}" "${DOCKER_LIST}"; then
  ok "Docker apt repository already configured."
else
  info "Writing Docker apt repository entry..."
  if [ "${DRY_RUN}" = "1" ]; then
    info "DRY-RUN: echo '${DESIRED_LINE}' > ${DOCKER_LIST}"
  else
    echo "${DESIRED_LINE}" > "${DOCKER_LIST}"
  fi
fi

info "Running apt-get update (with new repo)..."
run apt-get update

# ---------- 3. Install Docker packages ----------
info "Installing docker-ce, docker-ce-cli, containerd.io, buildx, compose plugin..."
if ! run env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
  err "Docker apt install failed."
  exit 3
fi

# ---------- 4. Docker group & current user ----------
if getent group docker >/dev/null 2>&1; then
  ok "Group 'docker' exists."
else
  run groupadd docker
fi

if [ -n "${SUDO_USER_TO_ADD}" ] && [ "${SUDO_USER_TO_ADD}" != "root" ]; then
  if id "${SUDO_USER_TO_ADD}" >/dev/null 2>&1; then
    info "Adding user '${SUDO_USER_TO_ADD}' to the 'docker' group..."
    run usermod -aG docker "${SUDO_USER_TO_ADD}"
    warn "User '${SUDO_USER_TO_ADD}' must log out / log back in for group change to take effect."
  fi
fi

# ---------- 5. Verify ----------
info "Verifying Docker installation..."
run docker --version
run docker compose version

if confirm "Run 'docker run --rm hello-world' to verify the runtime"; then
  if ! run docker run --rm hello-world; then
    warn "hello-world failed; the install succeeded but the runtime may be limited."
  fi
fi

ok "Docker installation complete."
info "Next step: bash ${SCRIPT_DIR}/generate-env.sh  (or copy .env.example to .env manually)"
info "Then: docker compose up -d livekit"
