# Milestone — deploy.yml ssh-action `envs:` forward fix (2026-10-12)

## 1. Problem / feature

The deploy workflow was now reaching its ssh steps (after the prior
`command:` -> `script:` rename), but every step that referenced
`$REMOTE_DIR` (or `$APP_ENV`, `$IMAGE_TAG`, `$GHCR_PAT`, `$GITHUB_ACTOR`)
on the remote shell failed with `unbound variable` or empty-string
substitution. The first such step ("Tighten env on droplet") aborted
the run; downstream steps were skipped.

## 2. Measured data / evidence

GitHub Actions log of the failed run:

```
err: bash: line 2: REMOTE_DIR: unbound variable
2026/10/11 22:36:37 Process exited with status 1
```

The dump step that followed (run on `if: failure()`) reported:

```
err: couldn't find env file: /home/deployer/infra/.env
```

— confirming the `cd "$REMOTE_DIR"` on the remote shell had fallen
back to the home directory because `$REMOTE_DIR` was empty.

## 3. Root cause

`appleboy/ssh-action` v1's input contract is documented as:

> `envs`: Environment variables to pass to the shell script (string,
> comma-separated list of names).

The step's `env:` block sets the variables in the action's _local_
container process environment, but the action does not export them
to the remote shell unless the variable is named in the `envs:`
input. This is the documented design and is different from
`appleboy/scp-action`, which reads runner-side `env:` directly.

The previous `command:` -> `script:` rename made the steps actually
execute; the missing env-var forwarding had been hidden behind the
silent no-op behaviour.

## 4. Solution / implementation

`.github/workflows/deploy.yml` only. Added one `envs:` line per ssh
step, listing exactly the variables that step's `script:` body
references. Seven occurrences, one per ssh step. No other change in
the file. YAML re-validated.

## 5. Outcome and how to verify

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): forward REMOTE_DIR etc. to remote shell via ssh-action 'envs:' input"
git push origin dev
```

On the next deploy run:

- Tighten step -> `infra/.env on droplet is now mode 600`.
- Pull and start step -> `docker compose pull && up -d` runs against
  `/opt/aisztens`, the stack flips to the new SHA, `/healthz` returns
  `{"status":"oks",...}`.
- All other ssh steps behave correctly (Verify tag, Wait for
  healthz, Smoke test, Dump logs).

## 6. Follow-ups

- This is the **fourth** distinct bug in `.github/workflows/deploy.yml`
  this session (parse errors -> chmod on .env -> command: silent
  no-op -> env forwarding). Strongly recommend running `actionlint`
  (https://github.com/rhysd/actionlint) on the workflow files in
  CI, and pinning `appleboy/ssh-action` and `appleboy/scp-action` to
  the same major version with a periodic dependency-review check
  rather than `@v1` / `@v0.1.7` floats.
- A future refactor could remove the `REMOTE_DIR` indirection and
  hardcode `/opt/aisztens` in the scripts; only `APP_ENV`, `IMAGE_TAG`
  and the GHCR auth vars would still need `envs:`. Deferred because
  `deploy/README.md` documents the install path as a variable and a
  separate PR can decide whether to keep that contract.
- The smoke test step (now actually running) will be the canary for
  any further workflow drift. If a future change re-introduces a
  silent no-op, the smoke test will fail and break the deploy, which
  is the desired failure mode.
