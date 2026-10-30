<#
.SYNOPSIS
    init.ps1 - AI agent artefact sync (thin Windows PowerShell wrapper).

.DESCRIPTION
    Source of truth:
        - .roo/rules/*.md  -> concatenated into the agent instruction file
        - .roomodes        -> one artefact per project-level custom mode
          (authored in the Zoo Code UI; this script never writes that file)

    All rendering, writing and .gitignore bookkeeping lives in
    scripts/lib/agent-artifacts/generate.mjs, so this wrapper and its bash twin
    (scripts/init.sh) produce exactly the same bytes.

    Generates for ONE agent per run:
        1) GitHub Copilot -> .github/copilot-instructions.md
                             + .github/chatmodes/<slug>.chatmode.md per mode
        2) Cursor         -> .cursor/rules/project.mdc
                             + .cursor/commands/<slug>.md and .cursor/rules/<slug>.mdc per mode
        3) Claude Code    -> CLAUDE.md + .claude/agents/<slug>.md per mode

    Every generated file AND its .bak counterpart is appended to the
    ".gitignore" section of the same name (idempotently, no duplicates).

    Behaviour:
        - Interactive only (no CLI flags).
        - Idempotent: unchanged files are not rewritten.
        - A single .bak is kept next to each changed file.
        - Requires Node.js on PATH (the shared generator is a Node script).

.EXITCODE
    0 = success / user chose quit
    1 = fatal error (repo root not found, node missing, generator failure)
#>

[CmdletBinding()]
param(
    # Reserved for future flags. Interactive only for now.
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

$ScriptName     = 'init.ps1'
$RulesDir       = '.roo/rules'
$RoomodesFile   = '.roomodes'
$Generator      = 'scripts/lib/agent-artifacts/generate.mjs'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Info  { param([string]$Msg) Write-Host "[i] $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "[+] $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[!] $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) [Console]::Error.WriteLine("[x] $Msg") }

# Walk upwards to find the repository root (lets the script run from any
# subdirectory inside the monorepo).
function Resolve-RepoRoot {
    param([string]$StartDir)
    $dir = (Resolve-Path -LiteralPath $StartDir).ProviderPath
    while ($true) {
        if (Test-Path -LiteralPath (Join-Path $dir $RulesDir) -PathType Container) {
            return $dir
        }
        if (Test-Path -LiteralPath (Join-Path $dir $RoomodesFile) -PathType Leaf) {
            return $dir
        }
        # NOTE: Split-Path has no -LiteralPath in Windows PowerShell 5.1.
        $parent = Split-Path -Path $dir -Parent
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $dir) {
            return $null
        }
        $dir = $parent
    }
}

# ---------------------------------------------------------------------------
# Interactive prompt
# ---------------------------------------------------------------------------

function Prompt-Agent {
    Write-Host ''
    Write-Info 'Melyik AI coding agentet használod?'
    Write-Host '   1) GitHub Copilot'
    Write-Host '   2) Cursor'
    Write-Host '   3) Claude Code'
    Write-Host '   q) Quit (kilépés, semmi nem változik)'
    Write-Host ''
    $choice = (Read-Host 'Válasz [1/2/3/q]').Trim()

    switch -Regex ($choice) {
        '^(1|copilot|Copilot|GITHUB|COPILOT)$' { return 'copilot' }
        '^(2|cursor|Cursor|CURSOR)$'           { return 'cursor' }
        '^(3|claude|Claude|CLAUDE)$'           { return 'claude' }
        '^(q|Q|quit|Quit)$'                    { return 'quit' }
        default {
            Write-Warn "Ismeretlen válasz: '$choice'. Újra kérdezem."
            return (Prompt-Agent)
        }
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

try {
    $repoRoot = Resolve-RepoRoot -StartDir (Get-Location).ProviderPath
    if (-not $repoRoot) {
        Write-Err "Nem találom a $RulesDir/ mappát vagy a $RoomodesFile fájlt. Futtasd a projekt gyökeréből."
        exit 1
    }
    Set-Location -LiteralPath $repoRoot
    Write-Info "Repo gyökér: $(Get-Location)"

    if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err 'A "node" nem érhető el a PATH-ban - a generátor Node-ot igényel.'
        exit 1
    }
    if (-not (Test-Path -LiteralPath $Generator -PathType Leaf)) {
        Write-Err "Hiányzó generátor: $Generator"
        exit 1
    }

    Write-Host ''
    Write-Host '--- Melyik AI agent? ---'
    $agent = Prompt-Agent
    if ($agent -eq 'quit') {
        Write-Info 'Kilépés, semmi nem változott.'
        exit 0
    }

    Write-Host ''
    Write-Host "--- Generálás ($agent) ---"
    & node $Generator --agent $agent
    if ($LASTEXITCODE -ne 0) {
        Write-Err 'A generálás sikertelen.'
        exit 1
    }

    Write-Host ''
    Write-Ok 'Kész.'
    Write-Info "Ne feledd: a forrás a $RulesDir/ és a $RoomodesFile - ne szerkeszd a generált fájlokat."
    Write-Info "Újrafuttatás: scripts/$ScriptName (vagy scripts/init.sh Linux/macOS alatt)."
}
catch {
    $failure = $_
    Write-Err "Váratlan hiba: $($failure.Exception.Message)"
    if ($failure.InvocationInfo) {
        Write-Err ("Hely: sor {0} - {1}" -f $failure.InvocationInfo.ScriptLineNumber, $failure.InvocationInfo.MyCommand)
    }
    exit 1
}
