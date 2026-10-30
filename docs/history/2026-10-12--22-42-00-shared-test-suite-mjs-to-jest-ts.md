# 2026-10-12 -- 22-42-00 -- shared test suite migrated from .mjs/node:test to .ts/Jest

The earlier fix (`node --test "test/"` → `node --test test`) only papered over a
deeper inconsistency: [`@callback/shared`](packages/shared/package.json) had a
hand-written `.mjs` test file using Node's built-in `node:test`, while the rest
of the monorepo ([`@callback/api`](apps/api/package.json), [`@callback/web`](apps/web/package.json),
[`@callback/admin`](apps/admin/package.json)) is TypeScript everywhere and runs
unit tests through Jest + `ts-jest` in ESM mode. The `.mjs` file was an
unrelated one-off, not a design intent.

## Problem / feature

- `pnpm test` failed on PowerShell with `Cannot find module '...packages\shared\test'`
  because the shell stripped the quotes around `"test/"` and Node's CLI routed
  the bare trailing-slash path through the CommonJS module loader.
- The `.mjs` test file imported from the **compiled** `dist/` output and required
  a `pnpm build` step before each run, which is not how the API's Jest suite
  works — they import from `src/` directly and run without a build.
- Two `.mjs` quirks hurt: it could not be type-checked, and it diverged from the
  `*.spec.ts` convention used everywhere else.

## Measured data / evidence

- Initial `pnpm test` failure trace came from
  `node:internal/modules/cjs/loader:1475`, i.e. `Module._resolveFilename`,
  proving Node was being asked to _load_ `test` as a module instead of scanning
  it for `*.test.*` files.
- `packages/shared/test/build-info.test.mjs` (78 lines) imports from
  `../dist/lib/build-info.js` and uses `node:assert/strict`, `node:test`,
  `describe`, `it`. Same behavioural contract as a Jest spec, different
  vocabulary.
- `apps/api/package.json` "test" script:
  `node --experimental-vm-modules node_modules/jest/bin/jest.js`.
- `apps/api/package.json` "jest" block uses
  `preset: ts-jest/presets/default-esm`, `useESM: true`,
  `extensionsToTreatAsEsm: [".ts"]`, `testRegex: ".*\\.spec\\.ts$"`.

## Root cause / design rationale

The `node:test`-based `.mjs` test in `@callback/shared` was a pragmatic
one-off to avoid adding test dependencies to a leaf package. That trade-off is
not worth the inconsistency: every other package in the repo uses the same
Jest + `ts-jest` ESM preset, and TypeScript everywhere is the project's
unwritten rule (see `.roo/rules/general.coding-standards.md`).

The shell-stripping failure on PowerShell was the trigger that surfaced the
design problem; the right fix is to migrate the suite to match the API, not to
keep dodging shell-quoting edge cases.

## Solution / implementation

| File                                                                                   | Change                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/shared/test/build-info.test.mjs`](packages/shared/test/build-info.test.mjs) | **Deleted.**                                                                                                                                                                                                                                                                                                                            |
| [`packages/shared/test/build-info.test.ts`](packages/shared/test/build-info.test.ts)   | **Created.** TypeScript port using Jest globals (`describe`, `it`, `expect`, `toBe` / `toBeNull` / `toEqual` / `stringContaining`). Imports from `../src/lib/build-info.js` directly (no `dist/` hop).                                                                                                                                  |
| [`packages/shared/package.json`](packages/shared/package.json)                         | `"test"` script now matches the API: `node --experimental-vm-modules node_modules/jest/bin/jest.js`. Added `jest`, `ts-jest`, `@types/jest`, `@types/node` to `devDependencies`. Added a `jest` block mirroring the API's (`preset: ts-jest/presets/default-esm`, `useESM: true`, `rootDir: "."`, `testRegex: "test/.*\\.test\\.ts$"`). |
| [`packages/shared/tsconfig.json`](packages/shared/tsconfig.json)                       | **Unchanged.** Still scoped to `src/` with `rootDir: "src"`, so the build artefact layout (`dist/index.js`) is preserved for `@callback/api`, `@callback/web`, `@callback/admin`. `ts-jest` type-checks the spec file on its own.                                                                                                       |

## Outcome and how to verify

```powershell
pnpm install           # fetches jest + ts-jest + @types/jest + @types/node
pnpm --filter @callback/shared test
pnpm test              # full chain: shared && api
```

Last run on this PowerShell:

```
PASS test/build-info.test.ts
  normalizeBuildValue
    √ returns the trimmed value for a real build arg (2 ms)
    √ collapses an empty string to null (Vite substitutes unset args with "") (1 ms)
    √ collapses a whitespace-only string to null (1 ms)
    √ passes through null and undefined (1 ms)
  formatDeployDate
    √ renders the placeholder when nothing was injected (1 ms)
    √ humanises a valid ISO 8601 build timestamp (21 ms)
    √ honours an explicit locale (1 ms)
    √ falls back to the raw value when the date is unparseable
  formatCommitHash
    √ renders the full SHA verbatim (1 ms)
    √ renders the placeholder when nothing was injected (1 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

`pnpm test` (full chain): 10 shared + 60 API = **70 tests pass**.

## Follow-ups

- None. New spec files dropped under `packages/shared/test/*.test.ts` will be
  picked up automatically by the existing Jest `testRegex`.
- If the project ever introduces a `@callback/web` unit suite, the same Jest
  preset copy-pasted from [`apps/api/package.json`](apps/api/package.json:56) is
  the template.
