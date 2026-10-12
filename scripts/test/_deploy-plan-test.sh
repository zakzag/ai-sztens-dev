#!/usr/bin/env bash
# Offline unit test for .github/scripts/deploy-plan.sh (the `plan` job of
# deploy.yml). Exercises every trigger shape, including error cases.
#
# Usage: bash scripts/test/_deploy-plan-test.sh   (exit 0 = all pass)

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLAN="$REPO_DIR/.github/scripts/deploy-plan.sh"
SHA="0123456789abcdef0123456789abcdef01234567"
OTHER="fedcba9876543210fedcba9876543210fedcba98"
pass=0
fail=0

# run_case <label> <expected_rc> <expected_substrings...> -- <env assignments...>
run_case() {
  local label="$1" want_rc="$2"; shift 2
  local expects=()
  while [ "$1" != "--" ]; do expects+=("$1"); shift; done
  shift
  local out rc
  out="$(env -i PATH="$PATH" "$@" bash "$PLAN" 2>&1)"; rc=$?
  local ok=1
  [ "$rc" = "$want_rc" ] || ok=0
  for e in "${expects[@]}"; do
    printf '%s' "$out" | grep -qF -- "$e" || ok=0
  done
  if [ "$ok" = 1 ]; then
    pass=$((pass + 1)); echo "PASS  $label"
  else
    fail=$((fail + 1)); echo "FAIL  $label (rc=$rc, want $want_rc)"; printf '%s\n' "$out" | sed 's/^/      /'
  fi
}

run_case "dispatch dev default tag" 0 "should_deploy=true" "app_env=dev" "image_tag=sha-0123456" "ref=$SHA" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=dev HEAD_SHA="$SHA"
run_case "dispatch prod" 0 "should_deploy=true" "app_env=prod" "image_tag=sha-0123456" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=prod HEAD_SHA="$SHA"
run_case "dispatch tag override" 0 "image_tag=sha-abcdef1" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=dev INPUT_IMAGE_TAG=sha-abcdef1 HEAD_SHA="$SHA"
run_case "dispatch invalid tag" 1 "not a valid docker tag" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=dev 'INPUT_IMAGE_TAG=bad tag;rm' HEAD_SHA="$SHA"
run_case "dispatch invalid env" 1 "app_env must be" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=staging HEAD_SHA="$SHA"
run_case "dispatch empty env" 1 "app_env must be" -- \
  EVENT_NAME=workflow_dispatch HEAD_SHA="$SHA"
run_case "dispatch bad sha" 1 "not a commit SHA" -- \
  EVENT_NAME=workflow_dispatch INPUT_APP_ENV=dev HEAD_SHA=nope
run_case "wr push dev success uses head_sha" 0 "should_deploy=true" "app_env=dev" "image_tag=sha-fedcba9" "ref=$OTHER" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=success WR_EVENT=push WR_HEAD_BRANCH=dev WR_HEAD_SHA="$OTHER" HEAD_SHA="$SHA"
run_case "wr failure skips" 0 "should_deploy=false" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=failure WR_EVENT=push WR_HEAD_BRANCH=dev WR_HEAD_SHA="$OTHER"
run_case "wr cancelled skips" 0 "should_deploy=false" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=cancelled WR_EVENT=push WR_HEAD_BRANCH=dev WR_HEAD_SHA="$OTHER"
run_case "wr from dispatch skips" 0 "should_deploy=false" "not 'push'" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=success WR_EVENT=workflow_dispatch WR_HEAD_BRANCH=dev WR_HEAD_SHA="$OTHER"
run_case "wr other branch skips" 0 "should_deploy=false" "only 'dev'" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=success WR_EVENT=push WR_HEAD_BRANCH=main WR_HEAD_SHA="$OTHER"
run_case "wr missing head_sha fails" 1 "not a commit SHA" -- \
  EVENT_NAME=workflow_run WR_CONCLUSION=success WR_EVENT=push WR_HEAD_BRANCH=dev
run_case "unsupported event" 1 "unsupported event" -- \
  EVENT_NAME=push HEAD_SHA="$SHA"

# GITHUB_OUTPUT file mode
tmp="$(mktemp)"
env -i PATH="$PATH" GITHUB_OUTPUT="$tmp" EVENT_NAME=workflow_dispatch INPUT_APP_ENV=dev HEAD_SHA="$SHA" bash "$PLAN" >/dev/null
if grep -qx "app_env=dev" "$tmp" && grep -qx "should_deploy=true" "$tmp"; then
  pass=$((pass + 1)); echo "PASS  writes to GITHUB_OUTPUT"
else
  fail=$((fail + 1)); echo "FAIL  writes to GITHUB_OUTPUT"; cat "$tmp"
fi
rm -f "$tmp"

echo
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
