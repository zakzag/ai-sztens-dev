#!/usr/bin/env bash
# AIsztens — deploy helper (run from YOUR local machine).
#
# Requires: ssh, rsync (use Git Bash / WSL on Windows).
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
# The second argument is the DEPLOY TARGET and selects which environment file
# is loaded:
#
#   dev    -> deploy/.env.dev    (DEFAULT when the argument is omitted)
#   prod   -> deploy/.env.prod
#
# `local` is deliberately NOT a valid target: deploy.sh never deploys to a local
# droplet. The local stack is scripts/dev-stack.sh's job (it uses
# infra/.env.local). Any other value is a usage error (exit code 2).
#
# The selected target also becomes APP_ENV, so the SPA build mode,
# infra/.env.${APP_ENV} and the compose --env-file can never drift from the
# droplet being targeted.
#
# Commands:
#   upload     build SPAs locally, then rsync the repo (minus build artifacts)
#              + the two apps/{web,admin}/dist/ folders to the droplet
#   bootstrap  upload + run deploy/bootstrap.sh as ROOT (first time only)
#   up         upload + build & start the Docker stack
#   down       stop the stack
#   down-all   DESTRUCTIVE: remove every Docker object on the droplet
#   restart    restart the stack
#   ps         show container status
#   logs       tail logs
#
# Add `--verbose` (or DEPLOY_LOG_LEVEL=DEBUG) for per-command debug lines; it
# may appear anywhere after the command.
#
# IDENTITY
# --------
# Every command except `bootstrap` logs in as `deployer` (SSH_USER in
# deploy/.env.<target>) — the least-privilege account created by
# deploy/bootstrap.sh — with the passphrase-less deploy key. The GitHub Actions
# workflow uses the same account and the same key, so the two deploy paths are
# interchangeable. `bootstrap` is the single exception: it installs packages and
# creates users, so it needs a root login. Run it once as
# `SSH_USER=root ./deploy/deploy.sh bootstrap`.
#
# The deploy tree (REMOTE_DIR) must be writable by that user; assert_remote_ready()
# proves it before every upload and prints the one-line fix when it is not.
#
# REMOTE PATHS
# ------------
# A droplet hosts exactly ONE environment, so the runtime env file on disk is
# always `infra/.env`; the local per-env SOURCE `infra/.env.<target>` is uploaded
# onto that single path. COMPOSE_ARGS is executed ON THE DROPLET and therefore
# names the REMOTE path — naming the local per-env file there made every remote
# compose call abort with "couldn't find env file: /opt/aisztens/infra/.env.dev".
#
# Configuration is read from deploy/.env.<target> (see deploy/.env.example).
#
# LOGGING
# -------
# Every run is captured by deploy/lib/logger.sh into
# deploy/log/deploy-<timestamp>-<command>-<target>.log, including the output of
# every subprocess. The newest run is always deploy/log/latest.log — read that
# file after a failure; it contains the complete error and the exit code.

# Guard: this file requires bash. Run through `sh`, PowerShell or cmd it would
# either die on bash-only syntax (`set -o pipefail`, arrays) or — worse — be
# handed to the `.sh` file association, which spawns a window that closes
# before the message can be read.
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
# Sourced *before* anything else can fail, and before the ERR trap below is
# installed, for two reasons:
#   1. the trap calls log_error(), so log() must already exist — when the trap
#      was declared above the old local log() definition, any failure in
#      between replaced the real error with `log: command not found`;
#   2. the capture has to be active before the first guard can abort, so an
#      early failure (missing deploy/.env, …) still leaves a complete log.
#
# The module owns `log`, `log_info/warn/error/debug`, `log_stage` and the
# `exec > >(tee -a …)` capture that mirrors every subprocess line into the file.
# ---------------------------------------------------------------------------
LOGGER_LIB="$SCRIPT_DIR/lib/logger.sh"
if [ ! -f "$LOGGER_LIB" ]; then
  echo "[deploy] FATAL: logger library not found at $LOGGER_LIB" >&2
  exit 1
fi
# shellcheck source=lib/logger.sh disable=SC1091
. "$LOGGER_LIB"
# The logger derives the log directory from this, so the files always land in
# deploy/log/ regardless of which directory the operator ran the script from.
export DEPLOY_LOG_DIR_PARENT="$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# M1 (PR #1 of the deploy hardening plan): stage breadcrumbs.
#
# Every abort should tell the operator *which phase* failed and dump a few
# lines of remote context so they do not have to read the script. Stages
# are coarse-grained labels set by log_stage() — which now comes from
# deploy/lib/logger.sh and stamps them into every line as `[stage=…]`.
# The ERR trap fires once on the first non-zero exit (set -e), prints the
# banner, and re-exits with the original failure code.
#
# NOTE: this trap is deliberately declared *after* the logger was sourced
# (see above); on_err() calls log_error(), which would be an undefined
# command otherwise and would mask the real failure.
# ---------------------------------------------------------------------------
DEPLOY_START_TS="$(date +%s)"

on_err() {
  local exit_code=$?
  local line=${1:-?}
  # The `[stage=…]` tag is appended by the logger from its own CURRENT_STAGE,
  # so the breadcrumb no longer has to be tracked (and cannot drift) here.
  log_error "FAILED at line=$line exit=$exit_code after $(( $(date +%s) - DEPLOY_START_TS ))s"
  # Best-effort remote context: only attempt if the ssh array + compose args
  # were already initialised. If we died during init (e.g. set -u on HOST=)
  # those are still unset and expanding them here would mask the real error.
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
# This MUST happen before the env file is sourced, because the target decides
# WHICH file is sourced (deploy/.env.dev vs deploy/.env.prod).
#
# Note: the positional parameters are shifted below, so anything later in this
# script must refer to "$DEPLOY_CMD" rather than "$1".
# ---------------------------------------------------------------------------
DEPLOY_VALID_ENVS="dev prod"

DEPLOY_CMD="${1:-}"
shift || true   # tolerate being called with no argument at all

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
      # An unknown flag: report it verbatim.
      DEPLOY_ARG_ERROR="unexpected argument '$_arg'"
      break
      ;;
    *)
      # Any bare word is a candidate target. It is deliberately NOT validated
      # here: letting the validation further down reject it produces a better
      # message ("invalid environment 'staging' — valid values are: dev, prod")
      # than a generic "unexpected argument", and it names the valid values.
      if [ -n "$DEPLOY_ENV_ARG" ]; then
        DEPLOY_ARG_ERROR="two environments given ('$DEPLOY_ENV_ARG' and '$_arg')"
        break
      fi
      DEPLOY_ENV_ARG="$_arg"
      ;;
  esac
done
unset _arg

# Precedence: positional argument > APP_ENV environment variable > built-in
# default. The argument winning keeps `APP_ENV=dev deploy.sh up prod` honest:
# the droplet named on the command line is the droplet that gets deployed.
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

# Export it before the logger starts, so the log header records the target and
# every child process (pnpm, ssh, docker compose) sees the same value.
export APP_ENV="$DEPLOY_ENV"

# Start the log capture *before* the first guard can abort. Order is the whole
# point: the HOST check below is the most likely early failure, and a run that
# dies before deploy_log_init() leaves no artefact to inspect — which is
# exactly how "deploy.sh just closes the window and shows nothing" became
# undebuggable. `--verbose`/DEPLOY_LOG_LEVEL=DEBUG also keeps log_debug lines.
# The target goes into the file name so `ls deploy/log/` distinguishes a dev run
# from a prod run.
# shellcheck disable=SC2086  # intentional word-splitting: the arg may be empty
deploy_log_init "${DEPLOY_CMD:-run}-${DEPLOY_ENV}" $DEPLOY_VERBOSE_ARG

# Usage has to be reachable *before* the HOST guard below: the command list is
# exactly what an operator needs when deploy/.env is missing or still has an
# empty HOST=, and `deploy.sh help` must not fail merely because no droplet is
# configured yet. (Before this, help/usage was only handled at the very end of
# the script — after the guard — so it was unreachable without a filled .env.)
print_usage() {
  cat <<'USAGE'
AIsztens deploy helper.

Usage:  ./deploy/deploy.sh <command> [dev|prod] [--verbose]      (Git Bash / WSL)
        bash deploy/deploy.sh <command> [dev|prod] [--verbose]   (PowerShell / cmd)
        .\deploy\deploy.ps1 <command> [dev|prod] [--verbose]     (Windows wrapper)

Commands:
  upload     build the SPAs locally + rsync the repo and the SPA bundles
  bootstrap  upload + run deploy/bootstrap.sh as root (FIRST TIME ONLY:
             needs a root login — pass SSH_USER=root for this one run)
  up         upload + build & start the Docker stack
  down       stop the stack (volumes are preserved)
  down-all   DESTRUCTIVE: remove every Docker object on the droplet
  restart    restart the stack
  ps         show container status
  logs       tail logs (-f)

Target [dev|prod] selects the environment file AND the APP_ENV used for
infra/.env.<target>, the SPA build mode and the compose --env-file:

  dev        deploy/.env.dev   (DEFAULT when the argument is omitted)
  prod       deploy/.env.prod

  'local' is not a deploy target: the local stack is started by
  scripts/dev-stack.sh (it uses infra/.env.local).

Login user: SSH_USER from deploy/.env.<target> — `deployer` for every command
except `bootstrap`. The GitHub Actions workflow uses the same account and the
same passphrase-less deploy key.

On the droplet the runtime env file is always infra/.env (one environment per
droplet); the local per-env file infra/.env.<target> is the source that gets
uploaded onto it.

Every run is logged to deploy/log/deploy-<timestamp>-<command>-<target>.log,
including the output of every subprocess. The newest run is always
deploy/log/latest.log — read that file after a failure; it contains the error
and the exit code.
USAGE
}

case "$DEPLOY_CMD" in
  help|-h|--help)
    print_usage
    exit 0
    ;;
  "")
    # No command at all: the usage text is more useful than the HOST error.
    print_usage
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Validate the target, then load the matching environment file.
#
# Validation runs *after* deploy_log_init on purpose: the rejection is printed
# AND captured in deploy/log/, because a run with a mistyped target is still a
# run worth being able to look up afterwards.
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

# Tell the operator when the command line overrode a pre-existing APP_ENV
# instead of silently ignoring it: a mismatch here is how you end up deploying
# the dev bundle to the prod droplet.
if [ -n "$DEPLOY_ENV_ARG" ] && [ -n "$APP_ENV_PREEXISTING" ] \
   && [ "$APP_ENV_PREEXISTING" != "$DEPLOY_ENV_ARG" ]; then
  log_warn "APP_ENV=$APP_ENV_PREEXISTING was set in the environment, but the command line asked for '$DEPLOY_ENV_ARG' — the command line wins."
fi

DEPLOY_ENV_FILE="$SCRIPT_DIR/.env.${DEPLOY_ENV}"
DEPLOY_ENV_FILE_REL="deploy/.env.${DEPLOY_ENV}"

if [ ! -f "$DEPLOY_ENV_FILE" ]; then
  log_error "environment file not found: $DEPLOY_ENV_FILE_REL"
  if [ -f "$SCRIPT_DIR/.env" ]; then
    # Migration path (D1: no silent fallback — a fallback can deploy to the
    # wrong droplet, which is worse than an abort).
    log_error "Found the legacy deploy/.env instead — it has been replaced by per-env files."
    log_error "Migration:  mv deploy/.env deploy/.env.dev   (then create deploy/.env.prod for the prod droplet)"
  else
    log_error "Fix: cp deploy/.env.example $DEPLOY_ENV_FILE_REL  then set HOST=<droplet ip or hostname>."
  fi
  log_error "Aborted before any upload or remote command was executed."
  exit 1
fi

log_info "Loading $DEPLOY_ENV_FILE_REL (target '${DEPLOY_ENV}' from ${DEPLOY_ENV_SOURCE}) ..."
# Snapshot the values an operator may have set on the command line BEFORE the
# env file is sourced. `set -a; . "$file"; set +a` re-exports every variable
# the file assigns, which silently overrides anything inherited from the shell
# (e.g. `SSH_USER=root ./deploy.sh bootstrap`). The bootstrap command's
# documented escape hatch (`SSH_USER=root ./deploy.sh bootstrap dev`) must
# actually work, otherwise the operator is forced to edit deploy/.env.<target>
# — a trap that bit this exact session (see 2026-10-08--01-03-30 narrative).
# APP_ENV is handled the same way below.
_SSH_USER_FROM_ENV="${SSH_USER:-}"
_APP_ENV_FROM_ENV="${APP_ENV:-}"
# shellcheck disable=SC1091
set -a; . "$DEPLOY_ENV_FILE"; set +a

# Re-assert APP_ENV and SSH_USER after sourcing: neither the env file nor the
# inherited environment may override the selected target, because APP_ENV is
# what picks infra/.env.${APP_ENV} and the SPA build mode. A mismatch there is
# the one failure mode that pushes dev artefacts at a prod droplet. SSH_USER
# is given the same treatment so a deliberate `SSH_USER=root … bootstrap`
# override actually wins.
# environment may override the selected target, because APP_ENV is what picks
# infra/.env.${APP_ENV} and the SPA build mode. A mismatch there is the one
# failure mode that pushes dev artefacts at a prod droplet.
export APP_ENV="$DEPLOY_ENV"
# A command-line `SSH_USER=root …` MUST win, otherwise the documented
# bootstrap escape hatch is a lie. The env file's value is used only when
# the operator did not pass one.
if [ -n "$_SSH_USER_FROM_ENV" ]; then
  export SSH_USER="$_SSH_USER_FROM_ENV"
fi

# HOST is the one value with no sensible default. Fail loudly *and through the
# logger* instead of the bare `${HOST:?}` guard: bash exits on that expansion
# before the ERR trap can run, so the operator got no stage banner, no log file
# and no hint about which value was missing.
if [ -z "${HOST:-}" ]; then
  log_error "HOST is not set in $DEPLOY_ENV_FILE_REL — there is nothing to deploy to."
  log_error "Fix: set HOST=<droplet ip or hostname> in $DEPLOY_ENV_FILE_REL (optionally SSH_USER, SSH_KEY)."
  log_error "Aborted before any upload or remote command was executed."
  exit 1
fi
# `deployer` is the intended identity for every command — the same account the
# GitHub Actions workflow uses. `root` is only needed for the one-off
# `bootstrap` (see the IDENTITY block in the file header), which is why this
# default is not `root`: an env file that omits SSH_USER must not silently
# deploy as the superuser.
SSH_USER="${SSH_USER:-deployer}"
REMOTE_DIR="${REMOTE_DIR:-/opt/aisztens}"

# APP_ENV was already resolved from the deploy target in the argument-parsing
# block above (argument > APP_ENV env var > dev) and re-asserted after the env
# file was sourced — do NOT re-default it here, or a `prod` target could be
# silently downgraded to `dev`. It selects which per-env file NestJS / Vite /
# the docker compose `api` service load; the values are normalised in
# `apps/api/src/config/app-env.ts`, and the droplet's compose
# `environment:` block receives `APP_ENV=${APP_ENV}` (declared in
# infra/docker-compose.yml).
#
#   dev   → the existing dev droplet (default).
#   prod  → a future prod droplet; the deploy.yml workflow matrix uses
#           `INFRA_ENV_PROD` for that.
#
# `local` is intentionally unreachable from here — see scripts/dev-stack.sh.
#
# SPA build mode follows APP_ENV by default; operators can override with
# `SPA_BUILD_MODE=prod` for a one-off dev build of the prod bundle.
SPA_BUILD_MODE="${SPA_BUILD_MODE:-${APP_ENV}}"

# Used by build_spas() to compute the production API base URL the SPAs are
# built against. Falls back to localhost for dry runs / local builds. The
# source of truth for the apex domain is infra/.env.${APP_ENV} (the new
# per-env layout); we fall back to legacy infra/.env for the dev droplet
# that pre-dates the three-env separation plan.
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$REPO_DIR/infra/.env.${APP_ENV}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "$DOMAIN" ] && [ -f "$REPO_DIR/infra/.env" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$REPO_DIR/infra/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
DOMAIN="${DOMAIN:-localhost}"

# ACME_EMAIL is read the same way (defaults to nothing, which would make
# Caddy fall back to its own placeholder — let's be explicit instead).
ACME_EMAIL="${ACME_EMAIL:-}"
if [ -z "$ACME_EMAIL" ] && [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
  ACME_EMAIL="$(grep -E '^ACME_EMAIL=' "$REPO_DIR/infra/.env.${APP_ENV}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "$ACME_EMAIL" ] && [ -f "$REPO_DIR/infra/.env" ]; then
  ACME_EMAIL="$(grep -E '^ACME_EMAIL=' "$REPO_DIR/infra/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"

# ---------------------------------------------------------------------------
# Two different paths, and mixing them up breaks EVERY remote command:
#
#   * the LOCAL SOURCE is per-env (`infra/.env.${APP_ENV}`, falling back to the
#     legacy `infra/.env` for a checkout that pre-dates the per-env rename). It
#     is what upload() copies to the droplet, see docs/history/2026-10-05--
#     10-30-00-three-env-separation-step0.md.
#   * the REMOTE PATH is a single `infra/.env`, because a droplet hosts exactly
#     one environment. That is the documented contract
#     (docs/Specs/Three-Env-Verification.md §3.8) and what every other consumer
#     already assumes (scripts/test/stack-smoke.sh, scripts/env-test/
#     check-env-live.sh, deploy/README.md §3).
#
# COMPOSE_ARGS runs ON THE DROPLET (prune_legacy_stack, the command dispatch and
# the ERR trap), so it must name the REMOTE path. Naming the local per-env file
# there made `ps`, `logs`, `up`, `down` and `restart` all abort with
# `couldn't find env file: /opt/aisztens/infra/.env.dev`.
# ---------------------------------------------------------------------------
COMPOSE_ENV_FILE_LOCAL="infra/.env.${APP_ENV}"
if [ ! -f "$REPO_DIR/$COMPOSE_ENV_FILE_LOCAL" ]; then
  COMPOSE_ENV_FILE_LOCAL="infra/.env"
fi
COMPOSE_ENV_FILE_REMOTE="infra/.env"
COMPOSE_ARGS="--env-file ${COMPOSE_ENV_FILE_REMOTE} -f infra/docker-compose.yml"

# Record the resolved (non-secret) configuration in the log, so any run can be
# reproduced from the artefact alone. Values only, names only — never SSH_KEY
# and never anything out of infra/.env.
log_info "config: DEPLOY_ENV=$DEPLOY_ENV env_file=$DEPLOY_ENV_FILE_REL APP_ENV=$APP_ENV SPA_BUILD_MODE=$SPA_BUILD_MODE DOMAIN=$DOMAIN REMOTE_DIR=$REMOTE_DIR SSH_USER=$SSH_USER"
log_debug "compose: docker compose $COMPOSE_ARGS"
log_debug "env file: local source $COMPOSE_ENV_FILE_LOCAL -> remote $COMPOSE_ENV_FILE_REMOTE (APP_ENV=$APP_ENV)"

# rsync's `-e` only accepts the remote shell command + its options (NOT the
# destination host), so keep the ssh command separate from the `user@host`
# pair. Otherwise rsync appends the host itself and the remote shell ends up
# running `user@host <host>` — surfacing as
# `bash: line 1: <host>: command not found`.
SSH_CMD=(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})
SSH=("${SSH_CMD[@]}" "$SSH_USER@$HOST")
SCP=(scp -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes ${SSH_KEY:+-i "$SSH_KEY"})

# NOTE: `log`, `log_info`, `log_warn`, `log_error`, `log_debug` and
# `log_stage` are provided by deploy/lib/logger.sh, sourced at the top of this
# script. The former `log() { echo "[deploy] $*"; }` used to live here.

# ---------------------------------------------------------------------------
# Ensure the per-env SPA file exists for the current build mode, seeding it
# from the resolved `DOMAIN` when missing. Without this guard, a fresh
# droplet (which only has `.env.example` rsynced) would fail
# `pnpm ... build:dev` because `apps/<app>/.env.dev` is not tracked in
# the repo (it is gitignored, by design — see `.gitignore:58`).
#
# After the first run, the per-env file lives on the build host and the
# operator can hand-edit it for any future override. Subsequent deploys
# do NOT overwrite an existing file — they only seed the first time.
ensure_spa_env() {
  # NOTE: one declaration per line on purpose. `local a="$1" b="$a"` does NOT
  # work: bash expands every word of the command before the builtin runs, so
  # `$a` is still unset at expansion time and `set -u` aborts the whole script
  # with "a: unbound variable". Declaring the names first means each later
  # assignment sees the value assigned by the previous one.
  local app="$1"
  local mode="$2"
  local env_file="$REPO_DIR/apps/$app/.env.$mode"
  if [ -f "$env_file" ]; then
    return 0
  fi
  log "Seeding apps/$app/.env.$mode (DOMAIN=$DOMAIN) ..."
  case "$app" in
    web|admin)
      printf 'VITE_API_BASE_URL=https://api.%s/api\n' "$DOMAIN" > "$env_file"
      ;;
    *)
      log "ERROR: ensure_spa_env called with unknown app '$app'"
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Build the two SPAs (apps/web, apps/admin) into apps/*/dist/.
#
# Vite resolves `import.meta.env.VITE_API_BASE_URL` at build time. The
# value comes from per-env files (apps/<app>/.env.local / .env.dev /
# .env.prod) selected by the `--mode` flag passed to `vite build`. Today
# we always build for the dev droplet, so we pass `--mode dev`, which
# makes Vite pick up `apps/<app>/.env.dev` (see the three-env separation
# plan in docs/history/2026-10-05--10-30-00-three-env-separation-plan.md).
# Future prod deploys will pass `--mode prod`.
#
# Previously this function injected the API URL inline via `VITE_API_BASE_URL=`
# in front of the pnpm call. That bypassed the per-env file layout, made
# the deploy script the source of truth for the production URL, and silently
# overrode anything developers had set locally. The new `--mode dev` flow
# keeps the deploy script honest and makes the SPA env files the single
# source of truth for the built-in API URL.
build_spas() {
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found on PATH; skipping SPA build. Install pnpm or run the build manually."
    return 0
  fi
  local build_mode="${SPA_BUILD_MODE:-dev}"
  ensure_spa_env web  "$build_mode"
  ensure_spa_env admin "$build_mode"
  log "Installing workspace dependencies ..."
  (cd "$REPO_DIR" && pnpm install --frozen-lockfile)
  log "Building @callback/web (mode=$build_mode) ..."
  (cd "$REPO_DIR" && pnpm --filter @callback/web "build:${build_mode}")
  log "Building @callback/admin (mode=$build_mode) ..."
  (cd "$REPO_DIR" && pnpm --filter @callback/admin "build:${build_mode}")
}

# ---------------------------------------------------------------------------
# Push only the freshly built apps/{web,admin}/dist/ folders to the droplet.
# The main rsync in upload() keeps `--exclude 'dist'` so no stale build
# artifacts leak into the repo upload; we explicitly re-include just the
# two SPA bundles Caddy mounts.
upload_dists() {
  for app in web admin; do
    local src="$REPO_DIR/apps/$app/dist"
    if [ ! -d "$src" ]; then
      log "Skipping $app dist (not built: $src)"
      continue
    fi
    log "Uploading $app dist -> $SSH_USER@$HOST:$REMOTE_DIR/apps/$app/dist ..."
    "${SSH[@]}" "mkdir -p $REMOTE_DIR/apps/$app/dist"
    rsync -az --delete -e "${SSH_CMD[*]}" \
      "$src/" "$SSH_USER@$HOST:$REMOTE_DIR/apps/$app/dist/"
  done
}

# ---------------------------------------------------------------------------
# Render infra/caddy/Caddyfile (template) → infra/caddy/Caddyfile.rendered
# (real config consumed by the Caddy container). Substitutes <DOMAIN> and
# <ACME_EMAIL> placeholders with the values resolved above. Must be called
# *after* upload() puts the template on the droplet, otherwise sed has no
# input to operate on. Idempotent.
#
# IMPORTANT: keep the placeholder tokens (`<DOMAIN>`, `<ACME_EMAIL>`) in
# sync with infra/caddy/Caddyfile. If a future change introduces a new
# env-driven value in the Caddyfile, add a corresponding `sed -i` line here.
render_caddyfile() {
  local template="$REPO_DIR/infra/caddy/Caddyfile"
  local rendered="$REPO_DIR/infra/caddy/Caddyfile.rendered"

  if [ ! -f "$template" ]; then
    log "ERROR: Caddyfile template not found at $template"
    return 1
  fi

  log "Rendering Caddyfile (DOMAIN=$DOMAIN, ACME_EMAIL=$ACME_EMAIL) ..."
  # Use a delimiter that does not appear in either the placeholders or the
  # substitution values. `|` is safe here because neither DOMAIN nor
  # ACME_EMAIL typically contain it.
  sed -e "s|<DOMAIN>|$DOMAIN|g" \
      -e "s|<ACME_EMAIL>|$ACME_EMAIL|g" \
      "$template" > "$rendered"

  # Quick sanity check: rendered file must not still contain placeholders,
  # otherwise the Caddy container would see `api.<DOMAIN>` and fail again.
  if grep -q '<DOMAIN>\|<ACME_EMAIL>' "$rendered"; then
    log "ERROR: rendered Caddyfile still contains unresolved placeholders"
    return 1
  fi

  # Ship it to the droplet so docker compose picks it up on next `up`.
  log "Uploading rendered Caddyfile -> $SSH_USER@$HOST:$REMOTE_DIR/infra/caddy/Caddyfile.rendered"
  "${SCP[@]}" "$rendered" "$SSH_USER@$HOST:$REMOTE_DIR/infra/caddy/Caddyfile.rendered"
}

# ---------------------------------------------------------------------------
# Preflight: prove we can actually write the deploy tree as the configured user
# BEFORE the first rsync starts.
#
# Why: upload() is an rsync with `--delete` into REMOTE_DIR. When the login user
# cannot write that directory the run dies inside rsync with a wall of
# "Permission denied" lines that never names the cause or the fix — a tree owned
# by another account costs an afternoon exactly that way.
#
# One round trip answers four questions: does the directory exist, can it be
# created, is it writable by the login user, and who owns it. Nothing secret is
# read, and the only file touched is a dotfile of our own making, removed again.
# ---------------------------------------------------------------------------
assert_remote_ready() {
  log_stage "remote_preflight"
  log "Preflight: checking that $SSH_USER@$HOST can write $REMOTE_DIR ..."

  # The heredoc is deliberately unquoted so $REMOTE_DIR expands locally; every
  # command that must run on the REMOTE host is escaped (\$(...)) so it is not
  # evaluated here.
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

  # PASS only on an explicit WRITABLE marker. A failed SSH connection (bad key
  # permissions, DNS, authentication) produces no marker at all — and treating
  # "no evidence of failure" as success would turn this guard into a silent
  # no-op. That is not hypothetical: the first live run under WSL reported
  # "Preflight OK" for a directory the user cannot write, because the key was
  # refused before the probe ever ran.
  #
  # The marker check comes FIRST, before any textual hint: a plain
  # `stat` on an unreadable path also prints "Permission denied", and matching
  # that as a connection error sent the operator after the wrong problem.
  if ! printf '%s\n' "$probe" | grep -qx 'WRITABLE'; then
    local owner
    owner="$(printf '%s\n' "$probe" | sed -n 's/^OWNER=//p')"
    if printf '%s\n' "$probe" | grep -qxE 'MKDIR_FAILED|NOT_WRITABLE'; then
      log_error "$SSH_USER@$HOST cannot write $REMOTE_DIR${owner:+ (owner:group mode = $owner)}"
      log_error "Fix it once, over root SSH:"
      log_error "  ssh -i <deploy key> root@$HOST 'mkdir -p $REMOTE_DIR && chown -R $SSH_USER:$SSH_USER $REMOTE_DIR'"
    elif printf '%s\n' "$probe" | grep -qiE 'too open|bad permissions|permission denied|host key verification'; then
      log_error "The preflight probe never ran on $HOST — the SSH client refused the key or the login (see above)."
      log_error "On Windows/WSL 'Permissions 0777 ... are too open' means the private key's ACL is wrong:"
      log_error "  * run this script from Git Bash, not from WSL (in WSL the /mnt/c..e drvfs always reports 0777), and"
      log_error "  * tighten the file with  icacls deploy\\ssh-keys\\deploy.private.key /inheritance:r /grant:r \"<you>:F\""
    else
      log_error "The preflight probe returned nothing usable for $REMOTE_DIR on $HOST."
      log_error "Check the remote directory by hand, then re-run:"
      log_error "  ssh -i <deploy key> $SSH_USER@$HOST 'id -un; ls -ld $REMOTE_DIR'"
    fi
    log_error "Aborted before any upload or remote command was executed."
    exit 1
  fi

  # Ownership check: rsync -a implies -t/-p, both of which require ownership
  # (or CAP_FOWNER). A root-owned 777 tree passes the touch/rm probe above,
  # but then the upload dies with `failed to set times ... Operation not
  # permitted` (exit 23). Compare the owner we already collected against the
  # login user and fail with the same one-line chown the bootstrap branch
  # already runs, so the operator never has to remember it.
  local owner_user
  owner_user="$(printf '%s\n' "$probe" | sed -n 's/^OWNER=//p' | cut -d: -f1)"
  if [ -n "$owner_user" ] && [ "$owner_user" != "$SSH_USER" ] && [ "$SSH_USER" != "root" ]; then
    log_error "$REMOTE_DIR is owned by '$owner_user', not '$SSH_USER'."
    log_error "rsync -a will die with 'failed to set times' on every directory (needs ownership for -t/-p)."
    log_error "Fix it once, over root SSH:"
    log_error "  ssh -i <deploy key> root@$HOST 'chown -R $SSH_USER:$SSH_USER $REMOTE_DIR'"
    log_error "Aborted before any upload or remote command was executed."
    exit 1
  fi

  log "Preflight OK — $REMOTE_DIR is writable by $SSH_USER@$HOST (owner=$owner_user)."
}

# ---------------------------------------------------------------------------
upload() {
  log_stage "upload_rsync"
  assert_remote_ready
  log "Uploading $REPO_DIR -> $SSH_USER@$HOST:$REMOTE_DIR ..."
  "${SSH[@]}" "mkdir -p $REMOTE_DIR"
  rsync -az --delete -e "${SSH_CMD[*]}" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'deploy/.env' \
    --exclude 'deploy/.env.dev' \
    --exclude 'deploy/.env.prod' \
    --exclude 'deploy/.env.local' \
    --exclude 'infra/.env' \
    --exclude 'infra/caddy/Caddyfile.rendered' \
    --exclude 'deploy/ssh-keys/' \
    "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"
  # Ship the SELECTED env file (deploy/.env.<target>) on top; the rsync above
  # excludes both the legacy and the per-env deploy env files because they are
  # gitignored and hold the operator's droplet address and SSH key path.
  # The destination stays `deploy/.env` on the droplet: a droplet is a single
  # environment, and that path is the documented contract there.
  log "Shipping $DEPLOY_ENV_FILE_REL on the droplet ..."
  "${SCP[@]}" "$DEPLOY_ENV_FILE" "$SSH_USER@$HOST:$REMOTE_DIR/deploy/.env"
  # Pick exactly one local copy of infra/.env.${APP_ENV} (preferred; new
  # per-env layout from the three-env separation plan) and fall back to the
  # legacy `infra/.env` path so a droplet that pre-dates the rename still
  # gets the correct file. Refuse to proceed if neither exists.
  local local_infra_env=""
  if [ -f "$REPO_DIR/infra/.env.${APP_ENV}" ]; then
    local_infra_env="$REPO_DIR/infra/.env.${APP_ENV}"
  elif [ -f "$REPO_DIR/infra/.env" ]; then
    log "Note: using legacy infra/.env (no infra/.env.${APP_ENV} found); switch to the per-env name to silence it."
    local_infra_env="$REPO_DIR/infra/.env"
  elif [ -f "$REPO_DIR/../infra/.env" ]; then
    local_infra_env="$REPO_DIR/../infra/.env"
  else
    log "ERROR: no infra/.env.${APP_ENV} or infra/.env found (APP_ENV=${APP_ENV}). Copy infra/.env.example to infra/.env.${APP_ENV} and fill it in before deploying."
    return 1
  fi
  log "Rendering infra/.env on the droplet (source: $local_infra_env) ..."
  "${SCP[@]}" "$local_infra_env" "$SSH_USER@$HOST:$REMOTE_DIR/infra/.env"
  # Build the SPAs locally and ship only the two dist/ folders. The main
  # rsync above excludes dist/ on purpose; this is the single source of
  # truth for what the Caddy container ends up serving.
  build_spas
  upload_dists
  # Render + ship the Caddyfile so the running container sees the real
  # domain (not the template's <DOMAIN> placeholder).
  render_caddyfile
  log "Upload complete."
}

# ---------------------------------------------------------------------------
run_remote() {
  "${SSH[@]}" "cd $REMOTE_DIR && $1"
}

# ---------------------------------------------------------------------------
# Ship ONLY the public halves of the deploy/ssh-keys/ directory to the
# droplet. Called by the bootstrap branch — bootstrap.sh reads each user's
# authorized_keys from $KEYS_DIR/$user.pub on the droplet, and that directory
# is rsync-excluded to keep the private key out of the upload (see
# deploy/deploy.sh:685). Refuses to proceed when no *.pub is present locally,
# so bootstrap cannot silently exit 0 with no keys installed.
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
# Prune orphaned containers, networks and volumes from previous deployments
# that are no longer managed by the current `docker-compose.yml`. This is the
# safety net that prevents the "two Caddy containers fight over 80/443"
# regression: every historical compose project that ever bound port 80/443
# MUST be removed before `up` runs, otherwise the new Caddy exits 128 with
# `port is already allocated` and the site goes dark.
#
# Strategy:
#   1. `docker compose down --remove-orphans` for the CURRENT project
#      (`aisztens`) — clean stop.
#   2. `docker ps -a --filter ...` for the few well-known historical project
#      names that have lived on this droplet (added one-by-one as we find
#      them, e.g. `callback-assistant`) and `docker rm -f` them.
#   3. `docker network rm` for any orphan bridge networks that were created
#      by those projects and are now empty.
#
# `|| true` everywhere so the script still succeeds if nothing is left to
# clean up — this function is safe to call on a fresh droplet.
# Resolve the compose project name the SAME WAY the live `up` run will. The
# `name:` field in infra/docker-compose.yml is the single source of truth; we
# fall back to a directory-derived name only if it is absent (so older layouts
# keep working). Centralised because the stray-container guard below needs it.
_resolve_compose_project_name() {
  local project_name=""
  local compose_file="$REPO_DIR/infra/docker-compose.yml"
  if [ -f "$compose_file" ]; then
    # `name:` is a top-level scalar. Grep the first match, strip quotes/whitespace.
    project_name="$(grep -E '^[[:space:]]*name[[:space:]]*:' "$compose_file" \
      | head -n1 | sed -E 's/^[[:space:]]*name[[:space:]]*:[[:space:]]*//' \
      | tr -d '"' | tr -d "'" | tr -d ' ' )"
  fi
  if [ -z "$project_name" ]; then
    project_name="$(basename -- "$(cd "$REPO_DIR/infra" 2>/dev/null && pwd || echo "$REPO_DIR/infra")")"
  fi
  printf '%s' "$project_name"
}

prune_legacy_stack() {
  log_stage "prune_legacy_stack"
  log "Pruning legacy/orphan containers on the droplet ..."

  # Resolve the compose project name once and ship it to the remote. Without
  # this, the stray-container guard below would have to re-parse
  # infra/docker-compose.yml on the droplet — pointless given we already have
  # the same tree locally.
  local project_name
  project_name="$(_resolve_compose_project_name)"
  log "Compose project name for stray-container guard: $project_name"

  # NB: the `down` step is intentionally NOT silent any more. Hiding its
  # output (`2>/dev/null || true` in the old script) is exactly how the
  # 2026-10-07 22:24 / 2026-10-08 01:22 strays went undiagnosed: a no-op
  # down looked identical to a successful one. Stream the down to the log
  # (INFO), capture stdout AND stderr, and tolerate non-zero exit so the
  # guard below can still run.
  #
  # Args travel as env vars set on the REMOTE command line, NOT as
  # positional `bash -s -- "$1" "$2" "$3"`:
  #   - SSH word-splits the remote argv on whitespace, so a multi-word
  #     value like `--env-file infra/.env -f infra/docker-compose.yml`
  #     would arrive split into separate positionals (the 01:38 live run
  #     logged `--env-file down` because `infra/.env` was `$3`, not part
  #     of `--env-file …`).
  #   - SSH does NOT forward arbitrary local env vars to the remote
  #     shell by default (only those whitelisted via SendEnv/AcceptEnv),
  #     so prefixing the ssh argv with `VAR=…` is the only safe way
  #     to hand structured data to the heredoc.
  # Use `printf %q` so each value is re-quoted for the remote shell:
  # COMPOSE_ARGS contains spaces and single quotes can appear in user
  # paths. %q produces a single-token shell-quoted form that round-trips
  # through ssh's argv intact.
  local remote_cmd
  remote_cmd="$(printf 'REMOTE_PRUNE_REMOTE_DIR=%q REMOTE_PRUNE_COMPOSE_ARGS=%q REMOTE_PRUNE_PROJECT_NAME=%q bash -s' \
    "$REMOTE_DIR" "$COMPOSE_ARGS" "$project_name")"
  "${SSH[@]}" "$remote_cmd" <<'REMOTE_PRUNE' || true
set -u
# Args came in via env vars (see the comment above the ssh call): SSH
# word-splits positional argv on whitespace, so a multi-word value would
# arrive broken. Env vars survive the round trip intact.
REMOTE_DIR="${REMOTE_PRUNE_REMOTE_DIR:?}"
COMPOSE_ARGS="${REMOTE_PRUNE_COMPOSE_ARGS:-}"
PROJECT_NAME="${REMOTE_PRUNE_PROJECT_NAME:?}"
cd "$REMOTE_DIR" || exit 0
echo "[prune_legacy_stack] docker compose $COMPOSE_ARGS down --remove-orphans"
docker compose $COMPOSE_ARGS down --remove-orphans
echo "[prune_legacy_stack] down exit=$?"
echo "[prune_legacy_stack] removing known legacy containers (callback-assistant-*, aisztens-legacy-*, old-stack-*)"
docker ps -a --format '{{.Names}}' \
  | grep -E '^(callback-assistant-|aisztens-legacy-|old-stack-)' \
  | xargs -r docker rm -f || true
echo "[prune_legacy_stack] removing legacy networks (callback-assistant_*, aisztens-legacy_*)"
docker network ls --format '{{.Name}}' \
  | grep -E '^(callback-assistant_|aisztens-legacy_)' \
  | xargs -r docker network rm || true
echo "[prune_legacy_stack] removing legacy volumes (callback-assistant_*, aisztens-legacy_*)"
docker volume ls --format '{{.Name}}' \
  | grep -E '^(callback-assistant_|aisztens-legacy_)' \
  | xargs -r docker volume rm || true
echo "[prune_legacy_stack] scanning for compose-INVISIBLE strays (project=$PROJECT_NAME)"
# A stray is any container whose name matches the compose-managed pattern
# `<project>-<service>-<index>` but which lacks the
# `com.docker.compose.oneoff=False` label — meaning compose's project
# container lookup (`docker compose ps`) cannot see it. `docker compose
# down --remove-orphans` therefore leaves it behind and the next `up` collides
# on the name (this is the 2026-10-08 01:22 aisztens-monitor-1 bug).
stray_names=""
# `docker ps --format` joins fields with tabs (not \t escapes) and `Label
# "key"` prints the literal string `map["key"]` when the label is absent,
# so filter that sentinel out before the project-name check.
docker ps -a --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.oneoff"}}' \
  | awk -F '\t' -v proj="$PROJECT_NAME" '
      $1 == ""               { next }                       # skip empty rows
      $2 == proj && $3 != "False" { printf "%s\n", $1 }
    ' > /tmp/.prune_legacy_strays.$$.list
stray_names="$(cat /tmp/.prune_legacy_strays.$$.list)"
rm -f /tmp/.prune_legacy_strays.$$.list
if [ -n "$stray_names" ]; then
  echo "[prune_legacy_stack] found compose-invisible strays: $stray_names"
  # Use xargs -r so an empty list is a no-op. `docker rm -f` covers running
  # containers too; `rm` would refuse to remove a running one.
  printf '%s\n' $stray_names | xargs -r docker rm -f || true
  echo "[prune_legacy_stack] strays removed"
else
  echo "[prune_legacy_stack] no compose-invisible strays"
fi
REMOTE_PRUNE
}

# ---------------------------------------------------------------------------
# Post-`up` health gate.
#
# Why this exists: `docker compose up -d --build` exits 0 the moment all
# services have been *created*, not when they are *running*. The
# 2026-10-08 01:22 deploy (aisztens-monitor-1 stray) is the proof: the API
# and postgres containers were left in `Created`, caddy was never created,
# and the operator got a clean-looking `up` exit followed by a dark site.
#
# This gate parses the expected service list from the same compose file the
# `up` just used, then runs `docker compose ps --status running` on the
# droplet and aborts with an explicit list of any service that is missing or
# not in `running`. The service list is read locally (not via SSH) so a
# broken compose file is caught before the network round trip.
# ---------------------------------------------------------------------------
verify_up_result() {
  local remote_dir="$1"
  local compose_args="$2"

  # Resolve expected services from the LOCAL compose file: every top-level
  # `services:` key is a service. We do not need a full YAML parser — the
  # compose file is ours, so the format is fixed.
  local compose_file="$REPO_DIR/infra/docker-compose.yml"
  if [ ! -f "$compose_file" ]; then
    log_error "verify_up_result: $compose_file is missing — cannot enumerate expected services."
    return 1
  fi
  local expected
  expected="$(awk '
    BEGIN { in_services=0; }
    # Top-level `services:` opens the section.
    /^services:[[:space:]]*$/ { in_services=1; next }
    # Top-level `volumes:` / `networks:` close it (these are sibling keys of
    # `services:`, NOT the `networks:` field nested INSIDE each service).
    in_services && /^volumes:[[:space:]]*$/ { exit }
    in_services && /^networks:[[:space:]]*$/ { exit }
    # Top-level service entries are indented exactly 2 spaces. The `networks`
    # field inside a service is indented 4 spaces and MUST be ignored — the
    # earlier regex `^[[:space:]]{2}` accidentally matched it and stopped the
    # parse after the first service (2026-10-08 01:58 live regression).
    in_services && /^  [a-zA-Z0-9_.-]+:[[:space:]]*$/ {
      match($0, /  ([a-zA-Z0-9_.-]+):/)
      print substr($0, RSTART+2, RLENGTH-3)
    }
  ' "$compose_file" | sort -u)"
  if [ -z "$expected" ]; then
    log_error "verify_up_result: parsed zero services from $compose_file — refusing to proceed."
    return 1
  fi
  log "Expected services: $(printf '%s ' $expected | sed 's/ $//')"

  # Fetch running services from compose. Empty stdout = nothing running.
  # `docker compose ps --format '{{.Service}}'` writes one service per line,
  # so we collapse to single spaces before the case match below: bash's
  # `*` glob inside `case` does NOT cross newlines, and `case " $running "
  # in *" $svc "*"` would silently miss every service otherwise (the
  # 2026-10-08 02:18 live regression where the verify reported
  # "Not running after up: api caddy monitor postgres" despite the
  # running list containing the same four).
  local running
  running="$(("${SSH[@]}" "cd '$remote_dir' && docker compose $compose_args ps --status running --format '{{.Service}}'" || true) | tr '\n' ' ')"
  # Strip a single trailing space if present (created by the newline→space
  # substitution above) so the log line below doesn't end with two spaces.
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
    log_error 'This is the same failure mode as the 2026-10-08 01:22 deploy (a stray container occupied an expected name and `up` exited 0 with most services left in `Created`).'
    log_error "Diagnose with:"
    log_error "  ssh $SSH_USER@$HOST 'cd $remote_dir && docker compose $compose_args ps -a'"
    log_error "  ssh $SSH_USER@$HOST 'docker ps -a --format \"{{.Names}}\\t{{.Status}}\\t{{.Labels}}\\\"'"
    log_error "Aborted before declaring the deploy successful."
    return 1
  fi
  log "All expected services are running."
}

# NB: the positional parameters were shifted during argument parsing, so the
# dispatch must read DEPLOY_CMD — `case "${1:-}"` here would look at the TARGET
# and send every command into the unknown-command branch below.
case "$DEPLOY_CMD" in
  upload)
    upload
    ;;
  bootstrap)
    # bootstrap.sh installs packages and creates the users, so it MUST run as
    # root: either log in as root (SSH_USER=root) or have passwordless sudo.
    # Every other command runs as `deployer`, so this is the one place where a
    # root login is still expected. Check it BEFORE the upload, so a wrong
    # identity does not leave a half-updated tree behind.
    if ! "${SSH[@]}" "sudo -n true" >/dev/null 2>&1; then
      log_error "'bootstrap' must run as root, but $SSH_USER@$HOST has no passwordless sudo."
      log_error "Run it once with the root account:"
      log_error "  SSH_USER=root ./deploy/deploy.sh bootstrap ${DEPLOY_ENV}"
      log_error "Day-to-day deploys (up/down/restart/ps/logs) then run as '$SSH_USER'."
      log_error "Aborted before any upload or remote command was executed."
      exit 1
    fi
    upload
    # bootstrap.sh installs SSH keys from $KEYS_DIR/$user.pub on the droplet
    # (deploy/bootstrap.sh:75). That dir is rsync-excluded to keep the
    # private key out of the upload (deploy/deploy.sh:685), which means the
    # bootstrap would always log "WARNING: no public key …" without the
    # targeted scp below. Shipping ONLY the *.pub halves keeps the private
    # key safe while restoring the documented `deployer` login path.
    ship_bootstrap_pub_keys
    log "Running bootstrap.sh on the droplet ..."
    run_remote "sudo bash deploy/bootstrap.sh"
    ;;
  down-all)
    # VENT PANE: tear down every docker-compose project on the droplet,
    # including historical ones, freeing 80/43 and removing all
    # Caddy/API/postgres/monitor containers. Use only when the stack is
    # wedged and `down` does not help.
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
    # CRITICAL: prune before bring-up. If a previous Caddy from a different
    # compose project still owns 80/443, the new one cannot bind them and
    # exits 128 — the site goes dark until the orphan is removed.
    # NOTE: this module still tears down the current project first;
    # splitting foreign-only-first is module M7 (PR #6 of the plan).
    log_stage "up_start"
    prune_legacy_stack
    upload
    log_stage "compose_up"
    log "Building & starting the stack (APP_ENV=${APP_ENV}) ..."
    # APP_ENV is also declared in infra/docker-compose.yml's `api` service
    # `environment:` block; we re-export it as shell env here as belt-and-
    # braces so a future change that forgets the compose line cannot silently
    # run the api container as APP_ENV=dev on a prod droplet.
    run_remote "APP_ENV=${APP_ENV} docker compose $COMPOSE_ARGS up -d --build"
    # Post-up assertion: `up -d --build` exits 0 the moment all of them are
    # *created*, not the moment they are `running` — it is the failure mode
    # of the 2026-10-08 01:22 run (api/postgres left in `Created`, caddy
    # never created, monitor strayed). List everything and fail loudly when
    # any expected service is missing or not running.
    log_stage "compose_verify"
    log "Verifying every service is running ..."
    verify_up_result "$REMOTE_DIR" "$COMPOSE_ARGS"
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
    # help / -h / --help / no argument were handled above, before the HOST
    # guard (see print_usage), so this branch only sees a real unknown command.
    # NB: the positional parameters were shifted during argument parsing, so
    # this must use DEPLOY_CMD and not "$1" (which now holds the target).
    log_error "unknown command '$DEPLOY_CMD'"
    print_usage >&2
    echo "See deploy/log/latest.log for the full log of the last run." >&2
    exit 1
    ;;
esac
