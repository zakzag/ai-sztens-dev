#Requires -Version 5.1
<#
.SYNOPSIS
    Windows entry point for scripts/env-test/check-env-syntax.sh.

.DESCRIPTION
    Thin wrapper. It locates a POSIX bash (Git for Windows / MSYS2), converts
    the script path to the /e/... form bash understands, runs it as a child of
    THIS console (no throwaway window), and forwards the exit code unchanged.
    Arguments are passed through verbatim.

    The real logic lives in check-env-syntax.sh — this file exists so that
    `pwsh scripts/env-test/check-env-syntax.ps1` Just Works on Windows.

.EXAMPLE
    pwsh scripts/env-test/check-env-syntax.ps1
    # Run the offline syntax/consistency checks.

.EXAMPLE
    pwsh scripts/env-test/check-env-syntax.ps1 --help

.NOTES
    Offline only — no network access. See scripts/env-test/README.md.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]] $CheckArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path -Parent $scriptDir
$repoDir = Split-Path -Parent $scriptsDir
$targetSh = Join-Path $scriptDir 'check-env-syntax.sh'

function Write-EnvTestInfo {
    param([Parameter(Mandatory)][string] $Message)
    Write-Host "[env-test] $Message"
}

function Write-EnvTestFail {
    param([Parameter(Mandatory)][string] $Message)
    Write-Host "[env-test] $Message" -ForegroundColor Red
}

function ConvertTo-PosixPath {
    param([Parameter(Mandatory)][string] $Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLowerInvariant()
        $rest = $Matches[2] -replace '\\', '/'
        return "/$drive/$rest"
    }
    return ($full -replace '\\', '/')
}

function Find-PosixBash {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git -and $git.Source) {
        $gitRoot = Split-Path -Parent (Split-Path -Parent $git.Source)
        $candidate = Join-Path $gitRoot 'bin\bash.exe'
        if (Test-Path -LiteralPath $candidate) { return @{ Path = $candidate; Wsl = $false } }
    }

    $roots = @()
    foreach ($base in @(
            [Environment]::GetEnvironmentVariable('ProgramFiles'),
            [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),
            'C:\Progs',
            'C:\Programs',
            'C:\'
        )) {
        if ($base) { $roots += (Join-Path $base 'Git') }
    }
    $localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ($localAppData) { $roots += (Join-Path $localAppData 'Programs\Git') }
    $roots += @('C:\Progs\msys64', 'C:\msys64', 'C:\Progs\msys', 'C:\msys')

    foreach ($root in $roots) {
        foreach ($sub in @('bin\bash.exe', 'usr\bin\bash.exe')) {
            if (-not $root) { continue }
            $candidate = Join-Path $root $sub
            if (Test-Path -LiteralPath $candidate) { return @{ Path = $candidate; Wsl = $false } }
        }
    }

    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash -and $bash.Source) {
        $isWslStub = $bash.Source -like '*\WindowsApps\bash.exe'
        return @{ Path = $bash.Source; Wsl = $isWslStub }
    }

    return $null
}

if (-not (Test-Path -LiteralPath $targetSh)) {
    Write-EnvTestFail "cannot find $targetSh"
    exit 1
}

$bash = Find-PosixBash
if (-not $bash) {
    Write-EnvTestFail 'no bash found. Install Git for Windows (recommended) or MSYS2, then re-run.'
    exit 1
}
if ($bash.Wsl) {
    Write-EnvTestFail 'the only bash on PATH is the WSL stub. Install Git for Windows / MSYS2,'
    Write-EnvTestFail 'or run check-env-syntax.sh from inside your WSL distribution instead.'
    exit 1
}

$posixSh = ConvertTo-PosixPath $targetSh
Write-EnvTestInfo "bash: $($bash.Path)"
Write-EnvTestInfo "script: $posixSh $($CheckArgs -join ' ')"

$exitCode = 0
Push-Location -LiteralPath $repoDir
try {
    & $bash.Path $posixSh @CheckArgs
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    Write-EnvTestFail "check-env-syntax.sh exited with code $exitCode"
}
exit $exitCode
