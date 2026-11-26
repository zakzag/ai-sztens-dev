# pnpm-lock.yaml corruption + cookie ESM breakage fix

**Date:** 2026-11-02 16:49 (Europe/Budapest)
**Scope:** tooling/dependency repair — no product code changed.

## Symptom

`pnpm test` failed twice in a row with two distinct errors:

1. The pre-run dependency install failed while creating a symlink
   (`fs-extra` → `fs-extra@10.1.0`, `os error 32`), after which the
   `@callback/shared` test script could not find `node_modules/jest/bin/jest.js`.
2. After the install completed, the `@callback/api` Jest suite failed on
   `create-fastify-adapter.spec.ts` with
   `Must use import to load ES Module: …cookie@2.0.1…dist/index.js`.

## Root cause

The committed [`pnpm-lock.yaml`](../../pnpm-lock.yaml) was **corrupt**: it contained
**two concatenated YAML documents** (`---` separator + a second `lockfileVersion`
block starting at line 159). pnpm refused to parse it ("expected a single document in
the stream, but found more") and silently **ignored the lockfile on every install**,
re-resolving the whole tree from scratch.

Two consequences followed:

- `node_modules` drifted from the lockfile, so the `verifyDepsBeforeRun` pre-install
  kept running and, combined with a transient Windows file lock (`os error 32`), left
  `node_modules` incomplete (jest missing).
- The fresh resolution bumped `light-my-request` `6.6.0 → 6.8.0`, whose dependency
  range moved to `cookie@^2.0.0` → `cookie@2.0.1` (ESM-only, `exports` only,
  `engines.node >= 22`). `light-my-request` is CommonJS and does `require('cookie')`,
  which Jest's runtime cannot satisfy for an ESM-only package.

## Fix

- Pinned `light-my-request` to `6.6.0` via
  [`pnpm.overrides`](../../package.json) — the previously committed, CJS-compatible
  version whose `cookie@^1.0.2` resolves to `cookie@1.1.1` (CommonJS).
- Deleted the corrupt lockfile and ran `pnpm install` to regenerate a valid,
  single-document [`pnpm-lock.yaml`](../../pnpm-lock.yaml) and resync `node_modules`.

## Verification

- `pnpm install` — green, no "broken lockfile" warning.
- `pnpm test` — green across all workspaces:
  - `@callback/shared` — 9 suites / 146 tests
  - `@callback/api-client` — 5 suites / 97 tests
  - `@callback/ui` — 9 files / 71 tests
  - `@callback/admin` — 23 files / 195 tests
  - `@callback/api` — 38 suites / 360 tests (incl. the previously failing
    `create-fastify-adapter.spec.ts`)
- Lockfile now contains `light-my-request@6.6.0` + `cookie@1.1.1`, no `cookie@2.0.1`.

## Changed files

- [`package.json`](../../package.json) — added `pnpm.overrides.light-my-request = "6.6.0"`.
- [`pnpm-lock.yaml`](../../pnpm-lock.yaml) — regenerated as a valid single-document lockfile.
