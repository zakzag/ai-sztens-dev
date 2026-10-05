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
# ---------------------------------------------------------------------------
$ScriptPath = $MyInvocation.MyCommand.Path
if (-not $ScriptPath) {
    # MyCommand.Path is null when the script is piped; fall back to PSScriptRoot.
    $ScriptPath = $PSCommandPath
}
$ScriptDir  = Split-Path -LiteralPath $ScriptPath -Parent
$RepoDir    = (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..')).ProviderPath

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
    # Convert the Windows-side repo path to the WSL-side path.
    $wslPath = (& wsl.exe wslpath -u $RepoDir 2>$null)
    if (-not $wslPath) {
        Write-Err "Could not translate repo path to WSL: $RepoDir"
        exit 1
    }
    # We invoke the bash script via wsl.exe so the caller's Windows terminal
    # stays the source of truth (PATH, exit code, output streams).
    $bashCmd = { & wsl.exe --cd $wslPath bash 'scripts/dev-stack.sh' $Subcommand @RemainingArgs }
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