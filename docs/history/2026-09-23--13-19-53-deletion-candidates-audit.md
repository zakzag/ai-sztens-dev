# Deletion-candidates audit — 2026-09-23

## Goal

Identify files and folders inside `E:\projects\AI\2026-08-31-ai-sztens-dev`
that are not functional parts of the **AIsztens** codebase and
should be removed. The investigation started from the user's observation
that the **MCP server** (`E:\projects\AI\2026-08-28-MCPs\`) tends to drop
files into whatever directory it is launched from, and from the suspicious
`$null` file living next to `package.json`.

## Methodology

1. Read project rules (`docs/history/`, `.roo/rules/*`) and the project's
   `package.json` + `pnpm-workspace.yaml` to learn what is considered part
   of the repo.
2. Read the MCP server source code
   (`packages/mcp-server/src/config/config.const.ts`,
   `packages/mcp-server/src/logging/request-logger.ts`,
   `packages/mcp-server/src/logging/logging-transport.ts`,
   `packages/mcp-server/src/config/config.helper.ts`) to determine which
   files it writes, and where it writes them.
3. List the workspace with `Get-ChildItem -Recurse` and cross-check with
   `git status --porcelain` to see which paths are tracked vs. ignored.
4. Inspect the content of suspicious files to confirm whether they are
   functional or artifacts.

## How the MCP server produces files outside its own repo

From `packages/mcp-server/src/config/config.const.ts` in the MCP repo:

- `DEFAULT_MCP_LOG_FILE = 'logs/mcp-messages.log'` (line 40)
- `DEFAULT_LOG_FILE = 'logs/app.log'` (line 45)
- `DEFAULT_MEMORY_DATA_DIR = 'data'` (line 27)
- `DEFAULT_MEMORY_TABLE = 'memories'` (line 28)

From `packages/mcp-server/src/logging/request-logger.ts` (lines 33–46) the
log file path is resolved relative to `process.cwd()` with
`pino.destination({ dest: config.mcpLog.filePath, sync: true, mkdir: true })`.

**Implication:** every time the MCP server is launched with this project's
root as `cwd`, it creates / appends to `logs/mcp-messages.log` here. If it
is launched with `scripts/packages/mcp-server/` as `cwd`, it creates
`logs/app.log` and `data/` there. There is no in-repo code that creates any
of these files; they are 100 % runtime artifacts of the MCP server.

## Functional files that MUST stay (do not touch)

These were checked and confirmed as real source / config / deploy content
the project needs:

- Everything under `apps/` (`admin`, `api`, `web`) — source code.
- Everything under `packages/shared/` — `@callback/shared` package.
- `infra/` (`docker-compose.yml`, `docker-compose.wsl.yml`,
  `app/Dockerfile`, `monitor/Dockerfile`, `caddy/Caddyfile`,
  `postgres/init/01-roles.sh`).
- `deploy/` scripts (`deploy.sh`, `bootstrap.sh`, `.env`, `.env.example`,
  `README.md`) and SSH keys (`deploy/ssh-keys/*.pub`).
- `scripts/test/` (`stack-up.sh`, `stack-down.sh`, `stack-smoke.sh`,
  `lib/*.sh`, `README.md`).
- `scripts/init.sh`, `scripts/init.ps1`, `scripts/test-syntax.ps1`.
- `docs/` (`01-callback-assistant.md`, `02-flowchart.md`,
  `03-implementation-general.md`, `Specs/**`, `prompts/**`,
  `history/**`).
- `.roo/`, `.github/`, `.vscode/settings.json` (the empty `{}` file is
  intentional — `.gitignore` keeps it but ignores the rest of `.vscode`).
- Root files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `README.md`, `.prettierrc`, `.gitignore`.

## Deletion candidates

> All paths are relative to `E:\projects\AI\2026-08-31-ai-sztens-dev`.
> Confidence: **H** = high (clearly an artifact, not part of the project),
> **M** = medium (almost certainly not needed but worth a final eyeball),
> **L** = low (judgment call — read the note before deleting).

### H — Definitely delete (MCP-server runtime artifacts + rogue file)

| # | Path | Why | Evidence |
|---|------|-----|----------|
| 1 | [`$null`]($null:1) | A 104-byte file in the workspace root containing only the PowerShell error message `'Select-Object' is not recognized as an internal or external command, operable program or batch file.` This was produced by the MCP server's `cmd_run` tool when it ran `Get-Item` / `Get-ChildItem` against cmd.exe instead of `powershell.exe` — the shell expanded the unquoted `$null` PowerShell variable to an empty string, then cmd redirected stderr into a file literally named `$null`. It is **not a PowerShell cmdlet, not a variable reference, not a redirect target** — it is a stray file the MCP server created on 2026-09-22 14:45:02. `git status` shows it as untracked (`?? $null`). | `Get-Item '$null'` → 104 bytes, last write 2026-09-22 14:45:02; content is one line of PowerShell stderr; `git status` → `?? $null` |
| 2 | [`logs/mcp-messages.log`](logs/mcp-messages.log:1) | Pino JSON-lines stream written by the MCP server's `RequestLogger` whenever the server runs with `cwd = this project's root`. Each line is an MCP traffic summary (initialize handshake, `tools/list`, `tools/call`, etc.). Already covered by `.gitignore` (`logs`, `*.log`) so it is not tracked, but it keeps growing and pollutes the tree. | `DEFAULT_MCP_LOG_FILE = 'logs/mcp-messages.log'` (config.const.ts:40); `pino.destination({ dest: config.mcpLog.filePath, … })` (request-logger.ts:37); `logs/` is in `.gitignore` |
| 3 | [`packages/mcp-server/logs/app.log`](packages/mcp-server/logs/app.log:1) | Pino file logger emitted by the MCP server's main `Logger` (`DEFAULT_LOG_FILE = 'logs/app.log'`) when the server was launched with `cwd = packages/mcp-server/`. Contains 6 "MCP server started over stdio" entries between 2026-09-22 14:35 and 2026-09-23 11:16 — pure startup noise. The `packages/mcp-server/` directory itself is empty placeholder workspace glue (see #5). | `DEFAULT_LOG_FILE = 'logs/app.log'` (config.const.ts:45); last write 2026-09-23 11:16:53 |
| 4 | [`packages/mcp-server/data/`](packages/mcp-server/data) | Empty directory reserved for the MCP server's LanceDB vector-memory store (`DEFAULT_MEMORY_DATA_DIR = 'data'`). Created here because at some point the MCP server ran with `cwd = packages/mcp-server/`. The project has no `@callback/mcp-server` package, only `@callback/shared` in `packages/shared/`, so this whole `packages/mcp-server/` placeholder is unnecessary glue. | `DEFAULT_MEMORY_DATA_DIR = 'data'` (config.const.ts:27); `pnpm-workspace.yaml` declares `packages/*` but there is no package.json inside |
| 5 | [`scripts/packages/mcp-server/logs/app.log`](scripts/packages/mcp-server/logs/app.log:1) | Same kind of pino startup log, dropped here when the MCP server was launched with `cwd = scripts/packages/mcp-server/`. One line from 2026-09-16. | Single "MCP server started over stdio" entry dated 2026-09-16 14:59:51 |
| 6 | [`scripts/packages/mcp-server/data/`](scripts/packages/mcp-server/data) | Same LanceDB `data/` artifact, dropped here for the same reason as #4. | Empty |

### M — Almost certainly delete, eyeball once before pulling the trigger

| # | Path | Why | Evidence |
|---|------|-----|----------|
| 7 | [`packages/mcp-server/`](packages/mcp-server) | Once #3, #4 (and their contents) are gone the directory has nothing left in it. There is **no** `packages/mcp-server/package.json`, no source, no config — it exists only because the workspace glob `packages/*` in `pnpm-workspace.yaml` (line 3) is happy to include an empty folder and because the MCP server created the `data/` and `logs/` children. Removing the placeholder is harmless; pnpm will just ignore a missing directory. | `Get-ChildItem packages/mcp-server -Recurse` → only `data/` and `logs/app.log` |
| 8 | [`scripts/packages/`](scripts/packages) | Same reasoning as #7. After removing #5 and #6 the directory is empty. There is no `scripts/packages/mcp-server/package.json`; this folder only contains MCP-server-runtime leftovers. | `Get-ChildItem scripts/packages -Recurse` → only `mcp-server/data/` and `mcp-server/logs/app.log` |

### L — Judgment call

| # | Path | Why | Note |
|---|------|-----|------|
| 9 | [`.idea/`](.idea) | JetBrains IDE project files (`.iml`, `modules.xml`, `vcs.xml`, `workspace.xml`, `.gitignore`). `.idea/` is **not** in this project's `.gitignore` (only `.idea/` is ignored in the *MCP* repo's `.gitignore`). `git status` shows `.idea/workspace.xml` as modified, meaning IntelliJ auto-saves its window state into the repo on every focus change. Recommend either (a) ignoring `.idea/` globally in `.gitignore`, or (b) deleting the folder and accepting that IntelliJ will recreate it on next open. **Do not delete blindly** — if they actually use IntelliJ/WebStorm, they may want a slim version kept. | `.gitignore` line 26 only ignores `.vscode/*`; `.idea/` is not ignored anywhere; `git status` → `M .idea/workspace.xml` |
| 10 | [`.vscode/settings.json`](.vscode/settings.json:1) | Currently contains only `{}` (4 bytes). It is whitelisted by `.gitignore` (line 28: `!.vscode/settings.json`). Keeping an empty `{}` is harmless and prevents a future "do I commit an empty file?" debate; deleting it lets VS Code recreate it on first edit. | File is intentionally whitelisted |

## Recommended cleanup commands (PowerShell)

These are the exact commands a follow-up model / shell session can run to
apply the H-confidence recommendations. None of them touch tracked source
files; the only git-tracked items affected are none — everything in the H
list is either untracked, ignored, or already inside an untracked folder.

```powershell
# Remove the rogue $null file in the workspace root
Remove-Item -LiteralPath '$null' -Force

# Remove the MCP-server log file (entire logs/ dir is MCP runtime)
Remove-Item -LiteralPath 'logs\mcp-messages.log' -Force
Remove-Item -LiteralPath 'logs' -Recurse -Force

# Remove MCP-server runtime artifacts from packages/mcp-server/
Remove-Item -LiteralPath 'packages\mcp-server\logs\app.log' -Force
Remove-Item -LiteralPath 'packages\mcp-server\logs' -Recurse -Force
Remove-Item -LiteralPath 'packages\mcp-server\data' -Recurse -Force
Remove-Item -LiteralPath 'packages\mcp-server' -Recurse -Force

# Remove MCP-server runtime artifacts from scripts/packages/mcp-server/
Remove-Item -LiteralPath 'scripts\packages\mcp-server\logs\app.log' -Force
Remove-Item -LiteralPath 'scripts\packages\mcp-server\logs' -Recurse -Force
Remove-Item -LiteralPath 'scripts\packages\mcp-server\data' -Recurse -Force
Remove-Item -LiteralPath 'scripts\packages\mcp-server' -Recurse -Force
Remove-Item -LiteralPath 'scripts\packages' -Recurse -Force
```

> **Caveat for `scripts/packages/mcp-server/`** — confirm the folder is
> not referenced by any script (the workspace was originally set up for a
> copy of the MCP server under `scripts/`; if `init.ps1`, `init.sh`,
> `stack-*` scripts or `package.json` `scripts.*` still point at it, those
> references must be removed or redirected first).

## Prevention recommendations (for the project owner)

The MCP server will keep recreating `logs/mcp-messages.log` here as long as
the Cursor / Roo / LM Studio MCP client launches it with this directory as
`cwd`. Two ways to stop that permanently:

1. In the MCP client config (e.g. `lmstudio.mcp.json` or
   `.cursor/mcp.json`), set `cwd` (or the equivalent `env.CWD`) to a
   dedicated scratch directory **outside** the project — for example
   `E:\projects\AI\2026-08-31-ai-sztens-dev\.mcp-runtime\` — and add
   `.mcp-runtime/` to `.gitignore`.
2. Set the env vars `MCP_LOG_FILE`, `LOG_FILE`, and `MEMORY_DATA_DIR` in
   that client config to absolute paths inside the same scratch directory,
   so even if `cwd` ever points back at the repo root, the files land
   outside the repo.

Either change happens in `E:\projects\AI\2026-08-28-MCPs\`'s example
client file (`examples/lmstudio.mcp.json`) and your own client config; it
does **not** require modifying this project's source.

## Summary table

| Path | Action | Confidence |
|------|--------|------------|
| [`$null`]($null) | DELETE | H |
| [`logs/mcp-messages.log`](logs/mcp-messages.log) | DELETE | H |
| [`logs/`](logs) | DELETE (whole dir) | H |
| [`packages/mcp-server/logs/app.log`](packages/mcp-server/logs/app.log) | DELETE | H |
| [`packages/mcp-server/data/`](packages/mcp-server/data) | DELETE | H |
| [`packages/mcp-server/`](packages/mcp-server) | DELETE (whole dir) | M |
| [`scripts/packages/mcp-server/logs/app.log`](scripts/packages/mcp-server/logs/app.log) | DELETE | H |
| [`scripts/packages/mcp-server/data/`](scripts/packages/mcp-server/data) | DELETE | H |
| [`scripts/packages/mcp-server/`](scripts/packages/mcp-server) | DELETE (whole dir) | M |
| [`scripts/packages/`](scripts/packages) | DELETE (whole dir) | M |
| [`.idea/`](.idea) | OPTIONAL DELETE or `.gitignore` it | L |
| [`.vscode/settings.json`](.vscode/settings.json) | KEEP (whitelisted) | — |