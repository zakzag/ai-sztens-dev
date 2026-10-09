#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AIsztens — LIVE .env access checks.
#
# Uses the real credentials from deploy/.env.dev and infra/.env.dev to prove
# the merged configuration actually works against the running dev droplet:
#   - SSH login          (deploy/.env.dev: HOST, SSH_USER, SSH_KEY)
#   - Postgres reachable + roles present (infra/.env.dev)
#   - HTTPS reachable: api / web / admin (infra/.env.dev DOMAIN)
#   - VAPI webhook secret is not a placeholder
#   - CORS excludes the api host, SUDO_USERS includes deployer
#   - the four SSH public keys are present locally
#
# This script DOES touch the network and logs into the droplet. It never
# prints secrets. Run it explicitly; it is NOT part of the offline suite.
#
# Usage: scripts/env-test/check-env-live.sh [--dry-run] [--help]
# Exit:  0 = all pass, 1 = at least one FAIL, 2 = usage/prereq error.
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || {
  echo "[env-live] cannot cd to $REPO_ROOT" >&2
  exit 2
}

DRY_RUN=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      cat <<'USAGE'
Usage: scripts/env-test/check-env-live.sh [--dry-run]

Live access checks against the dev droplet, driven by deploy/.env.dev and
infra/.env.dev. Requires ssh + curl and network access.

  --dry-run   print the commands that would run; execute nothing.
  --help      show this help.

Exit codes:
  0  every check passed
  1  at least one check failed
  2  usage error / missing prerequisite tool
USAGE
      exit 0
      ;;
    *)
      echo "[env-live] unknown argument: $a" >&2
      exit 2
      ;;
  esac
done

# --- output helpers --------------------------------------------------------
if [ -t 1 ]; then
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_RESET=$'\033[0m'
else
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_BLUE=""
  C_RESET=""
fi
PASS=0
FAIL=0
WARN=0
SKIP=0
pass() { PASS=$((PASS + 1)); printf '%s  PASS%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '%s  FAIL%s %s\n' "$C_RED" "$C_RESET" "$1"; }
warn() { WARN=$((WARN + 1)); printf '%s  WARN%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
skip() { SKIP=$((SKIP + 1)); printf '  SKIP %s\n' "$1"; }
section() { printf '\n%s== %s ==%s\n' "$C_BLUE" "$1" "$C_RESET"; }

if [ "$DRY_RUN" -eq 1 ]; then
  warn "dry-run: no network command will be executed"
fi

# --- prerequisites ---------------------------------------------------------
for t in ssh curl; do
  if ! command -v "$t" >/dev/null 2>&1; then
    echo "[env-live] missing required tool: $t" >&2
    exit 2
  fi
done

# --- load config -----------------------------------------------------------
DEPLOY_ENV_FILE="$REPO_ROOT/deploy/.env.dev"
INFRA_ENV_FILE="$REPO_ROOT/infra/.env.dev"
if [ ! -f "$DEPLOY_ENV_FILE" ]; then
  echo "[env-live] missing $DEPLOY_ENV_FILE" >&2
  exit 2
fi
if [ ! -f "$INFRA_ENV_FILE" ]; then
  echo "[env-live] missing $INFRA_ENV_FILE" >&2
  exit 2
fi
# Source WITHOUT `set -a`: the values stay shell-local so secrets are never
# exported into the environment of child processes (ssh / curl).
# shellcheck disable=SC1090
. "$DEPLOY_ENV_FILE"
# shellcheck disable=SC1090
. "$INFRA_ENV_FILE"

HOST="${HOST:-}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/aisztens}"
DOMAIN="${DOMAIN:-}"
SUDO_USERS="${SUDO_USERS:-}"
CORS_ORIGINS="${CORS_ORIGINS:-}"
VAPI_WEBHOOK_SECRET="${VAPI_WEBHOOK_SECRET:-}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-callback}"

printf '%s[env-live]%s repo root: %s\n' "$C_BLUE" "$C_RESET" "$REPO_ROOT"

section "static readiness"
if [ -n "$HOST" ]; then pass "deploy/.env.dev HOST=$HOST"; else fail "deploy/.env.dev HOST is empty"; fi
if [ -n "$DOMAIN" ]; then pass "infra/.env.dev DOMAIN=$DOMAIN"; else fail "infra/.env.dev DOMAIN is empty"; fi

if printf '%s' "$VAPI_WEBHOOK_SECRET" | grep -Eq '(change-me|change_me|replace-with|placeholder|<[A-Za-z0-9._-]+>)'; then
  fail "infra/.env.dev VAPI_WEBHOOK_SECRET is still a placeholder"
else
  pass "infra/.env.dev VAPI_WEBHOOK_SECRET is set (value hidden)"
fi

if [ -n "$DOMAIN" ] && printf '%s' "$CORS_ORIGINS" | grep -q "api.${DOMAIN}"; then
  fail "CORS_ORIGINS unexpectedly contains api.${DOMAIN}"
else
  pass "CORS_ORIGINS excludes api.<DOMAIN>"
fi

case ",${SUDO_USERS}," in
  *,deployer,*) pass "deploy/.env.dev SUDO_USERS includes deployer" ;;
  *) fail "deploy/.env.dev SUDO_USERS missing deployer (got: ${SUDO_USERS:-<empty>})" ;;
esac

for u in tkovari krak aisztens deployer; do
  if [ -f "$REPO_ROOT/deploy/ssh-keys/$u.pub" ]; then
    pass "deploy/ssh-keys/$u.pub present"
  else
    fail "deploy/ssh-keys/$u.pub missing"
  fi
done

# --- SSH -------------------------------------------------------------------
section "SSH access"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
if [ -n "$SSH_KEY" ]; then
  if [ -f "$SSH_KEY" ]; then
    SSH_OPTS+=(-o IdentitiesOnly=yes -i "$SSH_KEY")
    pass "SSH private key found: $SSH_KEY"
  else
    fail "SSH_KEY points to a missing file: $SSH_KEY"
  fi
else
  warn "SSH_KEY empty — falling back to ssh-agent / ~/.ssh defaults"
fi
DEST="${SSH_USER}@${HOST}"
SSH_OK=0

if [ -z "$HOST" ]; then
  skip "SSH login (no HOST)"
elif [ "$DRY_RUN" -eq 1 ]; then
  printf '  DRY  ssh %s %s "echo env-live-ok"\n' "${SSH_OPTS[*]}" "$DEST"
else
  if out="$(ssh "${SSH_OPTS[@]}" "$DEST" "echo env-live-ok" 2>&1)" && [ "$out" = "env-live-ok" ]; then
    pass "SSH login to $DEST works"
    SSH_OK=1
  else
    fail "SSH login to $DEST failed: ${out%%$'\n'*}"
  fi
fi

# --- Postgres (over the SSH channel) --------------------------------------
section "Postgres (via $DEST)"
if [ "$DRY_RUN" -ne 1 ] && [ "$SSH_OK" -ne 1 ]; then
  skip "Postgres checks (SSH not available)"
else
  PING_CMD="cd ${REMOTE_DIR} && docker compose --env-file infra/.env exec -T postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
  ROLES_CMD="cd ${REMOTE_DIR} && docker compose --env-file infra/.env exec -T postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -tAc \"SELECT rolname FROM pg_roles WHERE rolname IN ('aisztens','tkovari','krak') ORDER BY 1\""

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  DRY  ssh %s %s %q\n' "${SSH_OPTS[*]}" "$DEST" "$PING_CMD"
    printf '  DRY  ssh %s %s %q\n' "${SSH_OPTS[*]}" "$DEST" "$ROLES_CMD"
  else
    if out="$(ssh "${SSH_OPTS[@]}" "$DEST" "$PING_CMD" 2>&1)"; then
      pass "pg_isready on ${POSTGRES_DB} succeeded"
    else
      fail "pg_isready failed: ${out%%$'\n'*}"
    fi

    if roles="$(ssh "${SSH_OPTS[@]}" "$DEST" "$ROLES_CMD" 2>&1)"; then
      local_missing=""
      for r in aisztens tkovari krak; do
        printf '%s\n' "$roles" | grep -qx "$r" || local_missing="${local_missing} $r"
      done
      if [ -z "$local_missing" ]; then
        pass "Postgres roles present: aisztens, tkovari, krak"
      else
        fail "Postgres roles missing:${local_missing}"
      fi
    else
      fail "role query failed: ${roles%%$'\n'*}"
    fi
  fi
fi

# --- HTTPS -----------------------------------------------------------------
section "HTTPS (Let's Encrypt via Caddy)"
if [ -z "$DOMAIN" ]; then
  skip "HTTPS checks (no DOMAIN)"
else
  check_url() {
    local url="$1" code
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '  DRY  curl -fsS -o /dev/null -w %%{http_code} %s\n' "$url"
      return 0
    fi
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
      pass "HTTPS $url -> 200"
    else
      fail "HTTPS $url -> $code"
    fi
  }
  check_url "https://web.${DOMAIN}"
  check_url "https://admin.${DOMAIN}"
  # The api host answers either the liveness endpoint or the API root.
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  DRY  curl %s\n' "https://api.${DOMAIN}/healthz OR https://api.${DOMAIN}/api"
  else
    api_code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "https://api.${DOMAIN}/healthz" 2>/dev/null || echo 000)"
    if [ "$api_code" != "200" ]; then
      api_code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "https://api.${DOMAIN}/api" 2>/dev/null || echo 000)"
    fi
    if [ "$api_code" = "200" ]; then
      pass "HTTPS https://api.${DOMAIN} -> 200"
    else
      fail "HTTPS https://api.${DOMAIN} -> $api_code"
    fi
  fi
fi

# --- summary ---------------------------------------------------------------
section "summary"
printf '%s  passed=%d failed=%d warnings=%d skipped=%d%s\n' \
  "$C_BLUE" "$PASS" "$FAIL" "$WARN" "$SKIP" "$C_RESET"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
