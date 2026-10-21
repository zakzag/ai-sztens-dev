# pnpm install aborted with `os error 32` (symlink creation, Windows)

**Date:** 2026-10-21 14:50 (Europe/Budapest)
**Scope:** local toolchain / `node_modules` recovery — no application code changed.

## Symptom

`pnpm install --force` stopped right after the resolution step:

```text
Error:   x installing dependencies
  `-> Failed to create symlink at
      "...\node_modules\.pnpm\ts-jest@29.4.14_@babel+core_<hash>\node_modules\yargs-parser"
      to "...\node_modules\.pnpm\yargs-parser@21.1.1\node_modules\yargs-parser":
      The process cannot access the file because it is being used by another
      process. (os error 32)
```

The run had reported `resolved 141, reused 141, added 134`, i.e. it aborted
very early, and `node_modules/.pnpm` afterwards contained only **141**
package directories instead of the expected ~647.

## Diagnosis

| Check | Result |
|---|---|
| Drive of the workspace | `E:` — NTFS, fixed disk, 765 GB free (symlinks are supported, so not a filesystem limitation) |
| pnpm / node | pnpm 9.15.4, node v20.19.2 |
| Processes holding the workspace | `js-language-service.js` (WebStorm TS service, pid 32728) and `typescript/lib/typingsInstaller.js` (pid 23908) — **both executing from `node_modules/.pnpm/...`** |
| Antivirus / MCP servers | MCP servers run from `E:/projects/AI/2026-08-28-MCPs` and do not touch this `node_modules`; Defender real-time scan is a secondary suspect only |

Root cause: pnpm on Windows materialises `node_modules` as a tree of
symlinks. While a language service keeps a handle open on a file inside
`node_modules`, creating (or, under `--force`, first deleting) a link in that
tree fails with `ERROR_SHARING_VIOLATION` (`os error 32`). `--force` widens
this window because it recreates the entire tree.

## Fix

1. Stop the two IDE helper processes:
   `Stop-Process -Id 23908,32728 -Force` (the IDE respawns them on demand).
2. Re-run a **plain** `pnpm install` (no `--force`):
   `Packages: +646 … 517 added … Done in 4m 21s`, exit code 0.
3. Verified the previously failing link now resolves: the (re-created)
   `ts-jest@29.4.14_<peer-suffix>` directory contains a `yargs-parser` link,
   and `node_modules/.pnpm` holds 647 package directories.
4. `pnpm test` — `@callback/shared` 10/10 and `@callback/api` 107/107 green,
   proving jest + ts-jest + their transitive links are healthy.

## Documentation

[`docs/Specs/Local-Development.md`](../Specs/Local-Development.md) §5 "Common
pitfalls" gained a Windows entry with the diagnosis commands, the
kill-then-rerun recovery and the advice not to start with `--force`.

## Takeaway

On Windows, treat `os error 32` during `pnpm install` as a **lock**, not a
permissions or disk problem: find the `node.exe` processes rooted in the
workspace, stop them, and let a plain `pnpm install` finish the half-built tree.
