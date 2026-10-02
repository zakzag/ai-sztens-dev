#!/usr/bin/env bash
# AIsztens — stack smoke test entrypoint.
#
# Runs the full container-level integration suite against the docker compose
# stack defined in infra/docker-compose.yml. Designed to be run locally on a
# developer's machine (WSL or Linux + Docker) before deploying.
#
# Usage:
#   pnpm test:stack                    # run the suite (requires the stack up)
#   bash scripts/test/stack-smoke.sh --up      # also bring the stack up first
#   bash scripts/test/stack-smoke.sh --down    # tear the stack down after success
#
# Exit codes:
#   0 — every check passed
#   1 — at least one check failed (the stack was up, but something is broken)
#   2 — the stack was not running and we did not bring it up
#
# For finer control use --compose-file and --env-file. The script does not
# modify any container, image, or volume — it is strictly read-only with
# respect to the running stack.

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument parsing (kept tiny on purpose)
# ---------------------------------------------------------------------------

SMOKE_OPT_UP=""
SMOKE_OPT_DOWN=""
SMOKE_OPT_YES=""

while [ $# -gt 0 ]; do
  case "$1" in
    --up)        SMOKE_OPT_UP=1;   shift ;;
    --down)      SMOKE_OPT_DOWN=1; shift ;;
    --yes|-y)    SMOKE_OPT_YES=1;  shift ;;
    --compose-file) COMPOSE_FILE="$2"; shift 2 ;;
    --env-file)     ENV_FILE="$2";     shift 2 ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

export SMOKE_OPT_UP SMOKE_OPT_DOWN SMOKE_OPT_YES

# Tell the prelude where the entrypoint lives so it can resolve paths
# without depending on BASH_SOURCE (which is empty when sourced via
# process substitution).
export SMOKE_ENTRYPOINT="$0"

# ---------------------------------------------------------------------------
# Bring stack up if requested
# ---------------------------------------------------------------------------

if [ -n "$SMOKE_OPT_UP" ]; then
  echo ">> Bringing stack up via 'docker compose up -d --build' ..."
  # shellcheck disable=SC1091
  source "$(dirname "$0")/lib/00-prelude.sh"
  dc up -d --build
fi

# ---------------------------------------------------------------------------
# Source shared helpers and run checks
# ---------------------------------------------------------------------------

# Source prelude unconditionally — it sets REPO_ROOT, the wrappers, and the
# counters. If --up was used we already sourced it above; guard against that.
if [ -z "${REPO_ROOT:-}" ]; then
  # shellcheck disable=SC1091
  source "$(dirname "$0")/lib/00-prelude.sh"
fi

preflight_stack_up

log_section "Per-service liveness"
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/10-services.sh"
run_service_checks

log_section "Cross-service (do they see each other?)"
# shellcheck disable=SC1091
source "$(dirname "$0")/lib/20-cross-service.sh"
run_cross_service_checks

# ---------------------------------------------------------------------------
# Optional teardown
# ---------------------------------------------------------------------------

if [ -n "$SMOKE_OPT_DOWN" ]; then
  if [ -z "$SMOKE_OPT_YES" ] && [ -t 0 ]; then
    printf 'Tear the stack down? [y/N] '
    read -r ans
    case "$ans" in
      y|Y|yes|YES) ;;
      *) echo "Teardown skipped." ;;
    esac
  fi
  if [ -n "$SMOKE_OPT_YES" ] || { [ -t 0 ] && [ "${ans:-N}" = "y" ]; }; then
    echo ">> Tearing stack down ..."
    dc down
  fi
fi

summary_and_exit
