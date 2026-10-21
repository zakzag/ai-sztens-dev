#!/usr/bin/env bash
# Offline regression for the three-env leftover defaults.
#
# Context: the 2026-10-05 three-env cutover renamed the local-checkout
# plain-text files into per-env files (`infra/.env.local`, `infra/.env.dev`,
# `infra/.env.prod`). The cutover left three places still defaulting to the
# legacy `infra/.env`:
#
#   1. scripts/test/stack-up.sh
#   2. scripts/test/stack-down.sh
#   3. scripts/test/lib/00-prelude.sh
#
# ...and one place still silently falling back to the legacy file:
#
#   4. deploy/deploy.sh:upload() — the legacy-fallback branch was a Note-only
#      warning, so an unremoved `infra/.env` from a pre-cutover laptop would
#      quietly ship to the droplet. The deploy/.env rejection in 2026-10-06
#      is the pattern this should follow.
#
# This suite is split into two halves:
#
#   A. Static checks — grep each of the four files for the bug-pattern so a
#      future contributor who re-introduces a bare `infra/.env` default or
#      the soft-fallback line fails before anything else runs.
#
#   B. Sandbox run of `deploy.sh upload dev` on a throwaway repo with
#      `deploy/.env.dev` + ONLY the legacy `infra/.env` present. The run
#      must abort with the migration hint — never silently fall back.
#
# No ssh, no scp, no droplet. Stubs are NOT needed: deploy.sh's
# `assert_remote_ready` and `render_caddyfile` run before `upload()` for
# `ps` and `up` (which call the lifecycle hooks at the top level), but
# running the rejected command (`deploy.sh upload dev`) where the env-file
# rejection fires first means the suite never reaches ssh.

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$TEST_DIR/../.." && pwd)}"

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); printf '  [ OK ] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

# ---------------------------------------------------------------------------
# A. Static checks: the four defaults / soft-fallback must not be present.
# ---------------------------------------------------------------------------
# We allow `infra/.env` to APPEAR in each file (it's still in the
# `--env-file infra/.env` hint text and in the docstring), but the
# specific bug-patterns must be gone:
#
#   - the literal "${ENV_FILE:-$REPO_ROOT/infra/.env}" pattern (or
#     `${ENV_FILE:-infra/.env}`) — that's the legacy default
#   - the soft-fallback line ("Note: using legacy infra/.env") in deploy.sh
#
# Match-and-fail approach: grep -F the exact buggy snippet, expect 0 lines.

assert_no_pattern() {
  local label="$1" file="$2" pattern="$3"
  if grep -qF -- "$pattern" "$file"; then
    fail "$label — pattern '$pattern' is still present in $(basename "$file")"
    grep -nF -- "$pattern" "$file" | sed 's/^/         /'
  else
    pass "$label"
  fi
}

assert_pattern() {
  local label="$1" file="$2" pattern="$3"
  if grep -qF -- "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label — pattern '$pattern' missing from $(basename "$file")"
  fi
}

echo "--- A. static checks ---"

# Three files must NOT have the legacy default anymore.
assert_no_pattern "stack-up.sh has no legacy default"   "$REPO_DIR/scripts/test/stack-up.sh"  'ENV_FILE:-$REPO_ROOT/infra/.env}'
assert_no_pattern "stack-down.sh has no legacy default" "$REPO_DIR/scripts/test/stack-down.sh" 'ENV_FILE:-$REPO_ROOT/infra/.env}'
assert_no_pattern "prelude has no legacy default"       "$REPO_DIR/scripts/test/lib/00-prelude.sh" 'ENV_FILE:-$REPO_ROOT/infra/.env}'

# The three files MUST reference the per-env local default.
assert_pattern "stack-up.sh default is infra/.env.local"   "$REPO_DIR/scripts/test/stack-up.sh"  'ENV_FILE:-$REPO_ROOT/infra/.env.local}'
assert_pattern "stack-down.sh default is infra/.env.local" "$REPO_DIR/scripts/test/stack-down.sh" 'ENV_FILE:-$REPO_ROOT/infra/.env.local}'
assert_pattern "prelude default is infra/.env.local"       "$REPO_DIR/scripts/test/lib/00-prelude.sh" 'ENV_FILE:-$REPO_ROOT/infra/.env.local}'

# The hint message in stack-up.sh must NOT mention the old "infra/.env" recipe.
assert_no_pattern "stack-up.sh hint no longer names infra/.env" \
  "$REPO_DIR/scripts/test/stack-up.sh" \
  'Copy infra/.env.example to infra/.env first'

assert_pattern "stack-up.sh hint mentions pnpm dev-stack.sh up" \
  "$REPO_DIR/scripts/test/stack-up.sh" \
  'pnpm dev-stack.sh up'

# deploy.sh must NOT still have the soft-fallback line.
assert_no_pattern "deploy.sh soft-fallback line is gone" \
  "$REPO_DIR/deploy/deploy.sh" \
  'Note: using legacy infra/.env'

# deploy.sh MUST now have the hard-reject + migration hint.
assert_pattern "deploy.sh upload aborts on legacy infra/.env" \
  "$REPO_DIR/deploy/deploy.sh" \
  'Found the legacy infra/.env'
assert_pattern "deploy.sh migration hint shows mv command" \
  "$REPO_DIR/deploy/deploy.sh" \
  'mv infra/.env infra/.env.${APP_ENV}'
assert_pattern "deploy.sh abort message references the dev/prod/.local family" \
  "$REPO_DIR/deploy/deploy.sh" \
  'it has been replaced by per-env files'

# ---------------------------------------------------------------------------
# B. Sandbox run: `deploy.sh upload dev` with deploy/.env.dev set but
#    ONLY infra/.env (legacy) present — must abort with the migration hint
#    BEFORE any upload.
# ---------------------------------------------------------------------------
sandbox="$(mktemp -d)"
mkdir -p "$sandbox/deploy/lib" "$sandbox/infra"
cp "$REPO_DIR/deploy/deploy.sh" "$sandbox/deploy/deploy.sh"
cp "$REPO_DIR/deploy/lib/logger.sh" "$sandbox/deploy/lib/logger.sh"
cp "$REPO_DIR/deploy/.env.example" "$sandbox/deploy/.env.example"

# Only the legacy `infra/.env` exists — no `infra/.env.dev`. This is the
# exact shape of a laptop that was checked out pre-cutover and never
# re-synced.
printf 'DOMAIN=stub.example.com\nACME_EMAIL=ops@stub.example.com\n' >"$sandbox/infra/.env"
# A valid deploy/.env.dev with HOST set, so deploy.sh passes its own
# deploy-env-file guard and reaches upload().
printf 'HOST=stub.example.com\nSSH_USER=deployer\nREMOTE_DIR=/opt/aisztens\n' >"$sandbox/deploy/.env.dev"

out=""
rc=0
run_in_sandbox() {
  out="$(mktemp)"
  ( cd "$sandbox" && "${BASH:-bash}" deploy/deploy.sh "$@" ) >"$out" 2>&1
  rc=$?
}

dump() {
  printf '        --- output (exit=%s) ---\n' "$rc"
  sed 's/^/        /' "$out"
}

assert_rc() {
  local want=$1 label=$2
  if [ "$rc" = "$want" ]; then pass "$label (exit=$rc)"; else fail "$label (got exit=$rc, want $want)"; dump; fi
}

assert_out() {
  local pattern=$1 label=$2
  if grep -q -- "$pattern" "$out"; then pass "$label"; else fail "$label — '$pattern' not found"; dump; fi
}

echo "--- B. sandbox run: legacy infra/.env is hard-rejected ---"

# Tear down the plaintext sandbox and rebuild it with ssh/scp/rsync/pnpm
# stubs on PATH so the deploy.sh preflight (`assert_remote_ready`) does not
# short-circuit the test before the env-file check in `upload()` runs.
# Same stubs as scripts/test/_deploy-sh-remote-compose-path-test.sh.
rm -rf "$sandbox"
sandbox="$(mktemp -d)"
stubbin="$sandbox/stubbin"
mkdir -p "$sandbox/deploy/lib" "$sandbox/infra/caddy" "$stubbin"
cp "$REPO_DIR/deploy/deploy.sh" "$sandbox/deploy/deploy.sh"
cp "$REPO_DIR/deploy/lib/logger.sh" "$sandbox/deploy/lib/logger.sh"
cp "$REPO_DIR/deploy/.env.example" "$sandbox/deploy/.env.example"
cp "$REPO_DIR/infra/caddy/Caddyfile" "$sandbox/infra/caddy/Caddyfile"
# Local SOURCE = legacy infra/.env only. No infra/.env.dev. This is the
# exact shape of a laptop that was checked out pre-cutover and never
# re-synced (the very regression we want to guard against).
printf 'DOMAIN=stub.example.com\nACME_EMAIL=ops@stub.example.com\n' >"$sandbox/infra/.env"
# A valid deploy/.env.dev with HOST set, so deploy.sh passes its own
# deploy-env-file guard and reaches upload().
printf 'HOST=stub.example.com\nSSH_USER=deployer\nREMOTE_DIR=/opt/aisztens\n' >"$sandbox/deploy/.env.dev"

STUB_LOG="$sandbox/argv.log"
: >"$STUB_LOG"
export STUB_LOG STUB_PREFLIGHT=writable

write_stub() {
  local name="$1"
  shift
  cat >"$stubbin/$name"
  chmod +x "$stubbin/$name"
}

write_stub ssh <<'STUB'
#!/usr/bin/env bash
printf 'ssh %s\n' "$*" >>"${STUB_LOG:?}"
case "$*" in
  *"bash -s"*)
    cat >/dev/null
    printf 'WRITABLE\nLOGIN_USER=deployer\nOWNER=deployer:deployer 755\n'
    ;;
esac
exit 0
STUB
for tool in scp rsync pnpm; do
  write_stub "$tool" <<'STUB'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >>"${STUB_LOG:?}"
exit 0
STUB
done
export PATH="$stubbin:$PATH"

run_in_sandbox() {
  out="$(mktemp)"
  ( cd "$sandbox" && "${BASH:-bash}" deploy/deploy.sh "$@" ) >"$out" 2>&1
  rc=$?
}

run_in_sandbox upload dev
assert_rc 1 "upload aborts"
assert_out "source env file not found: infra/.env.dev" "names the per-env file the suite expected"
assert_out "Found the legacy infra/.env instead" "explains what was found instead"
assert_out "it has been replaced by per-env files" "explains why"
assert_out "mv infra/.env infra/.env.dev" "prints the migration command"
assert_out "Aborted before any file was shipped to the droplet" "guarantees nothing leaked"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
printf 'Pass: %d   Fail: %d\n' "$PASS" "$FAIL"
rm -rf "$sandbox" 2>/dev/null || true
[ "$FAIL" -eq 0 ]
