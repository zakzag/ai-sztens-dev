# 2026-10-12 00:28 — deploy.yml ssh-action `command:` -> `script:` rename

## Problem

After the previous two fixes (parse errors, chmod), the pipeline still
did not actually deploy. The build workflow (`images.yml`) produced the
new `sha-660f636` images, the deploy workflow (`deploy.yml`) ran and
reported "Success", but on the droplet:

- `docker compose ps` was still pinned to `sha-3a8f5b6`
- `curl https://api.aisztens.hu/healthz` still returned `ok`
- `/opt/aisztens/infra/.env` was still mode `644`, not `600`

The deploy step ran in 49s. The job output contained 5 warning lines:

```
Unexpected input(s) 'command', valid inputs are ['entryPoint', 'args',
'host', 'port', 'passphrase', 'username', 'password', 'sync',
'use_insecure_cipher', 'cipher', 'timeout', 'command_timeout', 'key',
'key_path', 'fingerprint', 'proxy_host', 'proxy_port', 'proxy_username',
'proxy_password', 'proxy_passphrase', 'proxy_timeout', 'proxy_key',
'proxy_key_path', 'proxy_fingerprint', 'proxy_cipher',
'proxy_use_insecure_cipher', 'script', 'script_stop', 'envs',
'envs_format', 'debug', 'allenvs', 'request_pty']
```

`appleboy/ssh-action@v1.0.3` only accepts `script:` (or `script_path:`);
the workflow used `command:` in every ssh step from day one. The action
silently ignores unknown inputs (warning only), so the step "succeeds"
without executing anything. The first ever deploy must have happened via
a previous version of the action (or a manual `docker compose` on the
host); every deploy since has been a silent no-op.

## Fix

`.github/workflows/deploy.yml` only. Mechanical rename: every
`          command: |` (10-space indent) under an `appleboy/ssh-action`
step became `          script: |`. Seven occurrences — one per ssh step:
GHCR login, Tighten env on droplet (added in the previous fix), Pull
and start the stack, Verify tag, Wait for healthz, Smoke test, Dump
container logs on failure. No other change to the file.

YAML re-validated with `python -c "yaml.safe_load(...)"` — clean. Grep
confirms no `command:` remains in the file.

## Verification

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): rename ssh-action 'command:' to 'script:' (was silently ignored)"
git push origin dev
```

On the next deploy:

- All 5 `Unexpected input(s) 'command'` warnings should disappear.
- `docker compose pull && up -d` should actually run, the stack should
  flip from `sha-3a8f5b6` to the new SHA, and `curl /healthz` should
  return `oks`.
- The "Tighten env on droplet" step should now be able to actually
  `chmod 600` (because the ssh connection will not silently no-op),
  so `/opt/aisztens/infra/.env` should become mode `600`.
