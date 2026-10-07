#Requires -Version 5.1
<#
.SYNOPSIS
    Windows entry point for deploy/deploy.sh.

.DESCRIPTION
    A `.sh` file has no executable meaning on Windows. Typing
    `deploy/deploy.sh up` in PowerShell (or double-clicking the file in
    Explorer) resolves through the Shell file association registered by
    Git for Windows:

        "C:\Programs\Git\git-bash.exe" --no-cd "%L" %*

    That opens a NEW, throwaway terminal window and hands bash a backslash
    Windows path it cannot resolve:

        E:projects...devdeploydeploy.sh: command not found

    The window closes before the message can be read, so a failed deploy looks
    like "nothing happened, no error shown".

    This wrapper avoids the association completely. It:
      * locates a real bash (Git for Windows or MSYS2 - NOT the WSL stub);
      * converts the script path to a POSIX path bash understands;
      * runs bash as a child of THIS console, so stdout/stderr stream here
        in real time and no extra window is opened;
      * forwards the exit code of deploy.sh unchanged;
      * on failure, prints the tail of deploy/log/latest.log and waits for
        Enter, so a window started by a double-click stays readable.

.PARAMETER DeployArgs
    Arguments forwarded verbatim to deploy.sh:
        <command> [dev|prod] [--verbose]

    The optional target selects which env file deploy.sh loads
    (deploy/.env.dev by default, deploy/.env.prod for prod) and becomes the
    APP_ENV that drives infra/.env.<target>, the SPA build mode and the compose
    --env-file.

.EXAMPLE
    .\deploy\deploy.ps1 up            # the dev droplet (default target)

.EXAMPLE
    .\deploy\deploy.ps1 up prod       # the prod droplet (needs deploy/.env.prod)

.EXAMPLE
    .\deploy\deploy.ps1 ps dev --verbose

.EXAMPLE
    .\deploy\deploy.ps1 logs

.NOTES
    Set DEPLOY_NO_PAUSE=1 to suppress the final "press Enter" prompt
    (needed in CI, where there is no console to read from).

    Every run is logged by deploy.sh into deploy/log/, newest run:
    deploy/log/latest.log.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]] $DeployArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Split-Path -Parent $scriptDir
$deploySh = Join-Path $scriptDir 'deploy.sh'
$logDir = Join-Path $scriptDir 'log'

function Write-DeployInfo {
    param([Parameter(Mandatory)][string] $Message)
    Write-Host "[deploy.ps1] $Message"
}

function Write-DeployFail {
    param([Parameter(Mandatory)][string] $Message)
    Write-Host "[deploy.ps1] $Message" -ForegroundColor Red
}

<#
.SYNOPSIS
    Converts a Windows path to the POSIX path a MSYS/Git-Bash binary expects.
.EXAMPLE
    ConvertTo-PosixPath 'E:\projects\x\deploy.sh'  ->  /e/projects/x/deploy.sh
#>
function ConvertTo-PosixPath {
    param([Parameter(Mandatory)][string] $Path)

    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLowerInvariant()
        $rest = $Matches[2] -replace '\\', '/'
        return "/$drive/$rest"
    }
    # UNC (\server\share\...) and anything unexpected: only normalise slashes.
    return ($full -replace '\\', '/')
}

<#
.SYNOPSIS
    Finds a POSIX bash that understands the /e/... path form.
.DESCRIPTION
    Returns a hashtable with Path and Wsl. Wsl=$true means the only bash on
    PATH is the Windows Store WSL stub (C:\...\WindowsApps\bash.exe), which
    needs `wsl.exe` semantics and /mnt/<drive> paths and is deliberately NOT
    used by this wrapper - see the caller for the guidance it prints.
#>
function Find-PosixBash {
    # 1. Derive it from the git.exe that is actually on PATH:
    #    <root>\cmd\git.exe  ->  <root>\bin\bash.exe
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git -and $git.Source) {
        $gitRoot = Split-Path -Parent (Split-Path -Parent $git.Source)
        $candidate = Join-Path $gitRoot 'bin\bash.exe'
        if (Test-Path -LiteralPath $candidate) {
            return @{ Path = $candidate; Wsl = $false }
        }
    }

    # 2. Well-known Git for Windows / MSYS2 / MSYS install roots. The env vars
    #    are read through .NET so that a missing one is simply $null instead of
    #    a strict-mode error.
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
            if (Test-Path -LiteralPath $candidate) {
                return @{ Path = $candidate; Wsl = $false }
            }
        }
    }

    # 3. Last resort: whatever `bash` resolves to on PATH.
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash -and $bash.Source) {
        $isWslStub = $bash.Source -like '*\WindowsApps\bash.exe'
        return @{ Path = $bash.Source; Wsl = $isWslStub }
    }

    return $null
}

if (-not (Test-Path -LiteralPath $deploySh)) {
    Write-DeployFail "cannot find $deploySh"
    exit 1
}

$bash = Find-PosixBash
if (-not $bash) {
    Write-DeployFail 'no bash found. Install Git for Windows (recommended) or MSYS2,'
    Write-DeployFail 'then re-run this wrapper. See deploy/README.md.'
    exit 1
}
if ($bash.Wsl) {
    Write-DeployFail 'the only bash on PATH is the WSL stub, which cannot use this'
    Write-DeployFail 'repository checkout directly. Install Git for Windows or MSYS2, or run'
    Write-DeployFail './deploy/deploy.sh from inside your WSL distribution instead.'
    exit 1
}

$posixDeploySh = ConvertTo-PosixPath $deploySh
Write-DeployInfo "bash: $($bash.Path)"
Write-DeployInfo "script: $posixDeploySh $($DeployArgs -join ' ')"

# Run bash as a child process of this console. Passing the script as a single
# argv entry means arguments are forwarded verbatim - no quoting or escaping
# layer that could mangle them.
$exitCode = 0
Push-Location -LiteralPath $repoDir
try {
    & $bash.Path $posixDeploySh @DeployArgs
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

$latestLog = Join-Path $logDir 'latest.log'

if ($exitCode -ne 0) {
    Write-Host ''
    Write-DeployFail "deploy.sh exited with code $exitCode"

    if (Test-Path -LiteralPath $latestLog) {
        Write-DeployFail "last 40 lines of $latestLog"
        Write-Host '------------------------------------------------------------------'
        # -Encoding UTF8 is required: deploy.sh writes the log as UTF-8, while
        # Windows PowerShell 5.1 defaults Get-Content to the ANSI code page and
        # would render "—" as mojibake.
        Get-Content -LiteralPath $latestLog -Tail 40 -Encoding UTF8 |
            ForEach-Object { Write-Host $_ }
        Write-Host '------------------------------------------------------------------'
    }
    else {
        Write-DeployInfo "no log at $latestLog - the run died before logging started"
    }

    # A window opened by a double-click disappears the moment the script ends,
    # so hold it open when (and only when) there is an interactive console.
    $interactive = $Host.Name -eq 'ConsoleHost' -and -not [Console]::IsInputRedirected
    if ($interactive -and -not $env:DEPLOY_NO_PAUSE) {
        Write-Host ''
        Read-Host 'Press Enter to close' | Out-Null
    }
}
else {
    Write-DeployInfo "ok (exit 0). Log: $latestLog"
}

exit $exitCode
