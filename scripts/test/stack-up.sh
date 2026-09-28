#!/usr/bin/env bash
# AIsztens — convenience wrapper: bring the stack up.
#
# Equivalent to running the canonical compose command directly, but with the
# same defaults the rest of scripts/test/ uses. Wired to `pnpm test:stack:up`.
#
# Usage:
#   pnpm test:stack:up

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Copy infra/.env.example to infra/.env first." >&2
  exit 1
fi

echo ">> Bringing stack up ..."
echo "   env file:     $ENV_FILE"
echo "   compose file: $COMPOSE_FILE"

docker compose \
  --project-directory "$REPO_ROOT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d --build
