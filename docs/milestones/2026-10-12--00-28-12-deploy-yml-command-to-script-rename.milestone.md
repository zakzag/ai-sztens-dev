# Milestone — deploy.yml ssh-action input-name fix (2026-10-12)

## 1. Problem / feature

`deploy.yml` was reporting "Success" but doing nothing for every push
to `dev` since the action was upgraded to `appleboy/ssh-action@v1.0.3`.
Build workflow ran and pushed `sha-660f636` to GHCR, deploy workflow
ran, but the droplet was still pinned to `sha-3a8f5b6` and the
`/opt/aisztens/infra/.env` was still world-readable.

## 2. Measured data / evidence

GitHub Actions warning, repeated 5× across the deploy job (one per
ssh-action step):

```
Unexpected input(s) 'command', valid inputs are ['entryPoint', 'args',
... 'script', 'script_path', 'envs', ...]
```

Live (droplet) checks run before/after the failed deploy:

- `docker compose ps` -> all 4 app services on `sha-3a8f5b6`
- `curl https://api.aisztens.hu/healthz` -> `{"status":"ok"}`
- `stat -c '%a' /opt/aisztens/infra/.env` -> `644`

## 3. Root cause

`appleboy/ssh-action` v1.0.x only accepts the input key `script:` (or
`script_path:`); there is no `command:` input. Earlier versions of the
action (v0.x) did accept `command:` and the workflow was written for
that. When the version was bumped, the YAML did not break (it is not a
schema error to pass an unknown key — the action logs a warning and
ignores it), but every ssh step became a no-op that "succeeds" with
exit code 0.

The image was still being built and published correctly because
`images.yml` uses `docker/build-push-action`, which was never affected.

## 4. Solution / implementation

`.github/workflows/deploy.yml` only. Mechanical rename of every
ssh-action `command:` -> `script:` (7 occurrences, identical
indentation, one replacement per `with:` block). Pure CI definition
fix; no source code, no Docker image, no infra-as-code change. YAML
re-validated with `python -c "yaml.safe_load(...)"`.

## 5. Outcome and how to verify

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): rename ssh-action 'command:' to 'script:' (was silently ignored)"
git push origin dev
```

Expected on the next deploy run:

- No more "Unexpected input(s) 'command'" warnings.
- `docker compose pull && up -d` actually runs and the stack flips
  from `sha-3a8f5b6` to the new SHA.
- `curl https://api.aisztens.hu/healthz` -> `{"status":"oks",...}`
- `/opt/aisztens/infra/.env` -> mode `600` (the "Tighten env on
  droplet" step now actually runs and chmods it).

## 6. Follow-ups

- The class of bug "action input silently renamed/removed in a minor
  version" is invisible in YAML lint, but a one-line test in the CI
  pipeline (run `actionlint` on the workflow files) would have caught
  this *and* the earlier parse-error PR. Add actionlint to `ci.yml`.
- The `appleboy/scp-action` step (`source:` list) silently also has
  quirks (cf. the earlier `chmod 600` -> `chmod 644` fix); a future
  action version bump should re-check that the source-list is still
  honoured and not renamed to `paths:` or similar.
- The "Tighten env on droplet" step from the previous fix is the one
  whose warning you would have seen disappear first; if it is still
  there, the fix did not land.
