#!/usr/bin/env bash
# AIsztens — deploy helper (run from YOUR local machine).
#
# Mirrors `.github/workflows/deploy.yml` for operators who do not want to
# use the GitHub Actions path. Both paths now do the SAME thing: ship
# three small files (docker-compose.yml, infra/.env, Caddyfile.rendered)
# to the droplet, then `docker compose pull && up -d`. The droplet never
# builds anything.
#
# Requires: ssh, scp (use Git Bash / WSL on Windows).
#
# HOW TO RUN IT (Windows)
# -----------------------
# Do NOT type `deploy/deploy.sh up` into PowerShell/cmd and do not
# double-click the file. Windows resolves `.sh` through the Git Bash file
# association (`git-bash.exe --no-cd "%L" %*`), which opens a *new, throwaway*
# window and hands bash a backslash Windows path it cannot resolve, e.g.
#   E:projectsAI2026-...-devdeploydeploy.sh: command not found
# The window closes before the message can be read.
#
#   Git Bash / WSL:  ./deploy/deploy.sh up dev
#   PowerShell/cmd:  bash deploy/deploy.sh up dev
#   Windows wrapper: .\deploy\deploy.ps1 up dev
#
# SYNTAX
# ------
#   deploy.sh <command> [dev|prod] [--verbose]
#
# The second argument is the DEPLOY TARGET and selects which environment
# file is loaded:
#
#   dev    -> deploy/.env.dev    (DEFAULT when the argument is omitted)
#   prod   -> deploy/.env.prod
#
# `local` is deliberately NOT a valid target: deploy.sh never deploys to
# a local droplet. The local stack is scripts/dev-stack.sh's job (it
# uses infra/.env.local). Any other value is a usage error (exit code 2).
#
# The selected target also becomes APP_ENV, so the Vite SPA build mode
# (when the same scripts are used to publish images locally) and the
# compose --env-file can never drift from the droplet being targeted.
#
# Commands:
#   up         ship 3 files + `docker compose pull && up -d` (no build)
#   down       stop the stack
#   down-all   DESTRUCTIVE: remove every Docker object on the droplet
#   restart    restart the stack
#   ps         show container status
#   logs       tail logs
#   bootstrap  first-time only: as root, install Docker + users + keys
#   upload     ship 3 files only (without pulling / restarting)
#
# IDENTITY
# --------
# Every command except `bootstrap` logs in as `deployer` (SSH_USER in
# deploy/.env.<target>) — the least-privilege account created by
# deploy/bootstrap.sh. The GitHub Actions workflow uses the same account
# and the same key. `bootstrap` is the single exception: it installs
# packages and creates users, so it needs a root login. Run it once as
# `SSH_USER=root ./deploy/deploy.sh bootstrap`.
#
# Add `--verbose` (or DEPLOY_LOG_LEVEL=DEBUG) for per-command debug
# lines; it may appear anywhere after the command.

# Guard: this file requires bash. Run through `sh`, PowerShell or cmd
# would either die on bash-only syntax or be handed to the `.sh` file
# association, which spawns a window that closes before any output can
# be read.
if [ -z "${BASH_VERSION:-}" ]; then
  echo "[deploy] FATAL: run this script with bash, not sh/PowerShell/cmd." >&2
  echo '[deploy]   Git Bash / WSL: ./deploy/deploy.sh <command>' >&2
  echo '[deploy]   PowerShell/cmd: bash deploy/deploy.sh <command>' >&2
  echo '[deploy]   Windows wrapper: .\deploy\deploy.ps1 <command>' >&2
  exit 1
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Structured logging (deploy/lib/logger.sh).
#
# Sourced *before* anything else can fail, and before the ERR trap below
# is installed, for two reasons:
#   1. the trap calls log_error(), so log() must already exist;
#   2. the capture has to be active before the first guard can abort, so
#      an early failure (missing deploy/.env, …) still leaves a complete
#      log.
# ---------------------------------------------------------------------------
LOGGER_LIB="$SCRIPT_DIR/lib/logger.sh"
if [ ! -f "$LOGGER_LIB" ]; then
  echo "[deploy] FATAL: logger library not found at $LOGGER_LIB" >&2
  exit 1
fi
# shellcheck source=lib/logger.sh disable=SC1091
. "$LOGGER_LIB"
export DEPLOY_LOG_DIR_PARENT="$SCRIPT_DIR"

DEPLOY_START_TS="$(date +%s)"
on_err() {
  local exit_code=$?
  local line=${1:-?}
  log_error "FAILED at line=$line exit=$exit_code after $(( $(date +%s) - DEPLOY_START_TS ))s"
  if [ -n "${SSH_USER:-}" ] && [ -n "${HOST:-}" ] && [ -n "${SSH_CMD[*]:-}" ]; then
    "${SSH_CMD[@]}" "$SSH_USER@$HOST" \
      "cd ${REMOTE_DIR:-/opt/aisztens} 2>/dev/null && \
       docker compose ${COMPOSE_ARGS:-} ps -a 2>/dev/null; \
       docker compose ${COMPOSE_ARGS:-} logs --tail=20 2>/dev/null" \
      >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap 'on_err $LINENO' ERR

# ---------------------------------------------------------------------------
# Argument parsing:  deploy.sh <command> [dev|prod] [--verbose]
#
# This MUST happen before the env file is sourced, because the target
# decides WHICH file is sourced (deploy/.env.dev vs deploy/.env.prod).
# ---------------------------------------------------------------------------
DEPLOY_VALID_ENVS="dev prod"

DEPLOY_CMD="${1:-}"
shift || true

DEPLOY_ENV_ARG=""
DEPLOY_ENV=""
DEPLOY_ENV_SOURCE=""
DEPLOY_VERBOSE_ARG=""
DEPLOY_ARG_ERROR=""
APP_ENV_PREEXISTING="${APP_ENV:-}"

for _arg in "$@"; do
  case "$_arg" in
    -v|--verbose)
      DEPLOY_VERBOSE_ARG="--verbose"
      ;;
    -*)
      DEPLOY_ARG_ERROR="unexpected argument '$_arg'"
      break
      ;;
    *)
      if [ -n "$DEPLOY_ENV_ARG" ]; then
        DEPLOY_ARG_ERROR="two environments given ('$DEPLOY_ENV_ARG' and '$_arg')"
        break
      fi
      DEPLOY_ENV_ARG="$_arg"
      ;;
  esac
done
unset _arg

if [ -n "$DEPLOY_ENV_ARG" ]; then
  DEPLOY_ENV="$DEPLOY_ENV_ARG"
  DEPLOY_ENV_SOURCE="argument"
elif [ -n "$APP_ENV_PREEXISTING" ]; then
  DEPLOY_ENV="$APP_ENV_PREEXISTING"
  DEPLOY_ENV_SOURCE="APP_ENV environment variable"
else
  DEPLOY_ENV="dev"
  DEPLOY_ENV_SOURCE="default"
fi

export APP_ENV="$DEPLOY_ENV"

# shellcheck disable=SC2086  # intentional word-splitting: the arg may be empty
deploy_log_init "${DEPLOY_CMD:-run}-${DEPLOY_ENV}" $DEPLOY_VERBOSE_ARG

print_usage() {
  cat <<'USAGE'
AIsztens deploy helper.

Usage:  ./deploy/deploy.sh <command> [dev|prod] [--verbose]      (Git Bash / WSL)
        bash deploy/deploy.sh <command> [dev|prod] [--verbose]   (PowerShell / cmd)
        .\deploy\deploy.ps1 <command> [dev|prod] [--verbose]     (Windows wrapper)

Commands:
  up         ship 3 files (compose + infra/.env + Caddyfile.rendered) +
              `docker compose pull && up -d` (no build)
  down       stop the stack (volumes are preserved)
  down-all   DESTRUCTIVE: remove every Docker object on the droplet
  restart    restart the stack
  ps         show container status
  logs       tail logs (-f)
  upload     ship the 3 files only, without pulling or restarting
  bootstrap  first-time only: install Docker + users + keys (ROOT login)

Target [dev|prod] selects the environment file AND the APP_ENV used for
infra/.env.<target> and the compose --env-file:

  dev        deploy/.env.dev   (DEFAULT when the argument is omitted)
  prod       deploy/.env.prod

  'local' is not a deploy target: the local stack is started by
  scripts/dev-stack.sh (it uses infra/.env.local).

Login user: SSH_USER from deploy/.env.<target> — `deployer` for every
command except `bootstrap`. The GitHub Actions workflow uses the same
account and the same passphrase-less deploy key.

Every run is logged to deploy/log/deploy-<timestamp>-<command>-<target>.log,
including the output of every subprocess. The newest run is always
deploy/log/latest.log.
USAGE
}

case "$DEPLOY_CMD" in
  help|-h|--help)
    print_usage
    exit 0
    ;;
  "")
    print_usage
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Validate the target, then load the matching environment file.
# ---------------------------------------------------------------------------
if [ -n "$DEPLOY_ARG_ERROR" ]; then
  log_error "usage error: $DEPLOY_ARG_ERROR"
  log_error "Usage: deploy.sh <command> [dev|prod] [--verbose]"
  print_usage >&2
  exit 2
fi

case " $DEPLOY_VALID_ENVS " in
  *" $DEPLOY_ENV "*)
    : # valid target
    ;;
  *)
    log_error "invalid environment '${DEPLOY_ENV}' — valid values are: ${DEPLOY_VALID_ENVS// /, }"
    log_error "It came from the ${DEPLOY_ENV_SOURCE}."
    if [ "$DEPLOY_ENV" = "local" ]; then
      log_error "'local' is not a deploy target: deploy.sh never deploys to a local droplet."
      log_error "The local stack is started by scripts/dev-stack.sh (it uses infra/.env.local)."
    fi
    log_error "Aborted before any upload or remote command was executed."
    exit 2
    ;;
esac

if [ -n "$DEPLOY_ENV_ARG" ] && [ -n "$APP_ENV_PREEXISTING" ] \
   && [ "$APP_ENV_PREEXISTING" != "$DEPLOY_ENV_ARG" ]; then
  log_warn "APP_ENV=$APP_ENV_PREEXISTING was set in the environment, but the command line asked for '$DEPLOY_ENV_ARG' — the command line wins."
fi

DEPLOY_ENV_FILE="$SCRIPT_DIR/.env.${DEPLOY_ENV}"
DEPLOY_ENV_FILE_REL="deploy/.env.${DEPLOY_ENV}"

if [ ! -f "$DEPLOY_ENV_FILE" ]; then
  log_error "environment file not found: $DEPLOY_ENV_FILE_REL"
  if [ -f "$SCRIPT_DIR/.env" ]; then
    log_error "Found the legacy deploy/.env instead — it has been replaced by per-env files."
    log_error "Migration:  mv deploy/.env deploy/.env.dev   (then create deploy/.env.prod for the prod droplet)"
  else
    log_error "Fix: cp deploy/.env.example $DEPLOY_ENV_FILE_REL  then set HOST=<droplet ip or hostname>."
  fi
  log_error "Aborted before any upload or remote command was executed."
  exit 1
fi

log_info "Loading $DEPLOY_ENV_FILE_REL (target '${DEPLOY_ENV}' from ${DEPLOY_ENV_SOURCE}) ..."
_SSH_USER_FROM_ENV="${SSH_USER:-}"
_APP_ENV_FROM_ENV="${APP_ENV:-}"
# shellcheck disable=SC1091
set -a; . "$DEPLOY_ENV_FILE"; set +a
export APP_ENV="$DEPLOY_ENV"
if [ -n "$_SSH_USER_FROM_ENV" ]; then
  export SSH_USER="$_SSH_USER_FROM_ENV"
fi

if [ -z "${HOST:-}" ]; then
  log_error "HOST is not set in $DEPLOY_ENV_FILE_REL — there is nothing to deploy to."
  log_error "Fix: set HOST=<droplet ip or hostname> in $DEPLOY_ENV_FILE_REL (optionally SSH_USER, SSH_KEY)."
  log_error "Aborted before any upload or remote command was executed."
  exit 1
fi
SSH_USER="${SSH_USER:-deployer}"
REMOTE_DIR="${REMOTE_DIR:-/opt/aisztens}"

# DOMAIN/ACME_EMAIL are read the same way for the Caddyfile render below.
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$REPO_DIR/infra/.env.${APP_ENV}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
DOMAIN="${DOMAIN:-localhost}"
ACME_EMAIL="${ACME_EMAIL:-}"
if [ -z "$ACME_EMAIL" ] && [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
  ACME_EMAIL="$(grep -E '^ACME_EMAIL=' "$REPO_DIR/infra/.env.${APP_ENV}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"

# IMAGE_TAG and GHCR_OWNER default to the values the deploy workflow
# writes, but a hand-run deploy may want to pin a specific revision.
IMAGE_TAG="${IMAGE_TAG:-latest}"
GHCR_OWNER="${GHCR_OWNER:-${GITHUB_REPOSITORY_OWNER:-}}"
REGISTRY="${REGISTRY:-ghcr.io}"

# COMPOSE_ARGS runs ON THE DROPLET.
COMPOSE_ARGS="--env-file infra/.env -f infra/docker-compose.yml"

log_info "config: DEPLOY_ENV=$DEPLOY_ENV APP_ENV=$APP_ENV DOMAIN=$DOMAIN REMOTE_DIR=$REMOTE_DIR SSH_USER=$SSH_USER IMAGE_TAG=$IMAGE_TAG GHCR_OWNER=$GHCR_OWNER"
log_debug "compose: docker compose $COMPOSE_ARGS"

SSH_CMD=(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})
SSH=("${SSH_CMD[@]}" "$SSH_USER@$HOST")
SCP=(scp -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})

# ---------------------------------------------------------------------------
# Render the Caddyfile from infra/caddy/Caddyfile (template) into
# infra/caddy/Caddyfile.rendered using the same sed logic as the CI
# deploy workflow. Kept identical so local + CI deploys produce the
# same output.
# ---------------------------------------------------------------------------
render_caddyfile() {
  local template="$REPO_DIR/infra/caddy/Caddyfile"
  local rendered="$REPO_DIR/infra/caddy/Caddyfile.rendered"
  if [ ! -f "$template" ]; then
    log "ERROR: Caddyfile template not found at $template"
    return 1
  fi
  log "Rendering Caddyfile (DOMAIN=$DOMAIN, ACME_EMAIL=$ACME_EMAIL) ..."
  sed -e "s|<DOMAIN>|$DOMAIN|g" \
      -e "s|<ACME_EMAIL>|$ACME_EMAIL|g" \
      "$template" > "$rendered"
  if grep -q '<DOMAIN>\|<ACME_EMAIL>' "$rendered"; then
    log "ERROR: rendered Caddyfile still contains unresolved placeholders"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Preflight: prove we can actually write the deploy tree as the
# configured user BEFORE the first scp starts. The droplet may host a
# different owner if the tree was left by a previous bootstrap.
# ---------------------------------------------------------------------------
assert_remote_ready() {
  log_stage "remote_preflight"
  log "Preflight: checking that $SSH_USER@$HOST can write $REMOTE_DIR ..."
  local probe
  probe="$(
    "${SSH[@]}" 'bash -s' 2>&1 <<REMOTE_PREFLIGHT
set -u
REMOTE_DIR='$REMOTE_DIR'
if [ ! -d "\$REMOTE_DIR" ]; then
  if mkdir -p "\$REMOTE_DIR" 2>/dev/null; then echo DIR_CREATED; else echo MKDIR_FAILED; fi
fi
if [ -d "\$REMOTE_DIR" ]; then
  if touch "\$REMOTE_DIR/.deploy-write-test" 2>/dev/null; then
    rm -f "\$REMOTE_DIR/.deploy-write-test"
    echo WRITABLE
  else
    echo NOT_WRITABLE
  fi
fi
echo "LOGIN_USER=\$(id -un)"
echo "OWNER=\$(stat -c '%U:%G %a' "\$REMOTE_DIR" 2>&1)"
REMOTE_PREFLIGHT
  )" || true
  log_debug "preflight: $(printf '%s' "$probe" | tr '\n' ' ')"
  if ! printf '%s\n' "$probe" | grep -qx 'WRITABLE'; then
    local owner
    owner="$(printf '%s\n' "$probe" | sed -n 's/^OWNER=//p')"
    # Always print what the SSH probe actually produced BEFORE the
    # canned error message. Without this the log only ever says
    # "see above", which is useless when the SSH failure was a
    # connection error (no output at all) and the call site already
    # captured stderr into $probe. log_info (not log_debug) so it
    # always shows up — the operator does not have to remember
    # --verbose to see why the preflight aborted.
    if [ -n "$probe" ]; then
      log_info "preflight probe output:"
      printf '%s\n' "$probe" | sed 's/^/    | /'
    else
      log_info "preflight probe produced no output (ssh client exited before the heredoc could run)."
    fi
    if printf '%s\n' "$probe" | grep -qxE 'MKDIR_FAILED|NOT_WRITABLE'; then
      log_error "$SSH_USER@$HOST cannot write $REMOTE_DIR${owner:+ (owner:group mode = $owner)}"
      log_error "Fix it once, over root SSH:"
      log_error "  ssh -i <deploy key> root@$HOST 'mkdir -p $REMOTE_DIR && chown -R $SSH_USER:$SSH_USER $REMOTE_DIR'"
    elif printf '%s\n' "$probe" | grep -qiE 'too open|bad permissions'; then
      # OpenSSH refuses to use a key when its permissions are "too open"
      # (anything world-readable on Unix). Git Bash on Windows reports
      # 0777 for every file on a drvfs mount, which trips this guard.
      # The fix is to tighten the file ACL, not to chmod.
      log_error "SSH client refused the deploy key: it considers its permissions too open."
      log_error "On Windows (Git Bash + drvfs) the file always reports 0777; tighten the ACL instead:"
      log_error "  icacls deploy\\ssh-keys\\deploy.private.key /inheritance:r /grant:r \"$USER:F\""
      log_error "Then re-run deploy.sh. If the key is on a different path, adjust the path above."
    elif printf '%s\n' "$probe" | grep -qiE 'permission denied'; then
      log_error "SSH client reported 'Permission denied' — either the key is wrong, the key is not authorised for $SSH_USER@$HOST, or the droplet's authorized_keys has rotated."
      log_error "Diagnose by hand:  ssh -v -i <deploy key> $SSH_USER@$HOST 'id; uname -a'"
    elif printf '%s\n' "$probe" | grep -qiE 'host key verification'; then
      log_error "SSH host key verification failed for $HOST. The server's key rotated (or the hostname resolves to a different host now)."
      log_error "If this is expected, remove the stale entry from your known_hosts and re-run; otherwise DO NOT bypass verification."
    else
      log_error "The preflight probe returned nothing usable for $REMOTE_DIR on $HOST."
      log_error "Re-run with --verbose to keep log_debug lines, or run ssh by hand:"
      log_error "  ssh -v -i <deploy key> $SSH_USER@$HOST 'id; uname -a'"
    fi
    log_error "Aborted before any upload or remote command was executed."
    exit 1
  fi
  local owner_user
  owner_user="$(printf '%s\n' "$probe" | sed -n 's/^OWNER=//p' | cut -d: -f1)"
  if [ -n "$owner_user" ] && [ "$owner_user" != "$SSH_USER" ] && [ "$SSH_USER" != "root" ]; then
    log_error "$REMOTE_DIR is owned by '$owner_user', not '$SSH_USER'."
    log_error "Fix it once, over root SSH:"
    log_error "  ssh -i <deploy key> root@$HOST 'chown -R $SSH_USER:$SSH_USER $REMOTE_DIR'"
    log_error "Aborted before any upload or remote command was executed."
    exit 1
  fi
  log "Preflight OK — $REMOTE_DIR is writable by $SSH_USER@$HOST (owner=$owner_user)."
}

# ---------------------------------------------------------------------------
# Ship ONLY the three small files the droplet needs:
#   * infra/docker-compose.yml
#   * infra/.env  (rendered from infra/.env.${APP_ENV} + IMAGE_TAG/GHCR_OWNER)
#   * infra/caddy/Caddyfile.rendered
#
# The droplet no longer receives application source code.
# ---------------------------------------------------------------------------
upload() {
  log_stage "upload_files"
  assert_remote_ready

  log "Rendering Caddyfile ..."
  render_caddyfile

  log "Rendering infra/.env.${APP_ENV} for the droplet (APP_ENV=$APP_ENV) ..."
  local local_infra_env=""
  if [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
    local_infra_env="$REPO_DIR/infra/.env.${APP_ENV}"
  elif [ -f "$REPO_DIR/infra/.env" ]; then
    log "Note: using legacy infra/.env (no infra/.env.${APP_ENV} found); switch to the per-env name to silence it."
    local_infra_env="$REPO_DIR/infra/.env"
  else
    log "ERROR: no infra/.env.${APP_ENV} or infra/.env found (APP_ENV=${APP_ENV}). Copy infra/.env.example to infra/.env.${APP_ENV} and fill it in before deploying."
    return 1
  fi
  # Stage the rendered env in a temp DIRECTORY whose only entry is a
  # file literally named `.env`. scp with multiple source files copies
  # each by its basename into the destination directory, so the
  # droplet sees the three files as `docker-compose.yml`, `.env`, and
  # `Caddyfile.rendered` — the names the downstream `mv` step and the
  # compose --env-file expect. (Earlier revisions used a bare mktemp
  # whose basename was `tmp.XXXXXX`; the mv `.env infra/.env` then
  # failed with `cannot stat '.env'`, which is what the 2026-10-09
  # bootstrap run hit.)
  local rendered_env_dir rendered_env
  rendered_env_dir="$(mktemp -d)"
  rendered_env="$rendered_env_dir/.env"
  # Mirror the deploy workflow: append the runtime values the droplet
  # needs to construct the image references.
  cat "$local_infra_env" > "$rendered_env"
  {
    echo ""
    echo "# Written by deploy.sh"
    echo "APP_ENV=${APP_ENV}"
    echo "IMAGE_TAG=${IMAGE_TAG}"
    echo "GHCR_OWNER=${GHCR_OWNER}"
    echo "REGISTRY=${REGISTRY}"
  } >> "$rendered_env"
  chmod 600 "$rendered_env"

  log "Shipping 3 files to $SSH_USER@$HOST:$REMOTE_DIR ..."
  # Always clean up the temp staging directory, even when the scp / mv
  # chain fails. The trap fires on any exit of the function (return or
  # errexit), so the temp dir cannot leak.
  trap "rm -rf '$rendered_env_dir'" RETURN
  "${SSH[@]}" "mkdir -p $REMOTE_DIR/infra/caddy"
  "${SCP[@]}" \
    "$REPO_DIR/infra/docker-compose.yml" \
    "$rendered_env" \
    "$REPO_DIR/infra/caddy/Caddyfile.rendered" \
    "$SSH_USER@$HOST:$REMOTE_DIR/"
  # scp preserves the basename when the destination is a directory; the
  # droplet's compose file expects files in the same relative paths as
  # the repo layout (infra/docker-compose.yml, infra/.env,
  # infra/caddy/Caddyfile.rendered). Move them into place. The middle
  # source's basename is `.env` because we staged it in a temp dir of
  # its own (see above), so `mv -f .env` finds it.
  "${SSH[@]}" "cd $REMOTE_DIR && \
    mv -f docker-compose.yml infra/docker-compose.yml && \
    mv -f Caddyfile.rendered infra/caddy/Caddyfile.rendered && \
    mv -f .env infra/.env && \
    chmod 600 infra/.env && \
    echo 'files placed'"
  log "Upload complete."
}

# ---------------------------------------------------------------------------
run_remote() {
  "${SSH[@]}" "cd $REMOTE_DIR && $1"
}

# ---------------------------------------------------------------------------
# Ship ONLY the *.pub halves of deploy/ssh-keys/ to the droplet.
# ---------------------------------------------------------------------------
ship_bootstrap_pub_keys() {
  log "Shipping deploy/ssh-keys/*.pub to the droplet ..."
  shopt -s nullglob
  local pub_files
  pub_files=( "$REPO_DIR"/deploy/ssh-keys/*.pub )
  shopt -u nullglob
  if [ "${#pub_files[@]}" -eq 0 ]; then
    log_error "no *.pub files found under deploy/ssh-keys/ — bootstrap cannot install any keys."
    log_error "Fix: copy the public halves (deployer.pub, aisztens.pub, …) into deploy/ssh-keys/ and re-run."
    exit 1
  fi
  "${SSH[@]}" "mkdir -p $REMOTE_DIR/deploy/ssh-keys"
  "${SCP[@]}" "${pub_files[@]}" "$SSH_USER@$HOST:$REMOTE_DIR/deploy/ssh-keys/"
}

# ---------------------------------------------------------------------------
# Post-`up` health gate (mirrors the CI deploy workflow).
# ---------------------------------------------------------------------------
verify_up_result() {
  local compose_args="$1"
  local expected
  expected="$(awk '
    BEGIN { in_services=0; }
    /^services:[[:space:]]*$/ { in_services=1; next }
    in_services && /^volumes:[[:space:]]*$/ { exit }
    in_services && /^networks:[[:space:]]*$/ { exit }
    in_services && /^  [a-zA-Z0-9_.-]+:[[:space:]]*$/ {
      match($0, /  ([a-zA-Z0-9_.-]+):/)
      print substr($0, RSTART+2, RLENGTH-3)
    }
  ' "$REPO_DIR/infra/docker-compose.yml" | sort -u)"
  if [ -z "$expected" ]; then
    log_error "verify_up_result: parsed zero services from infra/docker-compose.yml — refusing to proceed."
    return 1
  fi
  log "Expected services: $(printf '%s ' $expected | sed 's/ $//')"
  local running
  running="$(("${SSH[@]}" "cd '$REMOTE_DIR' && docker compose $compose_args ps --status running --format '{{.Service}}'" || true) | tr '\n' ' ')"
  running="${running% }"
  log "docker compose ps --status running: ${running:-(none)}"
  local missing=""
  local svc
  for svc in $expected; do
    case " $running " in
      *" $svc "*) : ;;
      *) missing="${missing}${missing:+ }$svc" ;;
    esac
  done
  if [ -n "$missing" ]; then
    log_error "Not running after up: $missing"
    return 1
  fi
  log "All expected services are running."
}

# ---------------------------------------------------------------------------
case "$DEPLOY_CMD" in
  upload)
    upload
    ;;
  bootstrap)
    if ! "${SSH[@]}" "sudo -n true" >/dev/null 2>&1; then
      log_error "'bootstrap' must run as root, but $SSH_USER@$HOST has no passwordless sudo."
      log_error "Run it once with the root account:"
      log_error "  SSH_USER=root ./deploy/deploy.sh bootstrap ${DEPLOY_ENV}"
      exit 1
    fi
    upload
    ship_bootstrap_pub_keys
    log "Running bootstrap.sh on the droplet ..."
    run_remote "sudo bash deploy/bootstrap.sh"
    ;;
  down-all)
    log "Tearing down every Docker object on the droplet (DESTRUCTIVE) ..."
    "${SSH[@]}" "
      cd $REMOTE_DIR && \
      docker compose $COMPOSE_ARGS down --remove-orphans 2>/dev/null || true; \
      docker ps -a --format '{{.Names}}' \
        | xargs -r docker rm -f 2>/dev/null || true; \
      docker network ls --format '{{.Name}}' \
        | grep -vE '^(bridge|host|none)$' \
        | xargs -r docker network rm 2>/dev/null || true; \
      docker volume ls --format '{{.Name}}' \
        | xargs -r docker volume rm 2>/dev/null || true
    "
    log "Droplet Docker state cleared. Next: ./deploy.sh up"
    ;;
  up)
    log_stage "up_start"
    upload
    log_stage "compose_pull_up"
    log "Pulling and starting the stack (APP_ENV=${APP_ENV}, IMAGE_TAG=${IMAGE_TAG}) ..."
    run_remote "APP_ENV=${APP_ENV} docker compose $COMPOSE_ARGS pull"
    run_remote "APP_ENV=${APP_ENV} docker compose $COMPOSE_ARGS up -d --remove-orphans"
    log_stage "compose_verify"
    log "Verifying every service is running ..."
    verify_up_result "$COMPOSE_ARGS"
    log_stage "done"
    ;;
  down)
    run_remote "docker compose $COMPOSE_ARGS down"
    ;;
  restart)
    run_remote "docker compose $COMPOSE_ARGS restart"
    ;;
  ps)
    run_remote "docker compose $COMPOSE_ARGS ps"
    ;;
  logs)
    run_remote "docker compose $COMPOSE_ARGS logs -f --tail=200"
    ;;
  *)
    log_error "unknown command '$DEPLOY_CMD'"
    print_usage >&2
    echo "See deploy/log/latest.log for the full log of the last run." >&2
    exit 1
    ;;
esac
