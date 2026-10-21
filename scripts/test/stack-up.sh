#!/usr/bin/env bash
# AIsztens — convenience wrapper: bring the stack up.
#
# Equivalent to running the canonical compose command directly, but with the
# same defaults the rest of scripts/test/ uses. Wired to `pnpm test:stack:up`.
#
# Defaults follow the three-env layout (local / dev / prod): the local
# checkout ships `infra/.env.local` (seeded by `scripts/dev-stack.sh` from
# `infra/.env.example`), so this wrapper uses it as the default. To smoke a
# different environment, override with one of:
#
#   ENV_FILE=infra/.env.dev pnpm test:stack:up
#   bash scripts/test/stack-smoke.sh --env-file infra/.env.dev
#
# Usage:
#   pnpm test:stack:up

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env.local}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create it with one of:" >&2
  echo "  pnpm dev-stack.sh up              # seeds infra/.env.local from infra/.env.example" >&2
  echo "  cp infra/.env.example infra/.env.local   # then fill POSTGRES_PASSWORD, the DB_USER passwords, etc." >&2
  echo "Or pass --env-file infra/.env.dev (etc.) when running on a droplet or for a different env." >&2
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
