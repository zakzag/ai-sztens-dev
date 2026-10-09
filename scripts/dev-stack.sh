#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# dev-stack.sh — bring up the local AIsztens stack on a single command.
#
# Purpose:
#   Replace the multi-step docker compose incantation that mixes two override
#   files and three env files with one entry point. After this script, the
#   README's local-dev section can be: "./scripts/dev-stack.sh".
#
# What it does:
#   1. Ensures `infra/.env.local` exists (seeds it from `infra/.env.example`
#      on first run; warns the developer to change the placeholders).
#   2. Ensures `apps/api/.env.local`, `apps/web/.env.local`,
#      `apps/admin/.env.local` exist (seeding is the operator's job — the
#      template is `.env.example` in the same dir).
#   3. Exports `APP_ENV=local` so the API picks `apps/api/.env.local` and
#      reads the local CORS allow-list.
#   4. Runs `docker compose up -d --build` with:
#        --env-file infra/.env.local
#        -f infra/docker-compose.yml
#        -f infra/docker-compose.local.yml
#      The local override exposes `api:3000` + `postgres:5432` to the host
#      and disables Caddy (`profiles: [never]`).
#   5. Prints the URLs the developer should open.
#
# Subcommands:
#   up      (default) start the stack
#   down    stop the stack
#   ps      show container status
#   logs    tail logs (pass a service name as $2 to scope)
#   restart restart the stack
#
# Exit codes:
#   0 = success
#   1 = fatal error (docker missing, port already in use, etc.)
# ------------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

readonly COMPOSE_ENV_FILE="$REPO_DIR/infra/.env.local"
readonly COMPOSE_BASE="$REPO_DIR/infra/docker-compose.yml"
readonly COMPOSE_LOCAL_OVERRIDE="$REPO_DIR/infra/docker-compose.local.yml"

readonly -a COMPOSE_FILES=(
  "$COMPOSE_ENV_FILE"
  "$COMPOSE_BASE"
  "$COMPOSE_LOCAL_OVERRIDE"
)

log()  { printf '\033[36m[dev-stack]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[dev-stack]\033[0m %s\n' "$*"; }
warn() { printf '\033[35m[dev-stack]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[31m[dev-stack]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

require_docker() {
  command -v docker >/dev/null 2>&1 \
    || fail 'docker is not on PATH. Install Docker Desktop (with WSL integration) or native Docker inside WSL.'
  docker compose version >/dev/null 2>&1 \
    || fail '"docker compose" v2 is required (the plugin, not the legacy docker-compose binary).'
}

require_files() {
  [ -f "$COMPOSE_BASE" ]          || fail "missing base compose: $COMPOSE_BASE"
  [ -f "$COMPOSE_LOCAL_OVERRIDE" ] || fail "missing local override: $COMPOSE_LOCAL_OVERRIDE (was it renamed?)"
}

seed_local_env() {
  if [ -f "$COMPOSE_ENV_FILE" ]; then
    return 0
  fi
  if [ ! -f "$REPO_DIR/infra/.env.example" ]; then
    fail "missing infra/.env.example — cannot seed infra/.env.local"
  fi
  warn "infra/.env.local does not exist; seeding from infra/.env.example."
  warn "  Open it and replace the placeholder passwords BEFORE you POST data."
  cp "$REPO_DIR/infra/.env.example" "$COMPOSE_ENV_FILE"
  chmod 600 "$COMPOSE_ENV_FILE" || true
}

# ---------------------------------------------------------------------------
# Compose invocation
# ---------------------------------------------------------------------------

compose_args() {
  # Note: --env-file is passed BEFORE -f so the compose CLI substitutes
  # variables consistently across both compose files. Without it, the
  # local override's `${POSTGRES_PASSWORD:-postgres}` would default to
  # 'postgres' on first run.
  printf -- '--env-file %q ' "$COMPOSE_ENV_FILE"
  printf -- '-f %q ' "$COMPOSE_BASE"
  printf -- '-f %q ' "$COMPOSE_LOCAL_OVERRIDE"
}

dc_up() {
  seed_local_env
  log "Bringing up the local stack ..."
  # shellcheck disable=SC2046
  docker compose $(compose_args) up -d --build
  ok "Stack is up. Open one of:"
  echo "  - http://localhost:3000/healthz          (NestJS healthcheck)"
  echo "  - http://localhost:3000/api              (NestJS API root)"
  echo "  - psql -h localhost -U aisztens -d callback  (Postgres on :5432)"
  echo
  echo "Tear it down with: $0 down"
}

dc_down() {
  log "Stopping the local stack ..."
  # shellcheck disable=SC2046
  docker compose $(compose_args) down
  ok "Stack is down."
}

dc_ps() {
  # shellcheck disable=SC2046
  docker compose $(compose_args) ps
}

dc_logs() {
  # shellcheck disable=SC2046
  docker compose $(compose_args) logs --tail=200 "$@"
}

dc_restart() {
  log "Restarting the local stack ..."
  # shellcheck disable=SC2046
  docker compose $(compose_args) restart
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

require_docker
require_files

# APP_ENV=local is the contract: apps/api/src/config/app-env.ts reads this and
# the API picks apps/api/.env.local (which has the localhost CORS origins).
export APP_ENV="${APP_ENV:-local}"

case "${1:-up}" in
  up)      dc_up ;;
  down)    dc_down ;;
  ps)      dc_ps ;;
  logs)    shift; dc_logs "$@" ;;
  restart) dc_restart ;;
  -h|--help|help)
    sed -n '2,40p' "$0"
    ;;
  *)
    fail "unknown subcommand: $1 (try: up | down | ps | logs | restart)"
    ;;
esac