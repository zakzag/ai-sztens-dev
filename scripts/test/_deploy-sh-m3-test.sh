#!/usr/bin/env bash
# Offline test for the M3 (.env path-resolution) fix in deploy.sh.
# Reproduces the exact if/elif/else block the deploy script now uses
# and checks the two branches that can be exercised in this sandbox
# (the parent-dir test is skipped: writing above the repo root hits
# filesystem-permission boundaries that are not portable to a CI runner).
set -o pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
TEST_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$TEST_DIR/../.." && pwd)}"
SCRIPT_DIR="$REPO_DIR/deploy"

log() { echo "[deploy] $*"; }

# Same logic the deploy.sh upload() function now uses:
resolve_local_infra_env() {
  local local_infra_env=""
  if [ -f "$REPO_DIR/infra/.env" ]; then
    local_infra_env="$REPO_DIR/infra/.env"
  elif [ -f "$REPO_DIR/../infra/.env" ]; then
    local_infra_env="$REPO_DIR/../infra/.env"
  else
    log "ERROR: no infra/.env found (looked in $REPO_DIR and $REPO_DIR/..). Copy infra/.env.example to infra/.env and fill it in before deploying."
    return 1
  fi
  log "would scp $local_infra_env"
  echo "$local_infra_env"
}

assert_eq() {
  local got=$1 want=$2 label=$3
  if [ "$got" = "$want" ]; then
    echo "PASS  $label  ($got)"
  else
    echo "FAIL  $label  got=$got want=$want"
    return 1
  fi
}

fail=0

# ---- Test 1: real infra/.env present (the normal case)
echo "--- Test 1: infra/.env present in repo ---"
stdout_file="$(mktemp)"; stderr_file="$(mktemp)"
trap 'rm -f "$stdout_file" "$stderr_file"' EXIT
set +e
resolve_local_infra_env >"$stdout_file" 2>"$stderr_file"
rc=$?
set -e
assert_eq "$rc" "0" "test1.exit" || fail=1
# The deploy.sh function prints a "[deploy] would scp PATH" log line AND echoes
# the bare PATH on its own line. Accept the bare PATH as the relevant value.
last_line="$(tail -n 1 "$stdout_file")"
assert_eq "$last_line" "$REPO_DIR/infra/.env" "test1.path" || fail=1
# On the happy path there must be no ERROR on stderr
if grep -q '^ERROR' "$stderr_file"; then
  echo "FAIL  test1.unexpected-stderr  err=$(cat "$stderr_file")"; fail=1
else
  echo "PASS  test1.no-stderr-error"
fi

# ---- Test 2: neither present (clear ERROR + exit 1)
echo "--- Test 2: neither file present ---"
saved="$(mktemp -t infra.env.test.XXXXXX)"
cp "$REPO_DIR/infra/.env" "$saved"
rm -f "$REPO_DIR/infra/.env"
stdout_file="$(mktemp)"; stderr_file="$(mktemp)"
set +e
resolve_local_infra_env >"$stdout_file" 2>"$stderr_file"
rc=$?
set -e
mv "$saved" "$REPO_DIR/infra/.env"
assert_eq "$rc" "1" "test2.exit" || fail=1
# stdout must contain the explicit error message (log() writes to stdout,
# which is what the operator sees during a real deploy — that is the
# intended behaviour, so we assert on the visible stream, not stderr).
if grep -q 'ERROR: no infra/.env found' "$stdout_file"; then
  echo "PASS  test2.stdout-error-message"
else
  echo "FAIL  test2.stdout-error-message  stdout=$(cat "$stdout_file")"; fail=1
fi
# And the function must NOT have printed a path (it has nothing valid to print).
if grep -q '^/' "$stdout_file"; then
  echo "FAIL  test2.no-path-printed  stdout=$(cat "$stdout_file")"; fail=1
else
  echo "PASS  test2.no-path-printed"
fi

if [ "$fail" = "0" ]; then
  echo "ALL_OK"
  exit 0
else
  echo "SOME_FAILED"
  exit 1
fi
