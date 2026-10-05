<#
.SYNOPSIS
    dev-stack.ps1 - bring up the local AIsztens stack from Windows PowerShell.

.DESCRIPTION
    Thin wrapper around scripts/dev-stack.sh. The real work lives in bash
    (Docker Compose v2 + set -euo pipefail are easier to express there).
    From a Windows terminal with WSL integration enabled, this script:

      1. Resolves the repo (the script can be invoked from any cwd).
      2. Verifies WSL is available and the repo is reachable from inside
         the default distro (Windows path \\wsl$\<Distro>\...).
      3. Calls `bash scripts/dev-stack.sh <subcommand>` inside the WSL
         working dir.
      4. Mirrors the exit code.

    The bash script owns the implementation; this file exists so that
    `pwsh scripts/dev-stack.ps1 up` Just Works for everyone on the team.

    Subcommands are passed through verbatim: up, down, ps, logs, restart.
    Pass `--help` (or no args + this header) for usage.

.PARAMETER Subcommand
    The action to perform. Defaults to 'up'.

.EXAMPLE
    pwsh scripts/dev-stack.ps1 up
    # Bring the stack up (seed infra/.env.local on first run, then compose up).

.EXAMPLE
    pwsh scripts/dev-stack.ps1 logs api
    # Tail the api container's logs.

.EXAMPLE
    pwsh scripts/dev-stack.ps1 down
    # Stop the stack (preserves Postgres data volume).

.EXITCODE
    0 = success
    non-zero = bubbled up from bash / docker
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'ps', 'logs', 'restart', 'help', '--help', '-h')]
    [string]$Subcommand = 'up',

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = 'Stop'

function Write-Info { param([string]$Msg) Write-Host "[dev-stack] $Msg" -ForegroundColor Cyan }
function Write-Err  { param([string]$Msg) [Console]::Error.WriteLine("[dev-stack] $Msg") }

# ---------------------------------------------------------------------------
# Resolve the repo root (this script's parent directory).
#
# `Split-Path -LiteralPath $null` is the root cause of the
# "Parameter set cannot be resolved" error that started appearing on
# `pwsh scripts/dev-stack.ps1 up`: when [CmdletBinding()] is in play and
# the script is invoked in certain contexts (notably under `pwsh -File`
# with PowerShell 5.x), `$MyInvocation.MyCommand.Path` AND
# `$PSCommandPath` can both be $null. Feeding $null into the
# `-LiteralPath` parameter of `Split-Path` (or `Resolve-Path`,
# `Get-Item` etc.) raises a ParameterBindingException with that exact
# message.
#
# Fix: use the positional form (which goes through the default
# `-Path` parameter set, where $null is accepted and produces a clean
# "path is null" failure later), and add an explicit null-guard that
# exits with a useful diagnostic rather than continuing with a bad path.
# ---------------------------------------------------------------------------
$ScriptPath = $MyInvocation.MyCommand.Path
if (-not $ScriptPath) {
    # MyCommand.Path is null when the script is piped; fall back to PSScriptRoot.
    $ScriptPath = $PSCommandPath
}
if ([string]::IsNullOrEmpty($ScriptPath)) {
    # Neither $MyInvocation.MyCommand.Path nor $PSCommandPath was populated.
    # Common cause: the script is run from a context that does not expose
    # its own path (e.g. certain `Invoke-Command` invocations). Refuse
    # to start with an unambiguous error instead of failing at the next
    # Split-Path call with a confusing ParameterBindingException.
    Write-Err 'FATAL: cannot determine the script path ($MyInvocation.MyCommand.Path and $PSCommandPath are both empty).'
    Write-Err '       Invoke this script directly with `pwsh scripts/dev-stack.ps1 up`, or'
    Write-Err '       call & { . scripts/dev-stack.ps1 } from a context where the script path is resolvable.'
    exit 1
}
$ScriptDir  = Split-Path $ScriptPath -Parent
$RepoDir    = (Resolve-Path (Join-Path $ScriptDir '..')).ProviderPath

# ---------------------------------------------------------------------------
# Find bash + WSL. On Linux/macOS PowerShell, bash is the natural interpreter
# and WSL does not apply. Detect both cases and behave accordingly.
# ---------------------------------------------------------------------------
$IsWsl = $false
try {
    $unameS = (& uname -s 2>$null)
    if ($unameS -and ($unameS -match 'Linux')) {
        # Could be native Linux OR WSL. Probe for the WSL marker.
        $procVersion = (Get-Content -LiteralPath '/proc/version' -ErrorAction SilentlyContinue) -join ''
        if ($procVersion -match 'microsoft|Microsoft') {
            $IsWsl = $true
        }
    }
} catch { }

$bashCmd = $null
if ($IsWindows -or $PSVersionTable.PSVersion.Major -le 5 -or ($env:OS -eq 'Windows_NT')) {
    # Windows PowerShell. Look for wsl.exe + the bash inside WSL.
    $wsl = (Get-Command 'wsl.exe' -ErrorAction SilentlyContinue)
    if (-not $wsl) {
        Write-Err 'WSL is not on PATH. Install WSL or run this from inside a WSL terminal.'
        exit 1
    }
    # Convert the Windows-side repo path to a WSL-side path.
    #
    # We do this conversion ourselves in PowerShell (no wslpath
    # involved) because the Microsoft Store wsl.exe binary eats
    # backslashes when forwarding argv entries: `& wsl.exe wslpath
    # -u "E:\projects\AI\..."` receives `E:projectsAI...` regardless
    # of how the Windows-side argument is quoted, escaped, or
    # passed (verified with `& wsl.exe ...`, `Start-Process
    # -ArgumentList`, and `--%` stop-parsing -- all three exhibit
    # the same mangling). So we skip the cross-process conversion
    # entirely and compute the WSL mount-path manually.
    #
    # WSL's standard auto-mount layout is /mnt/<drive-letter>/...
    # for Windows drives, with the drive letter lower-cased and the
    # backslashes turned into forward slashes. UNC paths
    # (\\server\share\...) would need a different layout but this
    # script targets a local repo, so /mnt/<x>/ is sufficient.
    if ($RepoDir -notmatch '^[A-Za-z]:[\\/]') {
        Write-Err "Repo path '$RepoDir' is not a Windows drive-letter path; cannot convert to WSL form."
        Write-Err "Use the bash entry point ('scripts/dev-stack.sh up') directly inside WSL instead."
        exit 1
    }
    $drive = $RepoDir.Substring(0, 1).ToLowerInvariant()
    $tail  = $RepoDir.Substring(2) -replace '\\', '/'
    $wslPath = "/mnt/$drive$tail"
    # wsl.exe --cd is confused by trailing slashes on some builds.
    if ($wslPath.EndsWith('/')) { $wslPath = $wslPath.TrimEnd('/') }
    # We invoke the bash script via wsl.exe so the caller's Windows terminal
    # stays the source of truth (PATH, exit code, output streams).
    $bashCmd = {
        # Build the wsl.exe argument list fresh each time so $Subcommand
        # and $RemainingArgs are captured at invocation, not at scriptblock
        # definition time. The @-splat operator can't appear inside an
        # expression, so we build the array in two steps.
        $argsLocal = [System.Collections.Generic.List[string]]::new()
        [void]$argsLocal.AddRange([string[]]@('--cd', $wslPath, 'bash', 'scripts/dev-stack.sh', $Subcommand))
        foreach ($a in $RemainingArgs) { [void]$argsLocal.Add($a) }
        $proc = Start-Process -FilePath 'wsl.exe' `
            -ArgumentList $argsLocal `
            -NoNewWindow -Wait -PassThru
        exit $proc.ExitCode
    }
} else {
    # Native Linux/macOS bash; just call the script directly.
    $bashScript = Join-Path $RepoDir 'scripts/dev-stack.sh'
    if (-not (Test-Path -LiteralPath $bashScript -PathType Leaf)) {
        Write-Err "Missing $bashScript"
        exit 1
    }
    $bashCmd = { & $bashScript $Subcommand @RemainingArgs }
}

# ---------------------------------------------------------------------------
# Invoke + bubble the exit code.
# ---------------------------------------------------------------------------
try {
    & $bashCmd
    $rc = $LASTEXITCODE
    if ($rc -ne 0) {
        exit $rc
    }
} catch {
    Write-Err $_.Exception.Message
    exit 1
}