#!/usr/bin/env bash
# Offline unit test for .github/scripts/render-infra-env.sh.
# Usage: bash scripts/test/_render-infra-env-test.sh   (exit 0 = all pass)

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$REPO_DIR/.github/scripts/render-infra-env.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pass=0
fail=0

ok()  { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; shift; printf '      %s\n' "$@"; }

# render <secret> [extra env assignments...]  -> sets $out_text, $log, $rc
render() {
  local secret="$1"; shift
  rm -f "$tmp/.env"
  log="$(env -i PATH="$PATH" INFRA_ENV="$secret" APP_ENV=dev IMAGE_TAG=sha-abc1234 \
        GHCR_OWNER=zakzag OUT_FILE="$tmp/.env" "$@" bash "$SCRIPT" 2>&1)"; rc=$?
  out_text="$(cat "$tmp/.env" 2>/dev/null || true)"
}

count() { printf '%s\n' "$out_text" | grep -cE "$1" || true; }

# 1. Clean secret: kept verbatim, owned keys appended once.
render $'DOMAIN=aisztens.hu\nACME_EMAIL=ops@aisztens.hu'
[ "$rc" = 0 ] && [ "$(count '^DOMAIN=aisztens.hu$')" = 1 ] && [ "$(count '^IMAGE_TAG=sha-abc1234$')" = 1 ] \
  && [ "$(count '^APP_ENV=dev$')" = 1 ] && [ "$(count '^GHCR_OWNER=zakzag$')" = 1 ] \
  && [ "$(count '^REGISTRY=ghcr.io$')" = 1 ] && ! printf '%s' "$log" | grep -q '::warning' \
  && ok "clean secret rendered, no warning" || bad "clean secret" "rc=$rc" "$log" "$out_text"

# 2. Secret with all four owned keys (the real-world failure): stripped + warned.
render $'DOMAIN=aisztens.hu\nAPP_ENV=prod\nIMAGE_TAG=latest\nGHCR_OWNER=someone\nREGISTRY=docker.io\nACME_EMAIL=a@b.c'
[ "$rc" = 0 ] && [ "$(count '^IMAGE_TAG=')" = 1 ] && [ "$(count '^IMAGE_TAG=sha-abc1234$')" = 1 ] \
  && [ "$(count '^APP_ENV=')" = 1 ] && [ "$(count '^APP_ENV=dev$')" = 1 ] \
  && [ "$(count '^GHCR_OWNER=zakzag$')" = 1 ] && [ "$(count '^REGISTRY=ghcr.io$')" = 1 ] \
  && [ "$(count '^DOMAIN=aisztens.hu$')" = 1 ] && [ "$(count '^ACME_EMAIL=a@b.c$')" = 1 ] \
  && printf '%s' "$log" | grep -q '::warning' \
  && printf '%s' "$log" | grep -q 'APP_ENV,GHCR_OWNER,IMAGE_TAG,REGISTRY' \
  && ! printf '%s' "$log" | grep -q 'someone' \
  && ok "owned keys stripped, warned (keys only, no values)" || bad "owned keys stripped" "rc=$rc" "$log" "$out_text"

# 3. Whitespace / export / CRLF variants are stripped too.
render $'DOMAIN=x.y\r\n  IMAGE_TAG = old\r\nexport GHCR_OWNER=old\r\n'
[ "$rc" = 0 ] && [ "$(count 'IMAGE_TAG')" = 1 ] && [ "$(count 'GHCR_OWNER')" = 1 ] \
  && [ "$(count '^DOMAIN=x.y$')" = 1 ] \
  && ok "indented / export / CRLF variants stripped" || bad "variants" "rc=$rc" "$log" "$out_text"

# 4. Similar-looking keys are NOT stripped.
render $'IMAGE_TAG_PREFIX=keep\nMY_APP_ENV=keep\nDOMAIN=x.y'
[ "$rc" = 0 ] && [ "$(count '^IMAGE_TAG_PREFIX=keep$')" = 1 ] && [ "$(count '^MY_APP_ENV=keep$')" = 1 ] \
  && ! printf '%s' "$log" | grep -q '::warning' \
  && ok "lookalike keys preserved" || bad "lookalike keys" "rc=$rc" "$log" "$out_text"

# 5. Commented owned key is preserved (not a definition).
render $'# IMAGE_TAG=old\nDOMAIN=x.y'
[ "$rc" = 0 ] && [ "$(count '^# IMAGE_TAG=old$')" = 1 ] \
  && ok "commented owned key preserved" || bad "commented key" "rc=$rc" "$log" "$out_text"

# 6. Registry override honoured.
render $'DOMAIN=x.y' REGISTRY=registry.example.com
[ "$rc" = 0 ] && [ "$(count '^REGISTRY=registry.example.com$')" = 1 ] \
  && ok "REGISTRY override" || bad "REGISTRY override" "rc=$rc" "$out_text"

# 7. Error cases.
render ''
[ "$rc" = 1 ] && printf '%s' "$log" | grep -q 'INFRA_ENV is empty' && ok "empty secret fails" || bad "empty secret" "rc=$rc" "$log"
render $'DOMAIN=x.y' APP_ENV=staging
[ "$rc" = 1 ] && printf '%s' "$log" | grep -q 'APP_ENV must be' && ok "bad APP_ENV fails" || bad "bad APP_ENV" "rc=$rc" "$log"
render $'DOMAIN=x.y' IMAGE_TAG=
[ "$rc" = 1 ] && printf '%s' "$log" | grep -q 'IMAGE_TAG is empty' && ok "empty IMAGE_TAG fails" || bad "empty IMAGE_TAG" "rc=$rc" "$log"

# 8. File mode is 0644 (scp-action tar needs it; step 5a re-tightens to 600).
render $'DOMAIN=x.y'
mode="$(stat -c '%a' "$tmp/.env" 2>/dev/null || stat -f '%Lp' "$tmp/.env")"
[ "$mode" = 644 ] && ok "mode 0644" || bad "mode" "got $mode"

echo
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
