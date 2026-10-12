# 2026-10-12 -- 22-30-25 -- shared test script PowerShell quote strip fix

`pnpm test` failed on PowerShell with `Cannot find module 'E:\projects\AI\2026-08-31-ai-sztens-dev\packages\shared\test'`. The `@callback/shared` package test script ran the build successfully (`pnpm build && ...`), but the subsequent `node --test "test/"` step crashed inside Node's CJS loader before the test runner could pick up the file.

## Problem / symptom

```
$ pnpm --filter @callback/shared test && pnpm --filter @callback/api test

$ pnpm build && node --test "test/"
$ tsc -p tsconfig.json
node:internal/modules/cjs/loader:1478
  throw err;
  ^

Error: Cannot find module 'E:\projects\AI\2026-08-31-ai-sztens-dev\packages\shared\test'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1475:15)
    ...
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
✖ test (49.6053ms)
```

The error came from `Module._resolveFilename`, i.e. Node's CommonJS loader, not the test runner. That is the key clue: Node was being asked to **load** `test` as a module, not to discover test files inside the `test/` directory.

## Measured data / evidence

- `packages/shared/package.json` had `"test": "pnpm build && node --test \"test/\""`.
- `packages/shared/test/build-info.test.mjs` exists and is a valid Node test file (uses `node:test`).
- The build step (`tsc -p tsconfig.json`) completed successfully, so `dist/` was produced.
- The crash happened only on the `node --test` line, and only via PowerShell.

## Root cause

On Windows / PowerShell, when pnpm forwards the script to a child process, the double quotes around `"test/"` are stripped at the shell boundary. Node therefore receives the argument `test/` (no quotes, trailing slash) and falls back to module-resolution semantics instead of running it as a test-directory glob. Specifically, `Module._resolveFilename` is invoked for the bare specifier `test`, no matching file is found in `packages/shared`, and `MODULE_NOT_FOUND` is thrown — exactly the trace in the failure.

The trailing slash is the trigger: `node --test test` (no slash) is parsed by the test runner as a directory pattern; `node --test test/` is parsed by the CJS loader as a module path.

## Solution / implementation

Removed the trailing slash and the quotes from the test script so the argument is unambiguous regardless of shell quote handling:

- `packages/shared/package.json`: `"test": "pnpm build && node --test \"test/\""` → `"test": "pnpm build && node --test test"`.

`node --test test` (no trailing slash) is interpreted by Node's test runner as a directory pattern and discovers `packages/shared/test/build-info.test.mjs` correctly on Windows / PowerShell.

## Outcome and how to verify

From the repository root, on PowerShell:

```powershell
pnpm test
```

Expected: the build runs, the test runner discovers `test/build-info.test.mjs`, and the suite passes (currently 1 test). The `MODULE_NOT_FOUND` trace from `node:internal/modules/cjs/loader` must no longer appear.

## Follow-ups

- If more test files are added under `packages/shared/test/`, no script change is needed — `node --test test` recurses the directory and picks them up automatically.
- The same trailing-slash pattern should be audited in any other workspace `test` scripts (currently none use it).