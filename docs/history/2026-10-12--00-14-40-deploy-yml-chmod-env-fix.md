# 2026-10-12 00:14 — deploy.yml chmod 600 -> 644 + re-tighten on droplet

## Problem

After the previous fix (deploy.yml parse errors) the workflow file parsed
and the first deploy step (`appleboy/scp-action@v0.1.7`) ran, but failed
inside the action's container with:

```
tar all files into /tmp/AWRacuBkDG.tar.gz
tar: can't open 'infra/.env': Permission denied
exit status 1
```

## Root cause

Step 3 of `deploy.yml` writes `infra/.env` from the `INFRA_ENV_*` secret
and then `chmod 600`s it. The next step is `appleboy/scp-action@v0.1.7`,
which pre-packs the `source:` paths with `tar` *inside a container that
runs under a different uid than the runner* (the action ships its own
docker image). The tar process therefore cannot read a `0600` file
owned by the runner uid, and the whole scp step aborts.

This is a new failure mode that only surfaces once the workflow file
parses correctly. It is not a regression of the previous fix.

## Fix

Two changes, both in `.github/workflows/deploy.yml`:

1. **Step 3 — relax the chmod from 600 to 644** so the scp-action's tar
   can pack the file. The runner filesystem is ephemeral and
   process-scoped, so the trade-off (vs. 600) is acceptable for the few
   seconds between writing and shipping. Updated the surrounding comment
   to document why we do this and to point at the compensating step 5a.
2. **New step 5a — "Tighten infra/.env permissions on the droplet"**,
   an `appleboy/ssh-action@v1.0.3` call right after the scp step that
   `chmod 600`s `infra/.env` on the droplet. This restores the
   `deploy/README.md` "owner-only readable" posture before any
   subsequent step (or any other user on the host) reads the file.
   The step is deliberately a no-op for `docker-compose.yml` and
   `Caddyfile.rendered` — only the .env carries secrets.

## Verification

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(ci): chmod 0644 infra/.env before scp, 0600 again on droplet"
git push origin dev
```

On the next deploy run, the "Tighten infra/.env permissions on the
droplet" step should log:

```
infra/.env on droplet is now mode 600 (was 644 after scp; 600 is the deploy/README.md convention).
```

and the full pipeline should now run green. The droplet should pick up
`sha-c0d7293` (or the new sha of the workflow-fix commit) and the live
sites should serve the updated strings.
