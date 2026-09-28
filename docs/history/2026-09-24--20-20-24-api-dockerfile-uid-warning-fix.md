# 2026-09-24 — API Dockerfile uid warning fix

## Context

While inspecting the output of `./deploy/deploy.sh up`, the api image build
emitted the following non-fatal warning during the runtime stage:

```
#37 [api runtime 8/8] RUN groupadd --system --gid 1001 nodeapp \
                      && useradd --system --uid 1001 --gid nodeapp ... nodeapp \
                      && chown -R nodeapp:nodeapp /workspace
#37 0.778 useradd warning: nodeapp's uid 1001 is greater than SYS_UID_MAX 999
#37 DONE 155.6s
```

The user/group were still created successfully (build step completed), but the
warning makes the deploy log noisy and can be misread as an error.

## Cause

Debian's `useradd` refuses `UID > 999` for system users by default
(`SYS_UID_MAX=999`). The previous Dockerfile used `1001` to avoid the
well-known collisions on many hosts (`UID 1000` is usually the first
non-system user), but on Debian-bookworm-slim that is outside the allowed
system-uid range, hence the warning.

## Change

- `infra/app/Dockerfile` — `groupadd` gid and `useradd` uid lowered from
  `1001` to `999` so they fall inside `SYS_UID_MAX`. No other references to
  the uid/gid exist anywhere in the repo (verified by grep), so this is a
  pure single-file edit.

## Verification (next `./deploy/deploy.sh up`)

- Build step `#37` should no longer print the `useradd warning:` line.
- Container should still start and run as the `nodeapp` user, identical
  behaviour to before. The runtime stage does not bind-mount anything by
  uid, so host-side ownership is unaffected.

## Files touched

- `infra/app/Dockerfile`
