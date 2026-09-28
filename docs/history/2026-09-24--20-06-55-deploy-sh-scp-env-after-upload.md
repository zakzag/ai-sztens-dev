# Fix: deploy.sh `up` fails with `couldn't find env file: /opt/aisztens/infra/.env`

## Date
2026-09-24

## Context
After fixing the rsync `-e` host duplication, `./deploy/deploy.sh up` reaches
the "Building & starting the stack" step but fails immediately:

```
[deploy] Building & starting the stack ...
Enter passphrase for key '...':
couldn't find env file: /opt/aisztens/infra/.env
```

The compose command in [`deploy/deploy.sh`](deploy/deploy.sh:30) is:

```bash
COMPOSE_ARGS="--env-file infra/.env -f infra/docker-compose.yml"
```

so docker-compose resolves `infra/.env` relative to the droplet's
`/opt/aisztens` working directory — but that file does not exist on the
droplet.

## Root cause
`infra/.env` (and `deploy/.env`) are listed in the repository-level
[`.gitignore`](.gitignore:40) (`# dotenv environment variable files`) and are
**never committed**. On top of that the upload step in
[`deploy/deploy.sh`](deploy/deploy.sh:47) was using rsync's blanket
`--exclude '.env'` rule, which silently drops both `deploy/.env` and
`infra/.env` from the upload. The droplet therefore has no `infra/.env` to
feed to `docker compose --env-file`.

This was masked earlier because the previous error (`bash: line 1: ssh.aisztens.hu:
command not found`) aborted the upload before any compose call.

## Fix
[`deploy/deploy.sh`](deploy/deploy.sh:47) — exclude `.env` files from rsync
explicitly *and* scp the local copies on top of the upload as the last step
inside `upload()`:

```bash
rsync -az --delete -e "${SSH_CMD[*]}" \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'coverage' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'deploy/.env' \
  --exclude 'infra/.env' \
  "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"
# Render runtime env files from the local copies (deploy/.env and infra/.env).
# Both are gitignored, so rsync won't ship them.
if [ -f "$SCRIPT_DIR/.env" ]; then
  log "Rendering deploy/.env on the droplet ..."
  "${SCP[@]}" "$SCRIPT_DIR/.env" "$SSH_USER@$HOST:$REMOTE_DIR/deploy/.env"
fi
if [ -f "$REPO_DIR/infra/.env" ]; then
  log "Rendering infra/.env on the droplet ..."
  "${SCP[@]}" "$REPO_DIR/infra/.env" "$SSH_USER@$HOST:$REMOTE_DIR/infra/.env"
fi
```

Notes:

- The `SCP` array (introduced together with `SSH_CMD` in the previous fix)
  reuses the same `StrictHostKeyChecking=accept-new` + `IdentitiesOnly=yes` +
  `-i "$SSH_KEY"` chain as the rsync `-e`, so scp picks up the same key/passphrase
  flow.
- `infra/.env` permissions are preserved by `scp`; the example file at
  [`infra/.env.example`](../infra/.env.example) only documents the schema.
- For CI the existing `.github/workflows/deploy.yml` already renders
  `infra/.env` from the `INFRA_ENV` secret, so this code path is exercised
  only from local `./deploy/deploy.sh up`.

## Verification
- `bash -n deploy/deploy.sh` reports `syntax OK`.
- The next `./deploy/deploy.sh up` is expected to:
  1. rsync the repo (minus env files) into `/opt/aisztens`,
  2. scp `deploy/.env` and `infra/.env` on top,
  3. run `docker compose --env-file infra/.env -f infra/docker-compose.yml
     up -d --build` successfully.

## Prerequisites (unchanged)
- WSL Debian: `apt-get install -y rsync openssh-client` ([`deploy/deploy.sh`](deploy/deploy.sh:4)).
- `deploy/.env` must contain `HOST`, `SSH_USER`, and (optionally) `SSH_KEY`.
- `infra/.env` must be a real copy of [`infra/.env.example`](../infra/.env.example)
  with secrets filled in.
