# pnpm install killed by a locked `node_modules` on Windows (os error 32)

**Date:** 2026-10-21 14:50 (Europe/Budapest)
**Type:** non-trivial bug fix (local toolchain)
**Scope:** developer machines only — no application, infra or CI code changed.

## 1. Problem

`pnpm install --force` in the monorepo root aborted with:

```text
Failed to create symlink at node_modules\.pnpm\ts-jest@29.4.14_<hash>\node_modules\yargs-parser
  -> node_modules\.pnpm\yargs-parser@21.1.1\node_modules\yargs-parser:
  The process cannot access the file because it is being used by another process. (os error 32)
```

The workspace was left only partially installed, so subsequent `build` / `test`
runs could not be trusted.

## 2. Evidence

| Measurement                           | Value                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm / node                           | 9.15.4 / v20.19.2                                                                                                                                                     |
| Workspace drive                       | `E:` NTFS, fixed, 765 GB free → symlinks are supported                                                                                                                |
| Install progress at failure           | `resolved 141, reused 141, added 134` (out of ~647 packages)                                                                                                          |
| `.pnpm` directories after the failure | **141** (vs. **647** after a successful run)                                                                                                                          |
| Locking processes                     | `js-language-service.js` (WebStorm TS service, pid 32728) and `typescript/lib/typingsInstaller.js` (pid 23908), both running **from inside `node_modules/.pnpm/...`** |
| Not involved                          | MCP servers (they live in `E:/projects/AI/2026-08-28-MCPs`), Docker, Postgres                                                                                         |

## 3. Root cause

pnpm's Windows `node_modules` is a tree of **symlinks** into `.pnpm`. A process
holding a handle on any file below `node_modules` makes `CreateSymbolicLink` /
`DeleteFile` fail with `ERROR_SHARING_VIOLATION` = `os error 32`. IDE language
services keep such handles open for type-checking and typings installation;
antivirus real-time scanning can do the same for freshly created files.

`--force` is the worst first reaction: it deletes and recreates the entire tree,
maximising the window in which a lock aborts the run. A plain `pnpm install` on
a half-built tree only has to add the missing links and is therefore both faster
and much less likely to collide.

## 4. Implementation

No code change; the fix is an operational procedure, now written down.

- Stopped the two IDE helper processes (`Stop-Process -Id 23908,32728 -Force`);
  the IDE restarts them on demand.
- Ran a plain `pnpm install` → `+646 packages, 517 added, Done in 4m 21s`,
  exit code 0, `.pnpm` back to 647 package directories.
- Documented the diagnosis and recovery in
  [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md) §5
  ("Common pitfalls"), including the warning about `--force`.
- Narrative record:
  [`docs/history/2026-10-21--14-50-00-pnpm-install-symlink-os-error-32-fix.md`](../history/2026-10-21--14-50-00-pnpm-install-symlink-os-error-32-fix.md).

## 5. Outcome and verification

`node_modules` is complete and consistent; jest/ts-jest resolve their transitive
links again.

```powershell
# 1. nothing from this workspace should be running any more
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*ai-sztens-dev*' } |
  Select-Object ProcessId,CommandLine

# 2. install is idempotent / clean
pnpm install

# 3. executables resolve
pnpm test      # @callback/shared 10/10, @callback/api 107/107
```

Observed result of step 3: `shared` 10/10 and `api` 107/107 passing, exit code 0.

## 6. Follow-ups

- If the error reappears without an IDE running, suspect Windows Defender
  real-time scanning and exclude the pnpm store
  (`pnpm store path`, by default `%LOCALAPPDATA%\pnpm\store`) or the workspace
  `node_modules` from scanning.
- Consider a `pnpm install` pre-flight script that lists `node.exe` processes
  rooted in the workspace before installing — deferred, since the pitfall entry
  covers the case for now.
