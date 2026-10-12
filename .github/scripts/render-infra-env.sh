#!/usr/bin/env bash
# render-infra-env.sh — build the droplet's `infra/.env` from the
# INFRA_ENV_<ENV> secret plus the workflow's runtime-only values.
#
# The secret supplies the static config (DOMAIN, ACME_EMAIL, DB passwords,
# …). The workflow owns four keys and always writes them last:
#   APP_ENV, IMAGE_TAG, GHCR_OWNER, REGISTRY
# If the secret also contains any of them (typical when it was pasted from
# the droplet's own /opt/aisztens/infra/.env, which a previous deploy had
# already extended), those lines are STRIPPED from the rendered file and a
# `::warning::` annotation names the keys (never the values), instead of
# failing the deploy. The authoritative values are appended afterwards, so
# there is exactly one definition of each owned key in the output.
#
# Inputs (env vars):
#   INFRA_ENV    (required) full contents of the INFRA_ENV_* secret
#   APP_ENV      (required) dev | prod
#   IMAGE_TAG    (required) e.g. sha-abcdef1
#   GHCR_OWNER   (required) GHCR package owner
#   REGISTRY     (optional) default ghcr.io
#   OUT_FILE     (optional) default infra/.env
#
# Exit codes: 0 = file written; 1 = invalid input.

set -euo pipefail

OWNED_KEYS=(APP_ENV IMAGE_TAG GHCR_OWNER REGISTRY)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require() {
  local name="$1"
  [ -n "${!name:-}" ] || fail "$name is empty or unset"
}

# strip_owned_keys <content>
#   Prints the content without lines that define an owned key
#   (`KEY=…`, optional leading spaces / `export `). Prints the names of the
#   removed keys, one per line, to fd 3.
strip_owned_keys() {
  local content="$1" line key owned removed
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    removed=""
    for key in "${OWNED_KEYS[@]}"; do
      if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*= ]]; then
        removed="$key"
        break
      fi
    done
    if [ -n "$removed" ]; then
      printf '%s\n' "$removed" >&3
    else
      printf '%s\n' "$line"
    fi
  done <<<"$content"
}

main() {
  require INFRA_ENV
  require APP_ENV
  require IMAGE_TAG
  require GHCR_OWNER
  [[ "$APP_ENV" == "dev" || "$APP_ENV" == "prod" ]] || fail "APP_ENV must be dev|prod, got '$APP_ENV'"

  local registry="${REGISTRY:-ghcr.io}"
  local out="${OUT_FILE:-infra/.env}"
  mkdir -p "$(dirname "$out")"

  local removed_file
  removed_file="$(mktemp)"
  strip_owned_keys "$INFRA_ENV" 3>"$removed_file" >"$out"

  if [ -s "$removed_file" ]; then
    local keys
    keys="$(sort -u "$removed_file" | paste -sd, -)"
    echo "::warning title=INFRA_ENV_${APP_ENV^^} secret defines workflow-owned keys::Removed ${keys} from the secret copy; deploy.yml injects the authoritative values. Clean these lines out of the secret to silence this warning."
  fi
  rm -f "$removed_file"

  chmod 0644 "$out"
  {
    echo ""
    echo "# Written by deploy.yml"
    echo "APP_ENV=${APP_ENV}"
    echo "IMAGE_TAG=${IMAGE_TAG}"
    echo "GHCR_OWNER=${GHCR_OWNER}"
    echo "REGISTRY=${registry}"
  } >>"$out"

  echo "Rendered ${out} for APP_ENV=${APP_ENV} (IMAGE_TAG=${IMAGE_TAG})."
}

main
