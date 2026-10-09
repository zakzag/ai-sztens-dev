#!/usr/bin/env bash
# AIsztens — one-time droplet bootstrap.
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
KEYS_DIR="${KEYS_DIR:-/opt/aisztens/deploy/ssh-keys}"
# Same /opt/aisztens parent KEYS_DIR lives under, so it must agree. Used by
# the post-loop chown/chmod block below to repair the two preconditions that
# the `deployer` deploy path silently relied on before:
#   (a) the tree must be OWNED by the login user so `rsync -a`'s `-t`/`-p`
#       can set directory times (`failed to set times` is what the
#       22:25 run died on; the deferred operator TODO was at
#       docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md
#       §6);
#   (b) the two env files must be `0600` — scp inherits the source mode,
#       and a drvfs source uploads `0666` if we let it.
REMOTE_DIR="${REMOTE_DIR:-/opt/aisztens}"
UFW_ENABLE="${UFW_ENABLE:-0}"
TZ="${TZ:-Europe/Budapest}"
# Account that owns the deploy tree after bootstrap. Default: deployer (the
# least-privilege identity used by every command except `bootstrap` itself —
# see deploy/deploy.sh). The chown below makes `deployer` capable of writing
# into REMOTE_DIR, which is what `rsync -a` needs for `-t`/`-p` (CAP_FOWNER).
# Root deploys keep working too, because root can write any tree.
DEPLOY_USER="${DEPLOY_USER:-deployer}"
# Size of the swap file provisioned by configure_swap(). Set to 0 to skip.
# Default 2 GB is enough to absorb a DigitalOcean do-agent memory leak spike
# on a 1-2 GB droplet without forcing the kernel into swap-thrash.
SWAP_SIZE_MB="${SWAP_SIZE_MB:-2048}"

log() { echo "[bootstrap] $*"; }

# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed: $(docker --version)"
    return 0
  fi

  log "Installing Docker Engine + Compose plugin ..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg net-tools lsb-release

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
    return 0
  fi
  # Sudo users MUST have an SSH key — without it the deployer/owner login
  # path is unreachable, the assertion in deploy/deploy.sh:assert_remote_ready
  # will fail, and the operator is silently funnelled into root deploys
  # (which is exactly the regression documented in
  # docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md
  # §6 "Operator, once"). Hard-fail so the bootstrap cannot exit 0 in a
  # state where day-to-day deploys (run as $DEPLOY_USER) cannot log in.
  if [ "$sudo_flag" = "1" ]; then
    log "ERROR: no public key at $keyfile — sudo user '$user' needs SSH access"
    return 1
  fi
  # App user (no sudo) is allowed to exist without SSH — log it and move on.
  log "WARNING: no public key at $keyfile — $user has no SSH access yet"
}

# ---------------------------------------------------------------------------
# Idempotent swap file. Creates /swapfile of SWAP_SIZE_MB if missing. Safe to
# re-run: existing swap entries are detected and the script no-ops.
configure_swap() {
  if [ "$SWAP_SIZE_MB" = "0" ]; then
    log "Swap skipped (SWAP_SIZE_MB=0)."
    return 0
  fi

  # If /swapfile is already in fstab and active, nothing to do.
  if grep -E '^/swapfile\b' /etc/fstab >/dev/null 2>&1; then
    if swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
      log "Swap already active at /swapfile."
      return 0
    fi
    log "Re-enabling existing /swapfile from /etc/fstab ..."
    swapon /swapfile || log "WARN: swapon /swapfile failed"
    return 0
  fi

  # A leftover /swapfile with no fstab entry is suspicious — do not silently
  # overwrite it (it might contain unrelated data on a non-fresh host).
  if [ -f /swapfile ]; then
    log "WARNING: /swapfile exists but is not in /etc/fstab — leaving untouched."
    return 0
  fi

  log "Creating ${SWAP_SIZE_MB} MB swap file at /swapfile ..."
  fallocate -l "${SWAP_SIZE_MB}M" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_SIZE_MB" status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  # Persist across reboots. Use `none swap sw` so mount picks it up by name.
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Reduce swappiness so the kernel prefers dropping in-memory caches over
  # pushing application pages to disk on a 2 GB droplet.
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q '^vm.swappiness' /etc/sysctl.conf 2>/dev/null \
    || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  log "Swap configured: $(swapon --show=SIZE --noheadings --bytes /swapfile | numfmt --to=iec) (swappiness=10)."
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
  configure_swap
  install_docker

  local user rc=0
  for user in ${SUDO_USERS//,/ }; do
    if ! create_user "$user" 1; then
      rc=1
    fi
  done
  create_user "$APP_USER" 0 || rc=1
  if [ "$rc" -ne 0 ]; then
    log "ERROR: one or more users could not be provisioned; aborting bootstrap."
    log "Fix: place the matching public key under $KEYS_DIR/<user>.pub and re-run."
    exit 1
  fi

  # The two preconditions every day-to-day deploy depends on. Without them
  # the next `deploy.sh up` either fails rsync with "failed to set times"
  # (root-owned tree, deployer cannot utimes() dirs) or copies the secrets
  # world-readable (scp propagates the source's mode, /mnt/e drvfs gives
  # 0666). Both were left as an operator TODO in
  # docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md
  # §6; bootstrap now establishes them in the same root-privileged window
  # so the operator never has to.
  if [ -d "$REMOTE_DIR" ]; then
    log "Setting ownership of $REMOTE_DIR to ${DEPLOY_USER}:${DEPLOY_USER} ..."
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REMOTE_DIR"
    chmod 600 "$REMOTE_DIR/infra/.env" "$REMOTE_DIR/deploy/.env" 2>/dev/null || true
    # Drop world-writable bits the WSL drvfs upload may have planted.
    chmod -R o-w "$REMOTE_DIR"
  else
    log "NOTE: $REMOTE_DIR does not exist yet; ownership will be fixed by the"
    log "      first successful `deploy.sh up`. To skip the cycle: chown it now."
  fi

  configure_ufw

  log "Bootstrap complete. Next: run deploy/deploy.sh up"
}

main "$@"
