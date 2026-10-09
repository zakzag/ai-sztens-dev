#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AIsztens — offline .env syntax & consistency checks.
#
# Validates every per-env .env file (deploy/, infra/, apps/*) WITHOUT touching
# the network. Safe to run on any machine, any time, including CI.
#
# Per file:
#   1. every non-comment line is KEY=value (no spaces around '=')
#   2. no duplicate keys
#   3. the file sources cleanly under bash (`set -a; . file`)
#   4. CRLF line-ending warning
# Across files:
#   5. required keys are present for each real per-env file
#   6. placeholder values are absent from the real dev files
#   7. apps/{web,admin}/.env.dev VITE_API_BASE_URL matches infra/.env.dev DOMAIN
#
# Exit codes: 0 = all good, 1 = at least one FAIL, 2 = usage error.
#
# Live/network checks live in check-env-live.sh (same folder).
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || {
  echo "[env-test] cannot cd to $REPO_ROOT" >&2
  exit 2
}

usage() {
  cat <<'USAGE'
Usage: scripts/env-test/check-env-syntax.sh

Offline syntax + consistency checks for every AIsztens .env file.
No network access is performed.

Exit codes:
  0  every check passed
  1  at least one check failed
  2  usage error
USAGE
}

for a in "$@"; do
  case "$a" in
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[env-test] unknown argument: $a" >&2
      usage >&2
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

# --- small helpers ---------------------------------------------------------
is_kv_line() { [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; }
is_comment_or_blank() { [[ -z "${1//[[:space:]]/}" || "$1" =~ ^[[:space:]]*# ]]; }

# get_value <file> <key>  -> prints the value with surrounding quotes stripped.
get_value() {
  local file="$1" key="$2" line val
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n1 || true)"
  [ -z "$line" ] && return 1
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" == \"*\" || "$val" == \'*\' ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s' "$val"
}

has_key() { grep -qE "^[[:space:]]*$2=" "$1"; }

# --- per-file checks -------------------------------------------------------
# check_file_syntax <rel> [kind]
#   kind = active   (default) loadable per-env file -> strict
#          dormant  `.env.prod` placeholder file    -> sourcing downgraded to WARN
#          template `.env.example` documentation    -> duplicates + sourcing skipped
check_file_syntax() {
  local rel="$1" kind="${2:-active}" file="$REPO_ROOT/$1"
  if [ ! -f "$file" ]; then
    skip "$rel (not present)"
    return 0
  fi

  local lineno=0 line bad=0 key src_err
  local -A seen=()
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"
    is_comment_or_blank "$line" && continue
    if ! is_kv_line "$line"; then
      fail "$rel:$lineno not KEY=value: $line"
      bad=1
      continue
    fi
    if [[ "$line" =~ ^[[:space:]]+ ]]; then
      fail "$rel:$lineno leading whitespace before key"
      bad=1
    fi
    key="${line%%=*}"
    if [ "$kind" = template ]; then
      : # example templates legitimately repeat a key once per environment block
    elif [ "${seen[$key]+set}" = "set" ]; then
      fail "$rel:$lineno duplicate key '$key' (first seen at line ${seen[$key]})"
      bad=1
    else
      seen[$key]="$lineno"
    fi
  done <"$file"
  [ "$bad" -eq 0 ] && pass "$rel: key/value syntax OK"

  if LC_ALL=C grep -q $'\r' "$file" 2>/dev/null; then
    warn "$rel: CRLF line endings detected (bash values may carry a stray CR)"
  fi

  if [ "$kind" = template ]; then
    skip "$rel: bash sourcing (documentation template)"
    return 0
  fi

  if src_err="$( ( set -a; . "$file" ) 2>&1 )"; then
    pass "$rel: sources cleanly under bash"
  elif [ "$kind" = dormant ]; then
    warn "$rel: does not source under bash (dormant prod placeholder) -- ${src_err:-unknown error}"
  else
    fail "$rel: does not source under bash -- ${src_err:-unknown error}"
  fi
}

check_required() {
  local rel="$1"
  shift
  local file="$REPO_ROOT/$rel"
  if [ ! -f "$file" ]; then
    skip "$rel required-keys (file not present)"
    return 0
  fi
  local missing=0 k
  for k in "$@"; do
    if ! has_key "$file" "$k"; then
      fail "$rel: missing required key '$k'"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] && pass "$rel: all required keys present"
}

PLACEHOLDER_RE='(^|[^A-Za-z])(change-me|change_me|replace-with|replace_me|placeholder|<[A-Za-z0-9._-]+>|YOUR_|example\.com)'
check_placeholders() {
  local rel="$1" mode="${2:-fail}"
  local file="$REPO_ROOT/$rel"
  if [ ! -f "$file" ]; then
    skip "$rel placeholder scan (file not present)"
    return 0
  fi
  local found=0 lineno=0 line key val
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"
    is_comment_or_blank "$line" && continue
    is_kv_line "$line" || continue
    key="${line%%=*}"
    val="${line#*=}"
    if printf '%s' "$val" | grep -Eq "$PLACEHOLDER_RE"; then
      if [ "$mode" = fail ]; then
        fail "$rel:$lineno placeholder value in '$key': $val"
      else
        warn "$rel:$lineno placeholder value in '$key': $val"
      fi
      found=1
    fi
  done <"$file"
  [ "$found" -eq 0 ] && pass "$rel: no placeholder values"
}

check_spa_api_url() {
  local app="$1"
  local infra_file="$REPO_ROOT/infra/.env.dev"
  local spa_file="$REPO_ROOT/apps/$app/.env.dev"
  if [ ! -f "$infra_file" ] || [ ! -f "$spa_file" ]; then
    skip "apps/$app/.env.dev vs infra/.env.dev (file not present)"
    return 0
  fi
  local domain expected actual
  domain="$(get_value "$infra_file" DOMAIN || true)"
  expected="https://api.${domain}/api"
  actual="$(get_value "$spa_file" VITE_API_BASE_URL || true)"
  if [ "$actual" = "$expected" ]; then
    pass "apps/$app/.env.dev VITE_API_BASE_URL == $expected"
  else
    fail "apps/$app/.env.dev VITE_API_BASE_URL='$actual' != expected '$expected' (infra/.env.dev DOMAIN=$domain)"
  fi
}

# --- run -------------------------------------------------------------------
printf '%s[env-test]%s repo root: %s\n' "$C_BLUE" "$C_RESET" "$REPO_ROOT"

section "key/value syntax, duplicates, bash sourcing"
for f in \
  deploy/.env.local deploy/.env.dev deploy/.env.prod \
  infra/.env.local infra/.env.dev infra/.env.prod \
  apps/api/.env.local apps/api/.env.dev apps/api/.env.prod \
  apps/web/.env.local apps/web/.env.dev apps/web/.env.prod \
  apps/admin/.env.local apps/admin/.env.dev apps/admin/.env.prod \
  deploy/.env.example infra/.env.example \
  apps/api/.env.example apps/web/.env.example apps/admin/.env.example; do
  case "$f" in
    *.env.example) check_file_syntax "$f" template ;;
    *.env.prod) check_file_syntax "$f" dormant ;;
    *) check_file_syntax "$f" active ;;
  esac
done

section "required keys"
check_required deploy/.env.dev HOST SSH_USER REMOTE_DIR SUDO_USERS APP_USER
check_required infra/.env.dev DOMAIN ACME_EMAIL API_PORT CORS_ORIGINS VAPI_WEBHOOK_SECRET \
  POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD AISZTENS_DB_USER AISZTENS_DB_PASSWORD \
  TKOVARI_DB_PASSWORD KRAK_DB_PASSWORD MONITOR_TARGET_URL MONITOR_INTERVAL_SECONDS
check_required apps/api/.env.local PORT CORS_ORIGINS
check_required apps/api/.env.dev PORT CORS_ORIGINS
check_required apps/api/.env.prod PORT CORS_ORIGINS
check_required apps/web/.env.local VITE_API_BASE_URL
check_required apps/web/.env.dev VITE_API_BASE_URL
check_required apps/web/.env.prod VITE_API_BASE_URL
check_required apps/admin/.env.local VITE_API_BASE_URL
check_required apps/admin/.env.dev VITE_API_BASE_URL
check_required apps/admin/.env.prod VITE_API_BASE_URL

section "placeholder scan"
check_placeholders deploy/.env.dev fail
check_placeholders infra/.env.dev fail
check_placeholders apps/api/.env.dev warn
check_placeholders apps/web/.env.dev warn
check_placeholders apps/admin/.env.dev warn

section "cross-file consistency"
check_spa_api_url web
check_spa_api_url admin

section "summary"
printf '%s  passed=%d failed=%d warnings=%d skipped=%d%s\n' \
  "$C_BLUE" "$PASS" "$FAIL" "$WARN" "$SKIP" "$C_RESET"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
