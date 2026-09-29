#!/usr/bin/env bash
set -euo pipefail
KEY=/home/tkovari/.ssh/id_aisztens_krak
echo "--- size & perms ---"
stat "$KEY"
echo "--- first 5 lines (visible) ---"
head -n 5 "$KEY"
echo "--- last 5 lines (visible) ---"
tail -n 5 "$KEY"
echo "--- wc ---"
wc -l "$KEY"
echo "--- hex dump head ---"
head -c 200 "$KEY" | od -c | head -n 6
echo "--- file type ---"
file "$KEY"
