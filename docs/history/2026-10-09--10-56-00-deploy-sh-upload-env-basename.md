# Deploy `upload()`: scp basename collision on the rendered env

**Date:** 2026-10-09
**Status:** Fixed
**File:** [`deploy/deploy.sh`](../../deploy/deploy.sh)

## Problem

`./deploy/deploy.sh bootstrap dev` (and `up dev`) failed after the preflight with:

```
[INFO ] [deploy] Shipping 3 files to root@ssh.aisztens.hu:/opt/aisztens ...
mv: cannot stat '.env': No such file or directory
[ERROR] [deploy] ===== finished: exit=1 duration=8s log=...
```

The droplet ended up with `docker-compose.yml` and `Caddyfile.rendered` in `/opt/aisztens/`, but the rendered env file was **missing** — and the post-scp `mv -f .env infra/.env` had nothing to move.

## Root cause

`scp src1 src2 src3 user@host:destdir/` copies each source by its **basename** into `destdir/`. The original code did:

```bash
rendered_env="$(mktemp)"          # basename is /tmp/tmp.XXXXXX
"${SCP[@]}" \
    "$REPO_DIR/infra/docker-compose.yml" \
    "$rendered_env" \
    "$REPO_DIR/infra/caddy/Caddyfile.rendered" \
    "$SSH_USER@$HOST:$REMOTE_DIR/"
"${SSH[@]}" "cd $REMOTE_DIR && \
    mv -f docker-compose.yml infra/docker-compose.yml && \
    mv -f Caddyfile.rendered infra/caddy/Caddyfile.rendered && \
    mv -f .env infra/.env && ..."
```

The droplet therefore received `docker-compose.yml`, `tmp.XXXXXX`, and `Caddyfile.rendered` — never a file named `.env` — and the `mv -f .env` step died.

## Fix

Stage the rendered env in a **dedicated temp directory** whose only entry is a file literally named `.env`. scp's basename preservation then places it as `.env` on the droplet, matching the `mv` step. A `trap … RETURN` removes the staging directory when the function exits (success, failure, or errexit), so the temp dir cannot leak.

## Verification

- `bash -n deploy/deploy.sh` → OK.
- The next `bootstrap`/`up` run will:
  1. create `/tmp/deploy.XXXXXX/.env`,
  2. scp the three files (the middle one with basename `.env`),
  3. `mv .env infra/.env` and `chmod 600` it on the droplet,
  4. `trap … RETURN` removes the temp dir.

## Follow-up

None — fix is local to `upload()`. The same mistake pattern (relying on scp's basename) is worth keeping in mind for any future multi-file scp invocation.
