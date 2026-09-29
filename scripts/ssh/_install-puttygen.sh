#!/usr/bin/env bash
set -euo pipefail
if ! command -v puttygen >/dev/null 2>&1; then
  echo "Installing putty-tools (apt) ..."
  sudo apt-get update -y >/dev/null
  sudo apt-get install -y putty-tools
fi
puttygen --version 2>&1 | head -n 2 || true
which puttygen
