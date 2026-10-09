#!/usr/bin/env bash
# Offline test for the deploy TARGET argument of deploy/deploy.sh.
#
# Contract (docs/history/2026-10-06-deploy-env-selection-plan.md):
#
#   deploy.sh <command> [dev|prod] [--verbose]
#
#     dev    -> deploy/.env.dev    (DEFAULT when the argument is omitted)
#     prod   -> deploy/.env.prod
#     other  -> usage error, exit code 2
#
# Every scenario below aborts BEFORE any ssh / rsync / scp call, which is what
# makes this suite runnable without a droplet:
#
#   * invalid or duplicated target   -> exit 2, usage error
#   * missing env file               -> exit 1, message naming the file
#   * empty HOST in the env file     -> exit 1, message naming the file
#
# The suite NEVER touches the real deploy/.env.* files: deploy.sh is copied into
# a throwaway "repo" together with lib/, and the script derives SCRIPT_DIR and
# REPO_DIR from its own path.
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$TEST_DIR/../.." && pwd)}"

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); printf '  [ OK ] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

# ---------------------------------------------------------------------------
# Throwaway repo holding only the script + its library.
# ---------------------------------------------------------------------------
sandbox="$(mktemp -d)"
mkdir -p "$sandbox/deploy/lib" "$sandbox/infra"
cp "$REPO_DIR/deploy/deploy.sh" "$sandbox/deploy/deploy.sh"
cp "$REPO_DIR/deploy/lib/logger.sh" "$sandbox/deploy/lib/logger.sh"
cp "$REPO_DIR/deploy/.env.example" "$sandbox/deploy/.env.example"

out=""
rc=0

run_deploy() {
  out="$(mktemp)"
  # Use the interpreter that is running this test rather than a bare `bash`:
  # when the Windows PATH is inherited (bash.exe started from cmd or
  # PowerShell), `bash` resolves to the Microsoft Store WSL stub in
  # C:\...\WindowsApps before /usr/bin/bash. That would run deploy.sh *inside
  # WSL*, where an APP_ENV exported by this suite does not propagate the way
  # the assertions below expect — an environment artefact, not a script bug.
  ( cd "$sandbox" && "${BASH:-bash}" deploy/deploy.sh "$@" ) >"$out" 2>&1
  rc=$?
}

# Remove every env file from the sandbox so each scenario starts from a known state.
clear_envs() { rm -f "$sandbox"/deploy/.env "$sandbox"/deploy/.env.dev "$sandbox"/deploy/.env.prod; }

# write_env <target> <host>
write_env() { printf 'HOST=%s\nSSH_USER=deployer\nREMOTE_DIR=/opt/aisztens\n' "$2" >"$sandbox/deploy/.env.$1"; }

dump() {
  printf '        --- output (exit=%s) ---\n' "$rc"
  sed 's/^/        /' "$out"
}

assert_rc() {
  local want=$1 label=$2
  if [ "$rc" = "$want" ]; then
    pass "$label (exit=$rc)"
  else
    fail "$label (got exit=$rc, want $want)"
    dump
  fi
}

assert_out() {
  local pattern=$1 label=$2
  if grep -q -- "$pattern" "$out"; then
    pass "$label"
  else
    fail "$label — '$pattern' not found"
    dump
  fi
}

assert_out_absent() {
  local pattern=$1 label=$2
  if grep -q -- "$pattern" "$out"; then
    fail "$label — unexpected '$pattern' present"
    dump
  else
    pass "$label"
  fi
}

# ---------------------------------------------------------------------------
# 1. An invalid target must be rejected as a usage error (exit 2), and the run
#    must still be logged (validation happens after deploy_log_init).
# ---------------------------------------------------------------------------
echo "--- 1. invalid target ---"
clear_envs
run_deploy up staging
assert_rc 2 "invalid target is a usage error"
assert_out "invalid environment 'staging'" "invalid target is named in the error"
assert_out "valid values are: dev, prod" "the valid values are listed"
if ls "$sandbox"/deploy/log/deploy-*.log >/dev/null 2>&1; then
  pass "a rejected target still leaves a log file"
else
  fail "a rejected target still leaves a log file"
fi

# ---------------------------------------------------------------------------
# 2. Two targets are ambiguous -> usage error.
# ---------------------------------------------------------------------------
echo "--- 2. two targets ---"
clear_envs
run_deploy up dev prod
assert_rc 2 "two targets is a usage error"
assert_out "two environments given" "the ambiguity is explained"

# ---------------------------------------------------------------------------
# 3. Unknown argument -> usage error.
# ---------------------------------------------------------------------------
echo "--- 3. unknown argument ---"
clear_envs
run_deploy up --nope
assert_rc 2 "an unknown argument is a usage error"
assert_out "unexpected argument '--nope'" "the offending argument is named"

# ---------------------------------------------------------------------------
# 4. Default target is dev: with only .env.prod on disk, a bare command must
#    look for deploy/.env.dev (and say so).
# ---------------------------------------------------------------------------
echo "--- 4. default target is dev ---"
clear_envs
write_env prod ""
run_deploy ps
assert_rc 1 "missing default env file aborts"
assert_out "environment file not found: deploy/.env.dev" "the DEFAULT target file (.env.dev) is reported"

# ---------------------------------------------------------------------------
# 5. Explicit prod target resolves deploy/.env.prod.
# ---------------------------------------------------------------------------
echo "--- 5. explicit prod ---"
clear_envs
write_env dev ""
write_env prod ""
run_deploy ps prod
assert_rc 1 "empty HOST in .env.prod aborts"
assert_out "HOST is not set in deploy/.env.prod" "the PROD file is the one that was loaded"

# ---------------------------------------------------------------------------
# 6. The target also selects APP_ENV (no fallback to the built-in default).
# ---------------------------------------------------------------------------
echo "--- 6. APP_ENV follows the target ---"
clear_envs
write_env prod ""
run_deploy ps prod
assert_out "target 'prod' from argument" "the target is reported as coming from the argument"
if grep -q "APP_ENV=prod" "$sandbox"/deploy/log/latest.log 2>/dev/null; then
  pass "APP_ENV is recorded as prod in the log header/config"
else
  fail "APP_ENV is recorded as prod in the log header/config"
fi

# ---------------------------------------------------------------------------
# 7. APP_ENV from the environment is still honoured when no target is given
#    (backwards compatibility), and is reported as the source.
# ---------------------------------------------------------------------------
echo "--- 7. APP_ENV env var fallback ---"
clear_envs
write_env prod ""
out="$(mktemp)"
( cd "$sandbox" && export APP_ENV=prod && "${BASH:-bash}" deploy/deploy.sh ps ) >"$out" 2>&1
rc=$?
assert_rc 1 "APP_ENV=prod without a target resolves .env.prod"
assert_out "HOST is not set in deploy/.env.prod" "the env-var-selected file was loaded"
assert_out "from APP_ENV environment variable" "the source of the target is reported"

# ---------------------------------------------------------------------------
# 8. The argument wins over a conflicting APP_ENV, with a warning.
# ---------------------------------------------------------------------------
echo "--- 8. argument beats APP_ENV ---"
clear_envs
write_env prod ""
out="$(mktemp)"
( cd "$sandbox" && export APP_ENV=dev && "${BASH:-bash}" deploy/deploy.sh ps prod ) >"$out" 2>&1
rc=$?
assert_rc 1 "the conflicting case still aborts on the empty HOST"
assert_out "HOST is not set in deploy/.env.prod" "the ARGUMENT target won"
assert_out "APP_ENV=dev was set in the environment" "the override is warned about"

# ---------------------------------------------------------------------------
# 9. --verbose is accepted before or after the target, and the legacy bare
#    .env is NOT used as a fallback (it produces a migration hint instead).
# ---------------------------------------------------------------------------
echo "--- 9. flag order + legacy .env migration hint ---"
clear_envs
write_env dev ""
run_deploy ps --verbose dev
assert_rc 1 "--verbose before the target is accepted"
assert_out "HOST is not set in deploy/.env.dev" "the target was still resolved correctly"

clear_envs
printf 'HOST=\nSSH_USER=deployer\n' >"$sandbox/deploy/.env"
run_deploy ps prod
assert_rc 1 "a legacy deploy/.env is not used as a fallback"
assert_out "Found the legacy deploy/.env" "the legacy file is detected"
assert_out "mv deploy/.env deploy/.env.dev" "the migration command is suggested"

# ---------------------------------------------------------------------------
# 10. `local` is rejected with an explanation (it is not a deploy target).
# ---------------------------------------------------------------------------
echo "--- 10. local is rejected ---"
clear_envs
run_deploy up local
assert_rc 2 "local is a usage error"
assert_out "is not a deploy target" "local is explained, not just rejected"

# ---------------------------------------------------------------------------
# 11. help stays reachable regardless of targets or missing env files.
# ---------------------------------------------------------------------------
echo "--- 11. help ---"
clear_envs
run_deploy help
assert_rc 0 "help exits 0"
assert_out "\[dev|prod\]" "help documents the target argument"

rm -rf -- "$sandbox"

echo
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
