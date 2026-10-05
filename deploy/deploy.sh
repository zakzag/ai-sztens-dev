#!/usr/bin/env bash
# AIsztens — deploy helper (run from YOUR local machine).
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

# ---------------------------------------------------------------------------
# M1 (PR #1 of the deploy hardening plan): stage breadcrumbs.
#
# Every abort should tell the operator *which phase* failed and dump a few
# lines of remote context so they do not have to read the script. Stages
# are coarse-grained labels set by set_stage() before each major step.
# The ERR trap fires once on the first non-zero exit (set -e), prints the
# banner, and re-exits with the original failure code.
# ---------------------------------------------------------------------------
CURRENT_STAGE="init"
DEPLOY_START_TS="$(date +%s)"

log_stage()  { CURRENT_STAGE="$1"; log "→ stage=$1"; }
on_err() {
  local exit_code=$?
  local line=${1:-?}
  log "FAILED at stage=$CURRENT_STAGE line=$line exit=$exit_code after $(( $(date +%s) - DEPLOY_START_TS ))s"
  # Best-effort remote context: only attempt if the ssh array + compose args
  # were already initialised. If we died during init (e.g. set -u on HOST=)
  # those are still unset and expanding them here would mask the real error.
  if [ -n "${SSH_USER:-}" ] && [ -n "${HOST:-}" ] && [ -n "${SSH_CMD[*]:-}" ]; then
    "${SSH_CMD[@]}" "$SSH_USER@$HOST" \
      "cd ${REMOTE_DIR:-/opt/aisztens} 2>/dev/null && \
       docker compose ${COMPOSE_ARGS:-} ps -a 2>/dev/null; \
       docker compose ${COMPOSE_ARGS:-} logs --tail=20 2>/dev/null" \
      >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap 'on_err $LINENO' ERR

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
# Ensure the per-env SPA file exists for the current build mode, seeding it
# from the resolved `DOMAIN` when missing. Without this guard, a fresh
# droplet (which only has `.env.example` rsynced) would fail
# `pnpm ... build:dev` because `apps/<app>/.env.dev` is not tracked in
# the repo (it is gitignored, by design — see `.gitignore:58`).
#
# After the first run, the per-env file lives on the build host and the
# operator can hand-edit it for any future override. Subsequent deploys
# do NOT overwrite an existing file — they only seed the first time.
ensure_spa_env() {
  local app="$1" mode="$2" env_file="$REPO_DIR/apps/$app/.env.$mode"
  if [ -f "$env_file" ]; then
    return 0
  fi
  log "Seeding apps/$app/.env.$mode (DOMAIN=$DOMAIN) ..."
  case "$app" in
    web|admin)
      printf 'VITE_API_BASE_URL=https://api.%s/api\n' "$DOMAIN" > "$env_file"
      ;;
    *)
      log "ERROR: ensure_spa_env called with unknown app '$app'"
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Build the two SPAs (apps/web, apps/admin) into apps/*/dist/.
#
# Vite resolves `import.meta.env.VITE_API_BASE_URL` at build time. The
# value comes from per-env files (apps/<app>/.env.local / .env.dev /
# .env.prod) selected by the `--mode` flag passed to `vite build`. Today
# we always build for the dev droplet, so we pass `--mode dev`, which
# makes Vite pick up `apps/<app>/.env.dev` (see the three-env separation
# plan in docs/history/2026-10-05--10-30-00-three-env-separation-plan.md).
# Future prod deploys will pass `--mode prod`.
#
# Previously this function injected the API URL inline via `VITE_API_BASE_URL=`
# in front of the pnpm call. That bypassed the per-env file layout, made
# the deploy script the source of truth for the production URL, and silently
# overrode anything developers had set locally. The new `--mode dev` flow
# keeps the deploy script honest and makes the SPA env files the single
# source of truth for the built-in API URL.
build_spas() {
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found on PATH; skipping SPA build. Install pnpm or run the build manually."
    return 0
  fi
  local build_mode="${SPA_BUILD_MODE:-dev}"
  ensure_spa_env web  "$build_mode"
  ensure_spa_env admin "$build_mode"
  log "Installing workspace dependencies ..."
  (cd "$REPO_DIR" && pnpm install --frozen-lockfile)
  log "Building @callback/web (mode=$build_mode) ..."
  (cd "$REPO_DIR" && pnpm --filter @callback/web "build:${build_mode}")
  log "Building @callback/admin (mode=$build_mode) ..."
  (cd "$REPO_DIR" && pnpm --filter @callback/admin "build:${build_mode}")
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
# (real config consumed by the Caddy container). Substitutes <DOMAIN> and
# <ACME_EMAIL> placeholders with the values resolved above. Must be called
# *after* upload() puts the template on the droplet, otherwise sed has no
# input to operate on. Idempotent.
#
# IMPORTANT: keep the placeholder tokens (`<DOMAIN>`, `<ACME_EMAIL>`) in
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
  log_stage "upload_rsync"
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
    --exclude 'deploy/ssh-keys/' \
    "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"
  # Render runtime env files from the deploy/.env + infra/.env values (or the
  # INFRA_ENV GitHub secret in CI) and ship them on top. We don't rely on the
  # local copies being uploaded via rsync because they're gitignored.
  if [ -f "$SCRIPT_DIR/.env" ]; then
    log "Rendering deploy/.env on the droplet ..."
    "${SCP[@]}" "$SCRIPT_DIR/.env" "$SSH_USER@$HOST:$REMOTE_DIR/deploy/.env"
  fi
  # Pick exactly one local copy of infra/.env and refuse to proceed if none
  # exists. The previous implementation accepted `$REPO_DIR/../infra/.env`
  # as sufficient but only ever assigned `local_infra_env` from
  # `$REPO_DIR/infra/.env`; if only the parent-dir file existed the
  # standalone `[ -f ... ] && ...` list returned 1 and `set -e` aborted the
  # deploy (otherwise it would have tried to `scp ""`). Pin the choice
  # here so the failure mode is "clear error" instead of either.
  local local_infra_env=""
  if [ -f "$REPO_DIR/infra/.env" ]; then
    local_infra_env="$REPO_DIR/infra/.env"
  elif [ -f "$REPO_DIR/../infra/.env" ]; then
    local_infra_env="$REPO_DIR/../infra/.env"
  else
    log "ERROR: no infra/.env found (looked in $REPO_DIR and $REPO_DIR/..). Copy infra/.env.example to infra/.env and fill it in before deploying."
    return 1
  fi
  log "Rendering infra/.env on the droplet (source: $local_infra_env) ..."
  "${SCP[@]}" "$local_infra_env" "$SSH_USER@$HOST:$REMOTE_DIR/infra/.env"
  # Build the SPAs locally and ship only the two dist/ folders. The main
  # rsync above excludes dist/ on purpose; this is the single source of
  # truth for what the Caddy container ends up serving.
  build_spas
  upload_dists
  # Render + ship the Caddyfile so the running container sees the real
  # domain (not the template's <DOMAIN> placeholder).
  render_caddyfile
  log "Upload complete."
}

# ---------------------------------------------------------------------------
run_remote() {
  "${SSH[@]}" "cd $REMOTE_DIR && $1"
}

# ---------------------------------------------------------------------------
# Prune orphaned containers, networks and volumes from previous deployments
# that are no longer managed by the current `docker-compose.yml`. This is the
# safety net that prevents the "two Caddy containers fight over 80/443"
# regression: every historical compose project that ever bound port 80/443
# MUST be removed before `up` runs, otherwise the new Caddy exits 128 with
# `port is already allocated` and the site goes dark.
#
# Strategy:
#   1. `docker compose down --remove-orphans` for the CURRENT project
#      (`aisztens`) — clean stop.
#   2. `docker ps -a --filter ...` for the few well-known historical project
#      names that have lived on this droplet (added one-by-one as we find
#      them, e.g. `callback-assistant`) and `docker rm -f` them.
#   3. `docker network rm` for any orphan bridge networks that were created
#      by those projects and are now empty.
#
# `|| true` everywhere so the script still succeeds if nothing is left to
# clean up — this function is safe to call on a fresh droplet.
prune_legacy_stack() {
  log_stage "prune_legacy_stack"
  log "Pruning legacy/orphan containers on the droplet ..."
  "${SSH[@]}" "
    cd $REMOTE_DIR && \
    docker compose $COMPOSE_ARGS down --remove-orphans 2>/dev/null || true; \
    docker ps -a --format '{{.Names}}' \
      | grep -E '^(callback-assistant-|aisztens-legacy-|old-stack-)' \
      | xargs -r docker rm -f 2>/dev/null || true; \
    docker network ls --format '{{.Name}}' \
      | grep -E '^(callback-assistant_|aisztens-legacy_)' \
      | xargs -r docker network rm 2>/dev/null || true; \
    docker volume ls --format '{{.Name}}' \
      | grep -E '^(callback-assistant_|aisztens-legacy_)' \
      | xargs -r docker volume rm 2>/dev/null || true
  "
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
  down-all)
    # VENT PANE: tear down every docker-compose project on the droplet,
    # including historical ones, freeing 80/43 and removing all
    # Caddy/API/postgres/monitor containers. Use only when the stack is
    # wedged and `down` does not help.
    log "Tearing down every Docker object on the droplet (DESTRUCTIVE) ..."
    "${SSH[@]}" "
      cd $REMOTE_DIR && \
      docker compose $COMPOSE_ARGS down --remove-orphans 2>/dev/null || true; \
      docker ps -a --format '{{.Names}}' \
        | xargs -r docker rm -f 2>/dev/null || true; \
      docker network ls --format '{{.Name}}' \
        | grep -vE '^(bridge|host|none)$' \
        | xargs -r docker network rm 2>/dev/null || true; \
      docker volume ls --format '{{.Name}}' \
        | xargs -r docker volume rm 2>/dev/null || true
    "
    log "Droplet Docker state cleared. Next: ./deploy.sh up"
    ;;
  up)
    # CRITICAL: prune before bring-up. If a previous Caddy from a different
    # compose project still owns 80/443, the new one cannot bind them and
    # exits 128 — the site goes dark until the orphan is removed.
    # NOTE: this module still tears down the current project first;
    # splitting foreign-only-first is module M7 (PR #6 of the plan).
    log_stage "up_start"
    prune_legacy_stack
    upload
    log_stage "compose_up"
    log "Building & starting the stack ..."
    run_remote "docker compose $COMPOSE_ARGS up -d --build"
    log_stage "done"
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
    echo "Usage: $0 {upload|bootstrap|up|down|down-all|restart|ps|logs}"
    exit 1
    ;;
esac
