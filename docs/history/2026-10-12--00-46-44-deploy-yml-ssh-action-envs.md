# 2026-10-12 00:46 — deploy.yml ssh-action `envs:` forward (REMOTE_DIR etc.)

## Problem

After the previous fix (renaming `command:` -> `script:` so the ssh steps
actually run), the first ssh step ("Tighten infra/.env permissions on
the droplet") immediately failed with:

```
err: bash: line 2: REMOTE_DIR: unbound variable
2026/10/11 22:36:37 Process exited with status 1
```

The follow-up "Dump container logs on failure" step then ran but with
an empty `$REMOTE_DIR` too, reporting `couldn't find env file:
/home/deployer/infra/.env` because `cd "$REMOTE_DIR"` had fallen back
to the home directory.

The remaining ssh steps (Pull and start, Verify tag, Wait for
healthz, Smoke test) were skipped because the Tighten step exited 1
in fail-fast mode.

## Root cause

`appleboy/ssh-action` v1 does NOT forward every runner-side env var to
the remote shell. The action takes an `envs:` input (a comma-separated
list of names) and only those names get exported on the remote side.
The `env:` block on the step sets the variables in the **action's
local container** process environment, which is useless for the
remote `cd "$REMOTE_DIR"` etc. that follow.

This is a different action model from `appleboy/scp-action`, which
reads runner-side `env:` directly. The two actions have different
input contracts; the workflow had been written as if they were the
same, and the original `command:` -> `script:` rename simply brought
this into the light (because before, the steps were no-ops so the
empty env didn't matter).

## Fix

`.github/workflows/deploy.yml` only. Added one `envs:` line per ssh
step, listing exactly the variables that step's `script:` references.
Seven occurrences, one per step:

| Step | envs: |
|---|---|
| Tighten infra/.env permissions on the droplet | `REMOTE_DIR` |
| docker login ghcr.io (when GHCR_PAT is set) | `REMOTE_DIR,GHCR_PAT,GITHUB_ACTOR` |
| Pull and start the stack | `REMOTE_DIR,APP_ENV` |
| Verify every service is running IMAGE_TAG | `REMOTE_DIR,IMAGE_TAG` |
| Wait for api healthcheck | `REMOTE_DIR,APP_ENV` |
| Run stack smoke tests against live deployment | `REMOTE_DIR` |
| Dump container logs on failure | `REMOTE_DIR,APP_ENV` |

YAML re-validated with `python -c "yaml.safe_load(...)"` — clean. The
total diff is 7 added lines and zero changes to any other content.

## Verification

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): forward REMOTE_DIR etc. to remote shell via ssh-action 'envs:' input"
git push origin dev
```

On the next deploy:

- The "Tighten env on droplet" step should now find `$REMOTE_DIR` set
  and successfully `chmod 600` the file. Expect log line
  `infra/.env on droplet is now mode 600 (...)`.
- The "Pull and start the stack" step should now `cd /opt/aisztens`
  correctly and run `docker compose pull && up -d --force-recreate`.
  The stack should flip from `sha-3a8f5b6` to the new SHA, and
  `curl /healthz` should return `{"status":"oks",...}`.
- The "Dump container logs on failure" step (now only triggered on
  real failure) should also be able to find the env file and produce
  useful diagnostics, not the spurious "couldn't find env file" we
  saw this run.

## Why we did not refactor to inline constants

Considered (and rejected for this fix) a refactor that hardcodes
`/opt/aisztens` in the scripts and only forwards `APP_ENV`,
`IMAGE_TAG`, `GHCR_PAT`, `GITHUB_ACTOR` via `envs:`. That would
produce smaller scripts and remove one indirection. The trade-off is
that the deploy path would no longer be a single env var to change
in one place — anyone moving to a different path would have to
find/replace in the file. Given `deploy/README.md` and
`scripts/init.*` already document `/opt/aisztens` as the canonical
install path, the `REMOTE_DIR` indirection is worth keeping for
now. A separate refactor PR can revisit this.
