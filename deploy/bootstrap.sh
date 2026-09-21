#!/usr/bin/env bash
# Callback Assistant — one-time droplet bootstrap.
#
# Run as root on a fresh Ubuntu droplet (nothing installed yet). Idempotent:
# it is safe to re-run. It:
#   1. installs Docker Engine + the Compose plugin
#   2. creates the SSH users and installs their authorized_keys
#   3. optionally configures UFW
#
# Expected layout on the host (uploaded by deploy/deploy.sh):
#   /opt/callback/deploy/ssh-keys/<username>.pub
#
# Usage: sudo bash deploy/bootstrap.sh

set -euo pipefail

SUDO_USERS="${SUDO_USERS:-tkovari,krak,deployer}"
APP_USER="${APP_USER:-aisztens}"
KEYS_DIR="${KEYS_DIR:-/opt/callback/deploy/ssh-keys}"
UFW_ENABLE="${UFW_ENABLE:-0}"
TZ="${TZ:-Europe/Budapest}"

log() { echo "[bootstrap] $*"; }

# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed: $(docker --version)"
    return 0
  fi

  log "Installing Docker Engine + Compose plugin ..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  log "Docker installed."
}

# ---------------------------------------------------------------------------
create_user() {
  local user="$1"
  local sudo_flag="$2"

  if ! id "$user" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$user"
    log "Created user: $user"
  fi

  # The app user may operate containers; sudo users additionally administer the host.
  usermod -aG docker "$user"
  if [ "$sudo_flag" = "1" ]; then
    usermod -aG sudo "$user"
  fi

  local keyfile="$KEYS_DIR/$user.pub"
  if [ -f "$keyfile" ]; then
    install -d -o "$user" -g "$user" -m 700 "/home/$user/.ssh"
    install -o "$user" -g "$user" -m 600 "$keyfile" "/home/$user/.ssh/authorized_keys"
    log "Installed SSH key for $user"
  else
    log "WARNING: no public key at $keyfile — $user has no SSH access yet"
  fi
}

# ---------------------------------------------------------------------------
configure_ufw() {
  if [ "$UFW_ENABLE" != "1" ]; then
    log "UFW skipped (set UFW_ENABLE=1 to enable). DigitalOcean's cloud firewall is recommended instead."
    return 0
  fi

  command -v ufw >/dev/null 2>&1 || apt-get install -y ufw
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  log "UFW enabled: OpenSSH, 80/tcp, 443/tcp."
}

# ---------------------------------------------------------------------------
set_timezone() {
  if command -v timedatectl >/dev/null 2>&1; then
    timedatectl set-timezone "$TZ" || true
    log "Timezone set to $TZ"
  fi
}

# ---------------------------------------------------------------------------
main() {
  [ "$(id -u)" -eq 0 ] || { log "ERROR: run as root"; exit 1; }

  set_timezone
  install_docker

  local user
  for user in ${SUDO_USERS//,/ }; do
    create_user "$user" 1
  done
  create_user "$APP_USER" 0

  configure_ufw

  log "Bootstrap complete. Next: run deploy/deploy.sh up"
}

main "$@"
