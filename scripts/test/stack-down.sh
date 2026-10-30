#!/usr/bin/env bash
# AIsztens — convenience wrapper: take the stack down.
#
# Wired to `pnpm test:stack:down`. Does NOT remove volumes or images, only
# stops and removes containers. Persistent data (postgres volume) is kept.
#
# Defaults follow the three-env layout: `infra/.env.local` is the default;
# override with `ENV_FILE=infra/.env.dev pnpm test:stack:down` for a different
# environment. The file only needs to exist for `docker compose` to read it —
# unlike `stack-up.sh`, a missing file here is NOT a hard error, because the
# stack may already be gone.
#
# Usage:
#   pnpm test:stack:down

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/infra/.env.local}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose.yml}"

echo ">> Tearing stack down ..."
echo "   env file:     $ENV_FILE"
echo "   compose file: $COMPOSE_FILE"

docker compose \
  --project-directory "$REPO_ROOT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  down
