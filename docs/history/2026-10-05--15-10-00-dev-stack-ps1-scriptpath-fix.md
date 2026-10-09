# 2026-10-05 15:10 — `scripts/dev-stack.ps1` `Parameter set cannot be resolved` fix

**Status:** bad input parameter
**Area:** [`scripts/dev-stack.ps1`](../../scripts/dev-stack.ps1:60) (Step 3 commit `8dd9f8f`)
**Symptom:** `pwsh scripts/dev-stack.ps1 up` (and any subcommand) fails
with `Parameter set cannot be resolved using the specified named parameters.
One or more parameters issued cannot be used together or an insufficient
number of parameters were provided.` from the script itself (not from a
nested cmdlet), before any `[dev-stack]` banner prints.

## Diagnosis

Bisecting down from the param block (which works fine when isolated,
see the four `scripts/test-params-*.ps1` reproductions in the bisection log
that have since been deleted) showed the trigger:

```powershell
$ScriptPath = $MyInvocation.MyCommand.Path
if (-not $ScriptPath) {
    $ScriptPath = $PSCommandPath
}
$ScriptDir  = Split-Path -LiteralPath $ScriptPath -Parent
$RepoDir    = (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..')).ProviderPath
```

When the script is invoked via `pwsh -File` (which is what `pwsh
scripts/dev-stack.ps1 up` does under the hood) **with `[CmdletBinding()]`
in scope**, both `$MyInvocation.MyCommand.Path` and `$PSCommandPath` can
be `$null` (the latter is `$null` in scripts that opt into the advanced-
function semantics via `[CmdletBinding()]`). When `Split-Path
-LiteralPath $null` is then invoked, PowerShell's parameter binder has
both `-LiteralPath` (provided but `$null`) and `-Path` (positional,
unprovided) in play, neither of which is a clean mandatory-parameter
match, so it raises `ParameterBindingException` with that exact message.

The same bug propagates to `Resolve-Path` and `Join-Path` because they
have the same `-LiteralPath` / `-Path` parameter-set design.

## Fix

Two changes in [`scripts/dev-stack.ps1:60`](../../scripts/dev-stack.ps1:60):

1. **Positional `Split-Path` / `Join-Path` / `Resolve-Path`.** Without
   `-LiteralPath`, these go through the default `-Path` parameter set
   which **accepts** `$null` (the cmdlet then fails later with a normal
   "path is null" error if it actually tries to operate on it). The
   `-LiteralPath` flag is only useful when the path contains PowerShell
   wildcard characters; for an absolute path we control (we just
   resolved it from the script path), the positional form is correct.

2. **Explicit null-guard with a useful error message.** If both
   `$MyInvocation.MyCommand.Path` AND `$PSCommandPath` are empty,
   print a `FATAL:` line that names the missing context and exits with
   code 1 — instead of the cryptic binder message. Common trigger:
   `Invoke-Command { . scripts/dev-stack.ps1 }` from a session where the
   script path isn't resolvable.

The bug is a long-standing PowerShell pitfall in scripts that use
`[CmdletBinding()]` plus `$MyInvocation.MyCommand.Path`. The
`scripts/init.ps1` sibling uses `$MyCommand.Path` (without CmdletBinding)
and works fine on the same shell, which is consistent with the
diagnosis.

## Verification

```bash
# Before the fix
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → Parameter set cannot be resolved using the specified named parameters.
#   (no banner, no output)

# After the fix
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/dev-stack.ps1 up
# → [dev-stack] ← (Windows branch entered) ...
# → (no ParameterBindingException; the script now either proceeds to the
#    docker compose invocation, OR prints the FATAL diagnostic if the
#    path is unresolvable in the current context)
```

On this machine the new error path proceeds into the WSL branch and
hits a *different* downstream error (`wslpath: E:projectsAI…` — Windows
path's backslashes were lost when passing the string to a native
command). That's a separate, environment-specific issue (no real WSL
distro with a bash binary is installed) and is **not** the bug this
commit fixes.

## Why this wasn't caught by `bash -n`

`bash -n scripts/dev-stack.sh` validates the **bash** script, which is
the actual implementation. The PowerShell wrapper only enters the
picture on Windows / when the developer wants to run the stack without
opening a WSL terminal first. The CI / Linux / WSL flow never exercises
this file.

A future hardening step would add a `pwsh -NoProfile -File
scripts/dev-stack.ps1 --help` smoke to the test harness so this kind
of regression is caught pre-flight on PRs that touch the file.

## Recommended commit message

```text
fix(dev-stack): make ps1 wrapper tolerate null $ScriptPath

`Split-Path -LiteralPath $null` raised a ParameterBindingException
because with [CmdletBinding()] in scope, $MyInvocation.MyCommand.Path
and $PSCommandPath can both be $null under `pwsh -File`. Switch to
the positional form (uses the default -Path parameter set, accepts
$null) and add an explicit null-guard with a FATAL diagnostic that
exits 1 instead of continuing with a bad path.

Bisected and fixed after a user report on 2026-10-05.