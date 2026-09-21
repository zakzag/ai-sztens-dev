#!/usr/bin/env bash
# Callback Assistant — deploy helper (run from YOUR local machine).
#
# Requires: ssh, rsync (use Git Bash / WSL on Windows).
#
# Commands:
#   upload     rsync the repo (minus build artifacts) to the droplet
#   bootstrap  upload + run deploy/bootstrap.sh as root (first time only)
#   up         upload + build & start the Docker stack
#   down       stop the stack
#   restart    restart the stack
#   ps         show container status
#   logs       tail logs
#
# Configuration is read from deploy/.env (see deploy/.env.example).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi

HOST="${HOST:?Set HOST= in deploy/.env}"
SSH_USER="${SSH_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/callback}"
COMPOSE_ARGS="--env-file infra/.env -f infra/docker-compose.yml"

SSH=(ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$HOST")

log() { echo "[deploy] $*"; }

# ---------------------------------------------------------------------------
upload() {
  log "Uploading $REPO_DIR -> $SSH_USER@$HOST:$REMOTE_DIR ..."
  "${SSH[@]}" "mkdir -p $REMOTE_DIR"
  rsync -az --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.git' \
    --exclude '.env' \
    "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"
  log "Upload complete."
}

# ---------------------------------------------------------------------------
run_remote() {
  "${SSH[@]}" "cd $REMOTE_DIR && $1"
}

case "${1:-}" in
  upload)
    upload
    ;;
  bootstrap)
    upload
    log "Running bootstrap.sh on the droplet ..."
    run_remote "sudo bash deploy/bootstrap.sh"
    ;;
  up)
    upload
    log "Building & starting the stack ..."
    run_remote "docker compose $COMPOSE_ARGS up -d --build"
    ;;
  down)
    run_remote "docker compose $COMPOSE_ARGS down"
    ;;
  restart)
    run_remote "docker compose $COMPOSE_ARGS restart"
    ;;
  ps)
    run_remote "docker compose $COMPOSE_ARGS ps"
    ;;
  logs)
    run_remote "docker compose $COMPOSE_ARGS logs -f --tail=200"
    ;;
  *)
    echo "Usage: $0 {upload|bootstrap|up|down|restart|ps|logs}"
    exit 1
    ;;
esac
