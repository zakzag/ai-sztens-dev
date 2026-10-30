#!/usr/bin/env bash
# deploy-plan.sh — decide WHETHER, WHERE and WHAT `deploy.yml` deploys.
#
# Pure decision function used by the `plan` job of
# `.github/workflows/deploy.yml`. It reads the trigger shape from env vars,
# validates it, and writes the decision as `key=value` lines to
# "$GITHUB_OUTPUT" (or stdout when GITHUB_OUTPUT is unset, e.g. in tests).
#
# Why a script and not a `matrix` + job-level `if:`:
#   The job-level `if:` is evaluated BEFORE the matrix is expanded, so the
#   `matrix` context is not available there (only github/inputs/vars/needs).
#   A dedicated `plan` job exposes its decision through `needs.plan.outputs`,
#   which IS allowed in `jobs.<id>.if` and `jobs.<id>.environment`.
#
# Inputs (env vars):
#   EVENT_NAME       github.event_name (workflow_dispatch | workflow_run)
#   INPUT_APP_ENV    workflow_dispatch input `app_env` (dev | prod)
#   INPUT_IMAGE_TAG  workflow_dispatch input `image_tag` (optional override)
#   HEAD_SHA         github.sha (commit the dispatch ran on)
#   WR_CONCLUSION    github.event.workflow_run.conclusion
#   WR_EVENT         github.event.workflow_run.event (event that started images.yml)
#   WR_HEAD_BRANCH   github.event.workflow_run.head_branch
#   WR_HEAD_SHA      github.event.workflow_run.head_sha (commit images.yml built)
#   WR_TITLE         github.event.workflow_run.display_title
#                    (e.g. "Build and push images (dev)") — the
#                    deploy.yml workflow does not receive the
#                    `workflow_run` upstream's inputs, so the env is
#                    recovered from the run-name we set on images.yml.
#
# Outputs:
#   should_deploy  true | false
#   app_env        dev | prod
#   image_tag      sha-<7 hex> (or the validated dispatch override)
#   ref            full commit SHA to check out the compose/Caddyfile from
#   reason         human-readable explanation of the decision
#
# Exit codes: 0 = decision written (deploy or skip); 1 = invalid input.

set -euo pipefail

emit() {
  local target="${GITHUB_OUTPUT:-/dev/stdout}"
  printf '%s=%s\n' "$1" "$2" >>"$target"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

skip() {
  emit should_deploy false
  emit app_env dev
  emit image_tag ""
  emit ref ""
  emit reason "$1"
  echo "SKIP: $1"
  exit 0
}

short_tag() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || fail "not a commit SHA: '$sha'"
  printf 'sha-%s' "${sha:0:7}"
}

decide() {
  local app_env image_tag ref reason
  case "${EVENT_NAME:-}" in
    workflow_dispatch)
      app_env="${INPUT_APP_ENV:-}"
      [[ "$app_env" == "dev" || "$app_env" == "prod" ]] \
        || fail "app_env must be 'dev' or 'prod', got '${app_env}'"
      ref="${HEAD_SHA:-}"
      if [ -n "${INPUT_IMAGE_TAG:-}" ]; then
        [[ "$INPUT_IMAGE_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] \
          || fail "image_tag '${INPUT_IMAGE_TAG}' is not a valid docker tag"
        image_tag="$INPUT_IMAGE_TAG"
      else
        image_tag="$(short_tag "$ref")"
      fi
      [[ "$ref" =~ ^[0-9a-f]{7,40}$ ]] || fail "HEAD_SHA is not a commit SHA: '${ref}'"
      reason="manual dispatch (${app_env})"
      ;;
    workflow_run)
      [ "${WR_CONCLUSION:-}" = "success" ] \
        || skip "upstream images.yml concluded '${WR_CONCLUSION:-}', not 'success'"
      # Determine the env the upstream built for. The workflow_run
      # payload does NOT carry the upstream inputs, so we parse the env
      # from images.yml's run-name ("Build and push images (dev|prod)").
      # A push trigger has no input, so its run-name defaults to
      # "(dev)" via the `${{ inputs.app_env || 'dev' }}` template.
      wr_title="${WR_TITLE:-}"
      if [[ "$wr_title" =~ \((dev|prod)\)$ ]]; then
        app_env="${BASH_REMATCH[1]}"
        reason="auto-deploy after images.yml build for $app_env"
      else
        skip "upstream images.yml run-name '${wr_title}' has no (dev|prod) suffix; the env cannot be determined from the workflow_run payload alone"
      fi
      ref="${WR_HEAD_SHA:-}"
      image_tag="$(short_tag "$ref")"
      ;;
    *)
      fail "unsupported event '${EVENT_NAME:-}'"
      ;;
  esac

  emit should_deploy true
  emit app_env "$app_env"
  emit image_tag "$image_tag"
  emit ref "$ref"
  emit reason "$reason"
  echo "DEPLOY: app_env=${app_env} image_tag=${image_tag} ref=${ref} (${reason})"
}

decide
