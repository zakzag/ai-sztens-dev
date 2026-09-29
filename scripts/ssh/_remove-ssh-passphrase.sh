#!/usr/bin/env bash
# scripts/_remove-ssh-passphrase.sh
#
# Removes the passphrase from the SSH private key used by deploy.sh so that
# automated deploys can authenticate without an interactive passphrase prompt
# (the current deploy.sh uses `-o IdentitiesOnly=yes`, which forces ssh to
# always prompt for the passphrase on stdin — which a non-interactive deploy
# cannot satisfy, hence the "Permission denied (publickey)" error).
#
# USAGE
#   Run from the repo root (WSL or Linux):
#     bash scripts/_remove-ssh-passphrase.sh
#
# WHAT IT DOES
#   1. Verifies that the key file referenced in `deploy/.env` (SSH_KEY) exists
#      and is a private OpenSSH key (mode 0600, starts with "-----BEGIN").
#   2. Backs up the original key to `kalman-ssh-key-20260916.openssh.private.key.bak`
#      in the same directory.
#   3. Calls `ssh-keygen -p -f <key> -P "<old-passphrase>" -N ""` to remove
#      the passphrase. The OLD passphrase is read from the `SSH_KEY_PASSPHRASE`
#      environment variable if set, otherwise prompted for interactively.
#   4. Verifies that the modified key now has no passphrase by attempting
#      `ssh-keygen -y` (which would re-prompt if the passphrase was still set).
#
# SET THE OLD PASSPHRASE (recommended for non-interactive use)
#     export SSH_KEY_PASSPHRASE='kalman.238!'
#     bash scripts/_remove-ssh-passphrase.sh
#
# SECURITY NOTE
#   Removing the passphrase means the private key on disk is unprotected.
#   Anyone with read access to `~/.ssh/kalman-ssh-key-20260916.openssh.private.key`
#   can immediately impersonate the key holder. Mitigations:
#     * Keep the file mode at 0600 (`chmod 600`).
#     * Never store the key in the repo (it is gitignored).
#     * Move the key to an encrypted volume if the laptop is portable.
#
# PREREQUISITES
#   - ssh-keygen is on PATH (OpenSSH client).
#   - The OLD passphrase is known (kalman.238! for this specific key).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n=== %s ===\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Resolve the key path from deploy/.env
# ---------------------------------------------------------------------------
log 'Resolving SSH key path from deploy/.env'

if [[ ! -f deploy/.env ]]; then
  die 'deploy/.env not found. Copy deploy/.env.example first.'
fi

# shellcheck disable=SC1091
SSH_KEY="$(grep -E '^SSH_KEY=' deploy/.env | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

if [[ -z "$SSH_KEY" ]]; then
  die 'SSH_KEY is empty in deploy/.env. Set it to the absolute path of the key.'
fi

# Expand a leading "~/" to $HOME (bash only, not POSIX sh).
SSH_KEY="${SSH_KEY/#\~/$HOME}"

if [[ ! -f "$SSH_KEY" ]]; then
  die "SSH key file not found: $SSH_KEY"
fi

log "Key path: $SSH_KEY"

# ---------------------------------------------------------------------------
# 2. Sanity-check the key file
# ---------------------------------------------------------------------------
KEY_MODE="$(stat -c '%a' "$SSH_KEY" 2>/dev/null || stat -f '%Lp' "$SSH_KEY")"
log "Key file mode: $KEY_MODE (0600 expected)"

if [[ "$KEY_MODE" != "600" ]] && [[ "$KEY_MODE" != "400" ]]; then
  log "WARNING: key file mode is $KEY_MODE, expected 0600. Run: chmod 600 '$SSH_KEY'"
fi

KEY_HEAD="$(head -n1 "$SSH_KEY" 2>/dev/null || true)"
if [[ "$KEY_HEAD" != "-----BEGIN OPENSSH PRIVATE KEY-----"* ]] \
   && [[ "$KEY_HEAD" != "-----BEGIN RSA PRIVATE KEY-----"* ]] \
   && [[ "$KEY_HEAD" != "-----BEGIN EC PRIVATE KEY-----"* ]] \
   && [[ "$KEY_HEAD" != "-----BEGIN DSA PRIVATE KEY-----"* ]]; then
  die "File does not look like an OpenSSH private key (first line: $KEY_HEAD)"
fi

# ---------------------------------------------------------------------------
# 3. Backup, then remove the passphrase
# ---------------------------------------------------------------------------
log 'Backing up the original key'
BACKUP="${SSH_KEY}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$SSH_KEY" "$BACKUP"
chmod 600 "$BACKUP"
log "Backup written to: $BACKUP"

# Resolve the old passphrase: env var, then prompt.
OLD_PP="${SSH_KEY_PASSPHRASE:-}"
if [[ -n "$OLD_PP" ]]; then
  log 'Using SSH_KEY_PASSPHRASE env var for the old passphrase'
  # ssh-keygen -P expects no trailing newline on the value it reads; printf is safe.
  OLD_PP_FLAG=(-P "$OLD_PP")
else
  log 'Old passphrase will be prompted for interactively'
  OLD_PP_FLAG=()
fi

log 'Removing the passphrase (this rewrites the key file in place)'
# -p  = change passphrase of an existing key
# -f  = path to the private key file
# -P  = old passphrase (empty in interactive mode if user just hits Enter)
# -N  = new passphrase ("" = no passphrase)
# We pipe the old passphrase via stdin ONLY when we already know it (env var path),
# to keep the script batch-friendly when the var is set.
if [[ -n "$OLD_PP" ]]; then
  printf '%s' "$OLD_PP" | ssh-keygen -p -f "$SSH_KEY" -N "" -P "$OLD_PP" >/dev/null
else
  ssh-keygen -p -f "$SSH_KEY" -N ""
fi

# ---------------------------------------------------------------------------
# 4. Verify the key now has no passphrase
# ---------------------------------------------------------------------------
log 'Verifying the key now has no passphrase'
if printf '' | ssh-keygen -y -f "$SSH_KEY" >/dev/null 2>&1; then
  log 'PASS: key no longer requires a passphrase'
  log "Public key fingerprint (sanity-check that the key still works):"
  ssh-keygen -lf "$SSH_KEY"
else
  log "FAIL: key still requires a passphrase (or some other error). Backup at $BACKUP"
  exit 1
fi

log 'Done.'
log "Test the deploy now: bash deploy/deploy.sh up"
