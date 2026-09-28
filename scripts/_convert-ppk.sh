#!/usr/bin/env bash
set -euo pipefail
SRC=/mnt/e/projects/AI/2026-08-31-ai-sztens-dev/deploy/ssh-keys/id_aisztens_krak
DST=/home/tkovari/.ssh/id_aisztens_krak
PUTTYGEN=/mnt/c/Progs/PuTTY/puttygen.exe

mkdir -p "$(dirname "$DST")"
chmod 700 "$(dirname "$DST")"

if [ ! -x "$PUTTYGEN" ] && [ ! -f "$PUTTYGEN" ]; then
  echo "ERROR: puttygen.exe not found at $PUTTYGEN" >&2
  exit 1
fi

echo "--- attempting conversion with EMPTY passphrase ---"
if echo "" | "$PUTTYGEN" "$SRC" -O private-openssh -o "$DST" 2>/tmp/puttygen.err; then
  echo "OK: converted with EMPTY passphrase."
else
  echo "Empty passphrase failed; will prompt for passphrase interactively."
  echo "(You will see PuTTYgen's passphrase prompt now.)"
  "$PUTTYGEN" "$SRC" -O private-openssh -o "$DST"
fi

chmod 600 "$DST"
echo "--- final file ---"
ls -la "$DST"
echo "--- verifying with ssh-keygen ---"
ssh-keygen -y -f "$DST"
