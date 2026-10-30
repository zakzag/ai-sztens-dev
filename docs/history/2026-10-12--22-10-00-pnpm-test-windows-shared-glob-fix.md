# 2026-10-12 22:10 — pnpm test fix: Windows + shared package glob

## Context

`pnpm test` at the repo root (i.e. `pnpm --filter @callback/shared test && pnpm --filter @callback/api test`, see [`package.json:12`](../../package.json)) failed locally on Windows with:

```
$ pnpm build && node --test test/
$ tsc -p tsconfig.json
node:internal/modules/cjs/loader:1478
  throw err;
  ^

Error: Cannot find module 'E:\projects\AI\2026-08-31-ai-sztens-dev\packages\shared\test'
    at Module._resolveFilename (...)
  code: 'MODULE_NOT_FOUND'
[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
  x "pnpm recursive run" failed in E:\projects\AI\2026-08-31-ai-sztens-dev\packages\shared
```

The same script works in CI (Linux runners) — so this is a Windows-only latent portability bug, not a logic regression.

## Root cause

The `@callback/shared` test script is defined in [`packages/shared/package.json:17`](../../packages/shared/package.json) as:

```json
"test": "pnpm build && node --test test/"
```

On Windows + `cmd.exe`, the unquoted `test/` argument is passed to Node verbatim. Node 26's `Module._resolveFilename` then tries to require the directory path `packages\shared\test` as a CommonJS module, which fails with `MODULE_NOT_FOUND`. POSIX shells handle the trailing slash differently and never reach this branch, which is why CI was unaffected.

This is also why an earlier attempt to use an explicit glob (`node --test "test/**/*.test.mjs"`) did not work either: `cmd.exe` does not recursively expand `**`, so the glob resolves to zero files and Node reports `Could not find '...\test\**\*.test.mjs'`.

## Fix

Quote the directory argument so Node's test runner — not the Windows shell — receives it as a positional argument. From Node's docs, a trailing-slash positional argument is treated as a directory to scan for test files, which is exactly the original intent.

```diff
-    "test": "pnpm build && node --test test/"
+    "test": "pnpm build && node --test \"test/\""
```

## Why not the explicit glob

`test/**/*.test.mjs` is a more explicit, future-proofed form on POSIX, but on `cmd.exe` (and the default `pnpm` shell on Windows) the shell does not expand `**`, so the literal pattern is forwarded to Node and matches nothing. Keeping the directory form and adding the quotes is the smallest change that works on both OSes.

## Verification

- `cd packages/shared && pnpm test` → `tests 10 / pass 10 / fail 0`.
- Top-level `pnpm test` → exit code 0; `@callback/shared` 10/10 and `@callback/api` 9 suites / 60 tests pass.

## Changed files

| File                                                                 | Change                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/shared/package.json`](../../packages/shared/package.json) | Quoted the `--test` argument (`"test/"` instead of `test/`) so Windows shells forward the path to Node's test runner instead of treating it as a module to require. |
