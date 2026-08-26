#!/usr/bin/env bash
# scripts/lib/colors.sh
# -----------------------------------------------------------------------------
# ANSI colour helpers used across every script in scripts/.
#
# Source with:
#     source "$(dirname "${BASH_SOURCE[0]}")/lib/colors.sh"
#
# Public API:
#     info  "message"   - blue   '[*]'
#     ok    "message"   - green  '[+]'
#     warn  "message"   - yellow '[!]' (goes to stderr)
#     err   "message"   - red    '[x]' (goes to stderr, returns exit code 1)
#
# Colours auto-disable when stdout/stderr is not a TTY so logs piped to a file
# stay clean.
# -----------------------------------------------------------------------------

# Guard against double-sourcing
if [ -n "${__COLORS_SH_SOURCED:-}" ]; then
  return 0
fi
__COLORS_SH_SOURCED=1

# Enable colours only when stdout is a TTY.
if [ -t 1 ]; then
  __C_RESET=$'\033[0m'
  __C_INFO=$'\033[1;34m'    # bold blue
  __C_OK=$'\033[1;32m'      # bold green
  __C_WARN=$'\033[1;33m'    # bold yellow
  __C_ERR=$'\033[1;31m'     # bold red
else
  __C_RESET=""
  __C_INFO=""
  __C_OK=""
  __C_WARN=""
  __C_ERR=""
fi

# Print an info level (blue) message to stdout.
info() {
  printf '%s[*]%s %s\n' "${__C_INFO}" "${__C_RESET}" "$*"
}

# Print a success (green) message to stdout.
ok() {
  printf '%s[+]%s %s\n' "${__C_OK}" "${__C_RESET}" "$*"
}

# Print a warning (yellow) message to stderr.
warn() {
  printf '%s[!]%s %s\n' "${__C_WARN}" "${__C_RESET}" "$*" >&2
}

# Print an error (red) message to stderr and return non-zero.
err() {
  printf '%s[x]%s %s\n' "${__C_ERR}" "${__C_RESET}" "$*" >&2
  return 1
}
