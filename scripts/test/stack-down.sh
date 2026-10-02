#!/usr/bin/env bash
# AIsztens — convenience wrapper: take the stack down.
#
# Wired to `pnpm test:stack:down`. Does NOT remove volumes or images, only
# stops and removes containers. Persistent data (postgres volume) is kept.
#
# Usage:
#   pnpm test:stack:down

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose.yml}"

echo ">> Tearing stack down ..."
echo "   env file:     $ENV_FILE"
echo "   compose file: $COMPOSE_FILE"

docker compose \
  --project-directory "$REPO_ROOT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  down
