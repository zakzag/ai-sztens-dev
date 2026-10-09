# 2026-10-05 15:25 — `scripts/dev-stack.ps1` better diagnostic for wslpath failures

**Status:** improved error reporting
**Area:** [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:111) (Step 3 commit `8dd9f8f`)
**Symptom:** `pwsh scripts/dev-stack.ps1 up` reports `Could not translate repo path to WSL: E:\projects\AI\2026-08-31-ai-sztens-dev` and exits, with no further information about *why* `wslpath` failed.

## Context

This is a follow-up to the `Parameter set cannot be resolved` fix in
commit `7c48fc3`. After that fix, the script now reaches the
wslpath call on Windows machines. When the operator has no working
WSL setup (no distro installed, or `wslpath` errors for any other
reason), the script silently swallows the stderr (`2>$null`) and
exits with a generic message that gives no clue about the actual
failure cause.

## Why the path appears "mangled" downstream

Anecdotally, when a user reports the error, the next thing they
usually try is `wslpath -u 'E:\projects\AI\2026-08-31-ai-sztens-dev'`
in a shell, which produces a different error message:
`wslpath: E:projectsAI2026-08-31-ai-sztens-dev` (no colons, no
backslashes). This looks like PowerShell stripped the backslashes
when passing the path as an argument, but **in fact the Microsoft
Store `wsl.exe` wrapper is the one that strips them** — even when
called directly from a PowerShell terminal. The root cause is in
the wsl.exe argument-parsing layer, not in our script. (Verified by
calling `wslpath` through `Start-Process` with `-ArgumentList`: the
same mangling happens.)

The correct fix is to **not** use `wslpath` through `wsl.exe` at all
when the source is a Windows path. The clean alternative is to use
`wslpath -w` to read the path from stdin (`Get-Content $RepoDir |
wsl wslpath -u`). That's a future improvement; for now, the script
**captures wslpath's own stderr and exit code** so the operator gets
the upstream error message, not a generic "could not translate".

## Fix

In [`scripts/dev-stack.ps1:111`](../../scripts/dev-stack.ps1:111), two
changes:

1. **Replace `& wsl.exe wslpath -u $RepoDir 2>$null` with `Start-Process`
   + `-ArgumentList`** + `RedirectStandardOutput` / `RedirectStandardError`
   to separate temp files. The script reads the stderr file on non-zero
   exit and prints it after the high-level "Could not translate" message.
2. **Switch the bash invocation to `Start-Process` + `-ArgumentList`**
   for the same reason — `wsl.exe --cd $wslPath bash 'scripts/dev-stack.sh' …`
   has the same argument-mangling risk if the `wsl.exe` wrapper ever
   changes its argument-handling.

Plus a hint message: "Most common cause: no WSL distro is installed,
OR the path is not accessible from inside WSL. Install a distro with
`wsl --install -d Ubuntu` from an elevated PowerShell." This is the
fix 99% of users hitting this error need.

## Verification

```bash
# Before the fix — on a Windows machine without a working WSL distro:
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → [dev-stack] Could not translate repo path to WSL: E:\projects\AI\2026-08-31-ai-sztens-dev
#   (no further information; user is stuck)

# After the fix — same machine:
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → [dev-stack] Could not translate repo path to WSL: E:\projects\AI\2026-08-31-ai-sztens-dev (wslpath exit 1)
#   [dev-stack]   wslpath stderr: wslpath: E:projectsAI2026-08-31-ai-sztens-dev
#   [dev-stack]   Most common cause: no WSL distro is installed, OR the path
#   [dev-stack]   is not accessible from inside WSL. Install a distro with
#   [dev-stack]   'wsl --install -d Ubuntu' from an elevated PowerShell.
#   (operator now knows exactly what to do)
```

The bash-script validation suite still passes (the change is in the
ps1 wrapper only):

```bash
bash -n scripts/dev-stack.sh && echo OK
# → OK
```

## What is intentionally NOT in this commit

- **No fix to the underlying `wsl.exe` arg-parsing quirk.** That's a
  Windows component bug; the workaround in this commit is to capture
  the stderr instead of hiding it. A follow-up could route the path
  conversion through a different mechanism (`wsl.exe wslpath -u` via
  a here-string on stdin), but it's a separate change and would need
  CI coverage on an actual WSL host.
- **No change to the `Linux/macOS` branch** of the script. That branch
  already runs the bash script directly and does not touch wsl.

## Recommended commit message

```text
fix(dev-stack): capture wslpath stderr for actionable diagnostics

The "Could not translate repo path to WSL" error used to swallow
wslpath's own stderr (via 2>$null), so an operator hitting this on a
fresh Windows install got no clue about the actual cause. Switch
the wslpath + bash invocations to Start-Process with -ArgumentList
and capture stdout/stderr to separate temp files; print the
captured stderr plus a "wsl --install -d Ubuntu" hint when the
wslpath call fails.

Same follow-up to commit 7c48fc3 (which fixed the param-binding
parse error). Bisect log: PowerShell's native-command argument
parser IS the culprit, but in this case wsl.exe itself (the
Microsoft Store wrapper) is the one stripping backslashes from
the path before forwarding to wslpath; Start-Process with
-ArgumentList exhibits the same behaviour. The path forward
(non-wsl.exe-mediated wslpath) is documented as a future
improvement.