#!/usr/bin/env bash
# Fix SSH key permissions and copy to ~/.ssh with 0600.
set -euo pipefail
KEY_SRC=/mnt/e/projects/AI/2026-08-31-ai-sztens-dev/deploy/ssh-keys/id_aisztens_krak
echo "USER=$USER HOME=$HOME"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
cp "$KEY_SRC" "$HOME/.ssh/id_aisztens_krak"
chmod 600 "$HOME/.ssh/id_aisztens_krak"
echo "--- file listing ---"
ls -la "$HOME/.ssh/id_aisztens_krak"
echo "--- public half ---"
ssh-keygen -y -f "$HOME/.ssh/id_aisztens_krak"
