#!/usr/bin/env bash
# Callback Assistant — deploy helper (run from YOUR local machine).
#
# Requires: ssh, rsync (use Git Bash / WSL on Windows).
#
# Commands:
#   upload     build SPAs locally, then rsync the repo (minus build artifacts)
#              + the two apps/{web,admin}/dist/ folders to the droplet
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
REMOTE_DIR="${REMOTE_DIR:-/opt/aisztens}"
# Used by build_spas() to compute the production API base URL the SPAs are
# built against. Falls back to localhost for dry runs / local builds. The
# source of truth for the apex domain is infra/.env (read on the droplet);
# we read it locally if available so the SPA bundle picks up the right URL
# at build time without round-tripping through SSH.
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -f "$REPO_DIR/infra/.env" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$REPO_DIR/infra/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
DOMAIN="${DOMAIN:-localhost}"

# ACME_EMAIL is read the same way (defaults to nothing, which would make
# Caddy fall back to its own placeholder — let's be explicit instead).
ACME_EMAIL="${ACME_EMAIL:-}"
if [ -z "$ACME_EMAIL" ] && [ -f "$REPO_DIR/infra/.env" ]; then
  ACME_EMAIL="$(grep -E '^ACME_EMAIL=' "$REPO_DIR/infra/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"

COMPOSE_ARGS="--env-file infra/.env -f infra/docker-compose.yml"

# rsync's `-e` only accepts the remote shell command + its options (NOT the
# destination host), so keep the ssh command separate from the `user@host`
# pair. Otherwise rsync appends the host itself and the remote shell ends up
# running `user@host <host>` — surfacing as
# `bash: line 1: <host>: command not found`.
SSH_CMD=(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})
SSH=("${SSH_CMD[@]}" "$SSH_USER@$HOST")
SCP=(scp -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})

log() { echo "[deploy] $*"; }

# ---------------------------------------------------------------------------
# Build the two SPAs (apps/web, apps/admin) into apps/*/dist/. The SPAs
# read `import.meta.env.VITE_API_BASE_URL` at build time, so we pass the
# production URL inline. The same `DOMAIN` value is used by infra/caddy
# on the droplet, so they stay in sync.
build_spas() {
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found on PATH; skipping SPA build. Install pnpm or run the build manually."
    return 0
  fi
  local api_base="https://api.${DOMAIN}/api"
  log "Installing workspace dependencies ..."
  (cd "$REPO_DIR" && pnpm install --frozen-lockfile)
  log "Building @callback/web against VITE_API_BASE_URL=$api_base ..."
  (cd "$REPO_DIR" && VITE_API_BASE_URL="$api_base" pnpm --filter @callback/web build)
  log "Building @callback/admin against VITE_API_BASE_URL=$api_base ..."
  (cd "$REPO_DIR" && VITE_API_BASE_URL="$api_base" pnpm --filter @callback/admin build)
}

# ---------------------------------------------------------------------------
# Push only the freshly built apps/{web,admin}/dist/ folders to the droplet.
# The main rsync in upload() keeps `--exclude 'dist'` so no stale build
# artifacts leak into the repo upload; we explicitly re-include just the
# two SPA bundles Caddy mounts.
upload_dists() {
  for app in web admin; do
    local src="$REPO_DIR/apps/$app/dist"
    if [ ! -d "$src" ]; then
      log "Skipping $app dist (not built: $src)"
      continue
    fi
    log "Uploading $app dist -> $SSH_USER@$HOST:$REMOTE_DIR/apps/$app/dist ..."
    "${SSH[@]}" "mkdir -p $REMOTE_DIR/apps/$app/dist"
    rsync -az --delete -e "${SSH_CMD[*]}" \
      "$src/" "$SSH_USER@$HOST:$REMOTE_DIR/apps/$app/dist/"
  done
}

# ---------------------------------------------------------------------------
# Render infra/caddy/Caddyfile (template) → infra/caddy/Caddyfile.rendered
# (real config consumed by the Caddy container). Substitutes __DOMAIN__ and
# __ACME_EMAIL__ placeholders with the values resolved above. Must be called
# *after* upload() puts the template on the droplet, otherwise sed has no
# input to operate on. Idempotent.
#
# IMPORTANT: keep the placeholder tokens (`__DOMAIN__`, `__ACME_EMAIL__`) in
# sync with infra/caddy/Caddyfile. If a future change introduces a new
# env-driven value in the Caddyfile, add a corresponding `sed -i` line here.
render_caddyfile() {
  local template="$REPO_DIR/infra/caddy/Caddyfile"
  local rendered="$REPO_DIR/infra/caddy/Caddyfile.rendered"

  if [ ! -f "$template" ]; then
    log "ERROR: Caddyfile template not found at $template"
    return 1
  fi

  log "Rendering Caddyfile (DOMAIN=$DOMAIN, ACME_EMAIL=$ACME_EMAIL) ..."
  # Use a delimiter that does not appear in either the placeholders or the
  # substitution values. `|` is safe here because neither DOMAIN nor
  # ACME_EMAIL typically contain it.
  sed -e "s|<DOMAIN>|$DOMAIN|g" \
      -e "s|<ACME_EMAIL>|$ACME_EMAIL|g" \
      "$template" > "$rendered"

  # Quick sanity check: rendered file must not still contain placeholders,
  # otherwise the Caddy container would see `api.<DOMAIN>` and fail again.
  if grep -q '<DOMAIN>\|<ACME_EMAIL>' "$rendered"; then
    log "ERROR: rendered Caddyfile still contains unresolved placeholders"
    return 1
  fi

  # Ship it to the droplet so docker compose picks it up on next `up`.
  log "Uploading rendered Caddyfile -> $SSH_USER@$HOST:$REMOTE_DIR/infra/caddy/Caddyfile.rendered"
  "${SCP[@]}" "$rendered" "$SSH_USER@$HOST:$REMOTE_DIR/infra/caddy/Caddyfile.rendered"
}

# ---------------------------------------------------------------------------
upload() {
  log "Uploading $REPO_DIR -> $SSH_USER@$HOST:$REMOTE_DIR ..."
  "${SSH[@]}" "mkdir -p $REMOTE_DIR"
  rsync -az --delete -e "${SSH_CMD[*]}" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'deploy/.env' \
    --exclude 'infra/.env' \
    --exclude 'infra/caddy/Caddyfile.rendered' \
    "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"
  # Render runtime env files from the deploy/.env + infra/.env values (or the
  # INFRA_ENV GitHub secret in CI) and ship them on top. We don't rely on the
  # local copies being uploaded via rsync because they're gitignored.
  if [ -f "$SCRIPT_DIR/.env" ]; then
    log "Rendering deploy/.env on the droplet ..."
    "${SCP[@]}" "$SCRIPT_DIR/.env" "$SSH_USER@$HOST:$REMOTE_DIR/deploy/.env"
  fi
  if [ -f "$REPO_DIR/../infra/.env" ] || [ -f "$REPO_DIR/infra/.env" ]; then
    local_infra_env=""
    [ -f "$REPO_DIR/infra/.env" ] && local_infra_env="$REPO_DIR/infra/.env"
    log "Rendering infra/.env on the droplet ..."
    "${SCP[@]}" "$local_infra_env" "$SSH_USER@$HOST:$REMOTE_DIR/infra/.env"
  fi
  # Build the SPAs locally and ship only the two dist/ folders. The main
  # rsync above excludes dist/ on purpose; this is the single source of
  # truth for what the Caddy container ends up serving.
  build_spas
  upload_dists
  # Render + ship the Caddyfile so the running container sees the real
  # domain (not the template's __DOMAIN__ placeholder).
  render_caddyfile
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
