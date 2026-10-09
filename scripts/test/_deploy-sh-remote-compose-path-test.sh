#!/usr/bin/env bash
# Offline test for the REMOTE identity + env-file path of deploy/deploy.sh.
#
# Contract (docs/history/2026-10-07-deploy-deployer-user-plan.md):
#
#   * every command except `bootstrap` logs in as `deployer` (the same account
#     the GitHub Actions workflow uses);
#   * the compose command that runs ON THE DROPLET must name the REMOTE env file
#     `infra/.env` — never the LOCAL per-env source `infra/.env.<target>`.
#
# Why this suite exists: naming the local per-env file in a remote command made
# `ps`, `logs`, `up`, `down` and `restart` all abort with
#   couldn't find env file: /opt/aisztens/infra/.env.dev
# while every other consumer (scripts/test/stack-smoke.sh, scripts/env-test/
# check-env-live.sh, deploy/README.md) already assumed `infra/.env`. No existing
# test covered it, because the offline suites only exercised abort paths that
# happen BEFORE the first ssh call.
#
# How it works: ssh / scp / rsync / pnpm are replaced by stubs on PATH that
# record their argv. Nothing touches the network, the real droplet or the real
# deploy/.env.* files — deploy.sh is copied into a throwaway "repo" together
# with lib/, and it derives SCRIPT_DIR and REPO_DIR from its own path.
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$TEST_DIR/../.." && pwd)}"

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); printf '  [ OK ] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

# ---------------------------------------------------------------------------
# Throwaway repo holding only what deploy.sh needs to run.
# ---------------------------------------------------------------------------
sandbox="$(mktemp -d)"
stubbin="$sandbox/stubbin"
mkdir -p "$sandbox/deploy/lib" "$sandbox/infra/caddy" "$sandbox/apps/web" "$sandbox/apps/admin" "$stubbin"
cp "$REPO_DIR/deploy/deploy.sh" "$sandbox/deploy/deploy.sh"
cp "$REPO_DIR/deploy/lib/logger.sh" "$sandbox/deploy/lib/logger.sh"
cp "$REPO_DIR/infra/caddy/Caddyfile" "$sandbox/infra/caddy/Caddyfile"
# The compose file is required by prune_legacy_stack's project-name
# resolution AND by verify_up_result's expected-service enumeration
# (both added for the compose-invisible stray fix). Keep it identical
# to the source so the test exercises the real path.
cp "$REPO_DIR/infra/docker-compose.yml" "$sandbox/infra/docker-compose.yml"
# The local SOURCE of the runtime env file (never the remote path).
printf 'DOMAIN=stub.example.com\nACME_EMAIL=ops@stub.example.com\n' >"$sandbox/infra/.env.dev"

STUB_LOG="$sandbox/argv.log"
: >"$STUB_LOG"
export STUB_LOG

write_stub() {
  local name="$1"
  shift
  cat >"$stubbin/$name"
  chmod +x "$stubbin/$name"
}

# ssh: record argv, drain any script piped on stdin (the preflight probe), then
# answer that probe according to STUB_PREFLIGHT:
#   writable  -> the probe ran and the directory is writable
#   readonly  -> the probe ran and the directory is NOT writable
#   sshfail   -> the SSH client refused the key, so the probe never ran at all
write_stub ssh <<'STUB'
#!/usr/bin/env bash
printf 'ssh %s\n' "$*" >>"${STUB_LOG:?}"
# Only the preflight probe pipes a script on stdin; drain it there so the
# caller never sees a broken pipe, and never block on stdin otherwise.
case "$*" in
  *"bash -s"*)
    cat >/dev/null
    case "${STUB_PREFLIGHT:-writable}" in
      writable) printf 'WRITABLE\nLOGIN_USER=deployer\nOWNER=deployer:deployer 755\n' ;;
      wrongowner) printf 'WRITABLE\nLOGIN_USER=deployer\nOWNER=root:root 755\n' ;;
      readonly) printf 'NOT_WRITABLE\nLOGIN_USER=deployer\nOWNER=root:root 755\n' ;;
      mkdirfail)
        # The real shape of the failure: mkdir is refused AND the follow-up
        # `stat` says "Permission denied" too. That word must not be mistaken
        # for an SSH/connection problem.
        printf 'MKDIR_FAILED\n'
        printf 'LOGIN_USER=deployer\n'
        printf "OWNER=stat: cannot statx '/opt/aisztens': Permission denied\n"
        ;;
      sshfail)
        printf '@@@@ WARNING: UNPROTECTED PRIVATE KEY FILE! @@@@\n'
        printf 'Permissions 0777 for the key are too open.\n'
        printf 'Load key "x": bad permissions\n'
        printf 'deployer@stub.example.com: Permission denied (publickey).\n'
        exit 255
        ;;
    esac
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

# Put the stubs first so the real ssh/scp/rsync/pnpm are never reached, while
# the coreutils deploy.sh needs (grep, sed, cut, tr, date, rm) still resolve.
export PATH="$stubbin:$PATH"

out=""
rc=0
run_deploy() {
  out="$(mktemp)"
  # Use the interpreter running this test rather than a bare `bash`: an
  # inherited Windows PATH resolves `bash` to the Microsoft Store WSL stub
  # (same reasoning as _deploy-sh-env-selection-test.sh).
  ( cd "$sandbox" && "${BASH:-bash}" deploy/deploy.sh "$@" ) >"$out" 2>&1
  rc=$?
}

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
  if grep -qF -- "$pattern" "$out"; then
    pass "$label"
  else
    fail "$label — '$pattern' not found"
    dump
  fi
}

assert_log() {
  local pattern=$1 label=$2
  if grep -qF -- "$pattern" "$STUB_LOG"; then
    pass "$label"
  else
    fail "$label — '$pattern' not found in the recorded ssh/scp argv"
    printf '        --- recorded argv ---\n'
    sed 's/^/        /' "$STUB_LOG"
  fi
}

assert_log_absent() {
  local pattern=$1 label=$2
  if grep -qF -- "$pattern" "$STUB_LOG"; then
    fail "$label — unexpected '$pattern' present"
    printf '        --- recorded argv ---\n'
    sed 's/^/        /' "$STUB_LOG"
  else
    pass "$label"
  fi
}

# ---------------------------------------------------------------------------
# Scenario 1: `ps dev` — the remote compose command must use the REMOTE path
# and the `deployer` identity.
# ---------------------------------------------------------------------------
printf 'Scenario 1: ps dev (remote compose path + identity)\n'
printf 'HOST=stub.example.com\nSSH_USER=deployer\nREMOTE_DIR=/opt/aisztens\n' >"$sandbox/deploy/.env.dev"
: >"$STUB_LOG"

run_deploy ps dev --verbose
assert_rc 0 "test1.exit"
assert_log "deployer@stub.example.com" "test1.login-user-is-deployer"
assert_log_absent "root@stub.example.com" "test1.no-root-login"
assert_log "--env-file infra/.env " "test1.remote-env-file-is-infra/.env"
assert_log_absent "infra/.env.dev" "test1.no-local-per-env-name-in-remote-command"
assert_log "-f infra/docker-compose.yml" "test1.compose-file-unchanged"
assert_out "APP_ENV=dev" "test1.config-log-lines"

# ---------------------------------------------------------------------------
# Scenario 2: an env file WITHOUT SSH_USER must not silently deploy as root.
# ---------------------------------------------------------------------------
printf 'Scenario 2: SSH_USER default\n'
printf 'HOST=stub.example.com\nREMOTE_DIR=/opt/aisztens\n' >"$sandbox/deploy/.env.dev"

run_deploy ps dev
assert_rc 0 "test2.exit"
assert_log "deployer@stub.example.com" "test2.default-login-user-is-deployer"

# ---------------------------------------------------------------------------
# Scenario 3: `upload dev` with a writable remote tree — the preflight passes
# and the local SOURCE stays the per-env file.
# ---------------------------------------------------------------------------
printf 'Scenario 3: upload dev (preflight passes)\n'
printf 'HOST=stub.example.com\nSSH_USER=deployer\nREMOTE_DIR=/opt/aisztens\n' >"$sandbox/deploy/.env.dev"
: >"$STUB_LOG"
export STUB_PREFLIGHT=writable

run_deploy upload dev --verbose
assert_rc 0 "test3.exit"
assert_out "Preflight OK" "test3.preflight-ran"
assert_log "bash -s" "test3.preflight-probe-used-ssh-stdin"
assert_log "infra/.env.dev" "test3.local-source-is-the-per-env-file"
assert_log "deploy/.env" "test3.deploy-env-shipped"
assert_out "remote infra/.env" "test3.remote-path-logged"

# ---------------------------------------------------------------------------
# Scenario 4: `upload dev` with a remote tree the user cannot write — abort with
# the one-line fix, before anything is uploaded.
# ---------------------------------------------------------------------------
printf 'Scenario 4: upload dev (preflight fails)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=readonly

run_deploy upload dev
assert_rc 1 "test4.exit"
assert_out "can write /opt/aisztens" "test4.names-the-directory"
assert_out "owner:group mode = root:root 755" "test4.reports-the-owner"
assert_out "chown -R deployer:deployer /opt/aisztens" "test4.prints-the-fix"
assert_out "Aborted before any upload" "test4.aborts-before-upload"
assert_log_absent "rsync " "test4.no-rsync-attempted"

# ---------------------------------------------------------------------------
# Scenario 5: the probe cannot run at all (the SSH client refuses the key).
# "No evidence of failure" must NOT be read as success — that turned the guard
# into a no-op the first time it ran live under WSL, where the private key is
# visible as 0777 and OpenSSH refuses it before the probe starts.
# ---------------------------------------------------------------------------
printf 'Scenario 5: upload dev (the probe never runs)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=sshfail

run_deploy upload dev
assert_rc 1 "test5.exit"
assert_out "probe never ran" "test5.detects-the-failed-connection"
assert_out "Permissions 0777" "test5.quotes-the-ssh-error"
assert_out "icacls" "test5.points-at-the-acl-fix"
assert_out "Aborted before any upload" "test5.aborts-before-upload"
assert_log_absent "rsync " "test5.no-rsync-attempted"

# ---------------------------------------------------------------------------
# Scenario 6: mkdir fails AND stat also reports "Permission denied". The
# diagnosis must be the directory ownership (with the chown fix), NOT the
# SSH-key hint — a bare `stat` on an unreadable path prints the same words.
# ---------------------------------------------------------------------------
printf 'Scenario 6: upload dev (mkdir refused, stat says Permission denied)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=mkdirfail

run_deploy upload dev
assert_rc 1 "test6.exit"
assert_out "cannot write /opt/aisztens" "test6.names-the-directory"
assert_out "chown -R deployer:deployer /opt/aisztens" "test6.prints-the-chown-fix"
if grep -qF 'icacls' "$out"; then
  fail "test6.no-misleading-acl-hint"
  dump
else
  pass "test6.no-misleading-acl-hint"
fi
assert_log_absent "rsync " "test6.no-rsync-attempted"
unset STUB_PREFLIGHT

# ---------------------------------------------------------------------------
# Scenario 7: the directory IS writable but owned by a different account
# (the regression that produced the "failed to set times ... Operation not
# permitted" wall at 22:25). Preflight must abort and print the chown fix,
# not silently fall through and let rsync die with exit 23.
# ---------------------------------------------------------------------------
printf 'Scenario 7: upload dev (writable but wrong owner)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=wrongowner   # stub returns WRITABLE + OWNER=root:root 755

run_deploy upload dev
assert_rc 1 "test7.exit"
assert_out "is owned by 'root'" "test7.reports-the-wrong-owner"
assert_out "failed to set times" "test7.explains-why-it-matters"
assert_out "chown -R deployer:deployer /opt/aisztens" "test7.prints-the-chown-fix"
assert_out "Aborted before any upload" "test7.aborts-before-upload"
assert_log_absent "rsync " "test7.no-rsync-attempted"
unset STUB_PREFLIGHT

# ---------------------------------------------------------------------------
# Scenario 8: `bootstrap dev` must ship the *.pub halves onto the droplet
# and refuse to run if none are present, so the public keys actually reach
# bootstrap.sh's create_user() (regression: four "no public key" warnings
# silently swallowed the day-to-day deployer login path).
# ---------------------------------------------------------------------------
printf 'Scenario 8: bootstrap dev (ships *.pub)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=writable
# Provision two stub pub keys so the bootstrap branch has something to scp.
mkdir -p "$sandbox/deploy/ssh-keys"
printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIStuba1\n' >"$sandbox/deploy/ssh-keys/deployer.pub"
printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIStubai2\n'  >"$sandbox/deploy/ssh-keys/aisztens.pub"

run_deploy bootstrap dev
assert_rc 0 "test8.exit"
assert_out "Shipping deploy/ssh-keys/*.pub" "test8.publishes-the-pub-step"
assert_log "deploy/ssh-keys/deployer.pub" "test8.scps-deployer-pub"
assert_log "deploy/ssh-keys/aisztens.pub" "test8.scps-aisztens-pub"
assert_log_absent "deploy.private.key" "test8.never-scps-the-private-key"
# Assert against the ssh stub's argv log, not stdout: the stub only writes
# argv to STUB_LOG (it's a shim, not a verbose shell). Without this switch
# the assertion can never succeed and test8 silently regresses whenever a
# future change refactors run_remote() (closes the
# 2026-10-08 compose-invisible stray bugfix test gap).
assert_log "sudo bash deploy/bootstrap.sh" "test8.runs-bootstrap-remotely"
unset STUB_PREFLIGHT

# ---------------------------------------------------------------------------
# Scenario 9: a command-line `SSH_USER=root …` MUST override the env file's
# `SSH_USER=deployer` — the bootstrap escape hatch the operator uses once.
# Without the snapshot/restore at deploy/deploy.sh:357, sourcing the env file
# would silently clobber the override and the bootstrap guard would abort
# with "deployer has no passwordless sudo" (the live failure at 01:06).
# ---------------------------------------------------------------------------
printf 'Scenario 9: bootstrap dev with SSH_USER=root on the command line\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=writable

# export SSH_USER=root directly into the subprocess so the override reaches
# deploy.sh via the inherited shell environment (the same path the operator
# uses: `SSH_USER=root ./deploy.sh bootstrap dev`).
SSH_USER=root run_deploy bootstrap dev
assert_rc 0 "test9.exit"
assert_out "SSH_USER=root" "test9.override-wins-over-env-file"

# ---------------------------------------------------------------------------
# Scenario 10: the `up` flow must (a) capture the prune stage in stdout —
# `prune_legacy_stack` used to swallow its own output via `2>/dev/null ||
# true`, so a no-op `down` looked identical to a successful one (the
# 2026-10-08 01:22 regression that hid the compose-invisible monitor stray);
# (b) derive the compose project name from `infra/docker-compose.yml`'s
# `name:` field (single source of truth — the same field the remote `up`
# will use). The `up` run will abort at `verify_up_result` because the
# ssh stubs do not actually start docker compose — that is intended: we
# only care about the early stages here.
# ---------------------------------------------------------------------------
printf 'Scenario 10: up dev (prune stage is captured + project name is read from compose.yml)\n'
: >"$STUB_LOG"
export STUB_PREFLIGHT=writable

run_deploy up dev
# We assert exit != 0 because verify_up_result is expected to fail (the
# stubbed ssh never returns a running container list). What we DO assert is
# that the prune stage surfaced — without the fix it would be silent.
assert_rc 1 "test10.verify-aborts-the-run"
assert_out "[stage=prune_legacy_stack]" "test10.prune-stage-is-captured"
assert_out "Pruning legacy/orphan containers" "test10.prune-banner-is-captured"
assert_out "Compose project name for stray-container guard: aisztens" "test10.project-name-read-from-compose-yml"
assert_out "Expected services: api caddy monitor postgres" "test10.expected-services-all-four"
assert_out "Not running after up" "test10.verify-lists-the-missing-services"

# ---------------------------------------------------------------------------
rm -rf "$sandbox"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
