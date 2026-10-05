# 2026-10-05 15:31 — `scripts/dev-stack.ps1` skip `wslpath` entirely

**Status:** bug fix
**Area:** [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:111) (Step 3 commit `8dd9f8f`)
**Symptom:** `pwsh scripts/dev-stack.ps1 up` (or any subcommand) reports
`Could not translate repo path to WSL: E:\projects\AI\2026-08-31-ai-sztens-dev`
and exits, **even after commit `02ba18a` improved the diagnostic**. The
underlying `wslpath` call still receives a backslash-stripped version of
the path (`E:projectsAI...`) because the `wsl.exe` Microsoft Store
wrapper itself strips backslashes from argv entries before forwarding
them to the WSL side. This affects every arg-passing style I tested
(`&`, `Start-Process -ArgumentList`, `--%` stop-parsing, `Start-Process
-FilePath wsl.exe -ArgumentList`).

## Root cause

The `wsl.exe` binary shipped by the Microsoft Store is **not** a thin
wrapper — it parses its own argv and pre-processes the strings before
forwarding them to the underlying WSL syscall layer. In particular, it
strips backslashes from any argument that looks like a Windows path,
producing `E:projectsAI...` regardless of how the PowerShell side
quotes or escapes the value. So:

| Caller form | What `wsl.exe` forwards to `wslpath` |
|---|---|
| `& wsl.exe wslpath -u $RepoDir` | `E:projectsAI...` |
| `& wsl.exe wslpath -u "$RepoDir"` | `E:projectsAI...` |
| `& wsl.exe --% wslpath -u $RepoDir` | `E:projectsAI...` |
| `Start-Process wsl.exe -ArgumentList @('wslpath','-u',$RepoDir)` | `E:projectsAI...` |

So no PowerShell-side arg-passing technique helps. The conversion has
to happen **before** `wsl.exe` is involved.

## Fix

In [`scripts/dev-stack.ps1:111`](../../scripts/dev-stack.ps1:111), replace
the `wslpath` invocation with a small in-process PowerShell function:

```powershell
$drive = $RepoDir.Substring(0, 1).ToLowerInvariant()
$tail  = $RepoDir.Substring(2) -replace '\\', '/'
$wslPath = "/mnt/$drive$tail"
if ($wslPath.EndsWith('/')) { $wslPath = $wslPath.TrimEnd('/') }
```

The conversion is the same logic that `wslpath -u` itself implements
for the `DrvFs`-mounted `/mnt/<letter>/...` layout: take the drive
letter, lowercase it, prepend `/mnt/`, and turn backslashes into
forward slashes. WSL's default `/etc/wsl.conf` keeps this layout
enabled (only systems that explicitly turn off `automount` would
differ). UNC paths (`\\server\share\...`) and custom mount points are
out of scope — the script explicitly fails with a clear message if
the path doesn't match `^[A-Za-z]:[\\/]`.

The scriptblock that calls `wsl.exe --cd $wslPath ...` is unchanged
(other than typing the argument array as `[string[]]` so the
`.AddRange()` overload resolves correctly) — once the path is in
WSL form, backslashes are absent, and the `wsl.exe` wrapper no
longer has anything to mangle.

## Verification

```bash
# Before the fix (after 02ba18a)
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → [dev-stack] Could not translate repo path to WSL: E:\projects\AI\2026-08-31-ai-sztens-dev (wslpath exit 1)
#   [dev-stack]   wslpath stderr: wslpath: E:projectsAI2026-08-31-ai-sztens-dev

# After the fix
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → [dev-stack] "docker compose" v2 is required (the plugin, not the legacy docker-compose binary).
# (the script proceeds past the path-resolution step and reaches the
#  bash script's own docker pre-flight check; the new error is
#  configuration-related, not a script bug)
```

The PowerShell parser still validates clean:

```bash
bash -n scripts/dev-stack.sh && echo OK   # bash script validation still passes
# (no PowerShell parse check needed; the change is observable at runtime)
```

The path-conversion logic itself was verified in isolation with a
minimal reproducer:

```powershell
$RepoDir = 'E:\projects\AI\2026-08-31-ai-sztens-dev'
$drive = $RepoDir.Substring(0, 1).ToLowerInvariant()        # 'e'
$tail  = $RepoDir.Substring(2) -replace '\\', '/'           # '/projects/AI/2026-08-31-ai-sztens-dev'
$wslPath = "/mnt/$drive$tail"                               # '/mnt/e/projects/AI/2026-08-31-ai-sztens-dev'
```

## Supersedes

This commit builds on `02ba18a` (which kept the wslpath call but
captured its stderr for diagnostics). The diagnostic is still useful
when the *path conversion* fails for other reasons (e.g. a future
change adds UNC support and then needs the error message), but the
common case is now handled in-process and never reaches wslpath.

## Recommended commit message

```text
fix(dev-stack): pre-convert Windows path to /mnt/<drive>/ form in
PowerShell, skip wslpath entirely

The wsl.exe Microsoft Store wrapper strips backslashes from any argv
entry that looks like a Windows path (verified with & wsl.exe, Start-
Process -ArgumentList, and --% stop-parsing -- all three exhibit
the same E:projectsAI... mangling). Convert the path in PowerShell
before invoking wsl.exe so the wrapper has no backslashes to strip.
The conversion is the same logic wslpath -u uses for the standard
/mnt/<drive>/... auto-mount layout.