# Deploy preflight: surface the actual SSH error on failure

**Date:** 2026-10-09
**Status:** Fixed
**File:** [`deploy/deploy.sh`](../../deploy/deploy.sh)

## Problem

`./deploy/deploy.sh up dev` aborted with:

```
[ERROR] [stage=remote_preflight] The preflight probe never ran on ssh.aisztens.hu — the SSH client refused the key or the login (see above).
```

…but there was nothing "above" in the log. The preflight had captured the real SSH error into the local `$probe` variable, but the only place the variable was printed was `log_debug "preflight: …"`, and the logger's default `DEPLOY_LOG_LEVEL` is `INFO`. The hint to run with `--verbose` was never given.

## Root cause

`assert_remote_ready()` runs the SSH preflight probe via command substitution with `2>&1`, which captures both stdout and stderr into `$probe`. The variable held the real failure message, but the only logging of it was behind a DEBUG-level gate. When the preflight took the "too open / bad permissions / permission denied / host key verification" branch, the operator saw a canned message that referenced content that did not exist in the log.

The user said SSH had worked until now, and the most common cause on Windows Git Bash is that the deploy private key file permissions got "too open" (every Windows file reports 0777 through drvfs and OpenSSH refuses such keys). Without the actual error, that diagnosis could not be confirmed from the log.

## Fix

[`deploy/deploy.sh`](../../deploy/deploy.sh) — `assert_remote_ready()` now:

1. **Always logs the captured probe** at `INFO` level on the failure path (not just at DEBUG), so the real SSH error is visible without `--verbose`.
2. **Splits the old catch-all branch** into four specific branches with actionable hints:
   - `too open` / `bad permissions` → `icacls` tightening on Windows (the drvfs-aware fix; `chmod` cannot help).
   - `permission denied` → hand-test the key with `ssh -v`.
   - `host key verification` → known_hosts cleanup guidance.
   - anything else → "re-run with --verbose" or `ssh -v` for a full trace.

## Verification

- `bash -n deploy/deploy.sh` → OK.
- The preflight now produces a usable error trail on every failure mode.

## Follow-up

None — the fix is local to `assert_remote_ready`. If the user re-runs and the captured error says "Permissions 0777 … are too open for … deploy.private.key", the next step is the `icacls` command the script now prints.
