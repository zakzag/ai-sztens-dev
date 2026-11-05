# Jest JSON import-attribute warning (`libphonenumber-js`)

**Date:** 2026-11-05 · **Packages:** `packages/shared`, `apps/api` · **Kind:** non-trivial test-infrastructure bug fix

## Problem

Every Jest run emitted dozens of warnings:

```text
Jest: importing JSON without an import attribute is deprecated and will be a hard
error in the next major. Update the import of ".../libphonenumber-js/metadata.min.json"
(from ".../libphonenumber-js/min/exports/PhoneNumber.js") ...
```

Tests were green; the warning is noise today and a hard error in the next Jest major.

## Evidence

| Run | Result |
| --- | --- |
| `packages/shared` before the fix | 22 suites / 335 tests pass, hundreds of warning lines (2 distinct `(importer, JSON)` pairs per test file, i.e. `min/exports/*.js` and `index.es6.exports/*.js`) |
| `packages/shared` after the fix | 22 suites / 335 tests pass, **0** warning lines |
| `apps/api` after the fix | 39 suites / 433 tests pass, **0** warning lines |

The message names third-party files, so it cannot be fixed by editing the import.

## Root cause

The trigger is our own Jest config, not the dependency:

```json
"moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }
```

Purpose: our TS sources use NodeNext `.js` specifiers while files are `.ts`, so Jest needs the suffix stripped. Jest applies the mapper to **every** module request, including relative imports inside untransformed `node_modules` ESM files.

`libphonenumber-js@1.13.15` ships ESM builds importing a JS wrapper:

```js
import metadata from '../../metadata.min.json.js'   // min/exports/PhoneNumber.js
```

The wrapper exists precisely because bare JSON imports are awkward in Node ESM. The mapper stripped `.js`, producing `metadata.min.json` — a real JSON file — so `jest-runtime`'s ESM linker (`ImportAttributeValidator`, jest 30.5.2) reported a JSON import without `with { type: 'json' }`.

## Solution

A no-op mapping placed **before** the suffix-stripping one (`moduleNameMapper` uses the first match), so `.json.js` specifiers keep their extension:

```json
"moduleNameMapper": {
  "^(\\.{1,2}/.*\\.json\\.js)$": "$1",
  "^(\\.{1,2}/.*)\\.js$": "$1"
}
```

Applied to all three Jest configs that carry the mapper:

| File | Change |
| --- | --- |
| `packages/shared/package.json` | guard entry added to `jest.moduleNameMapper` (unit tests) |
| `apps/api/package.json` | guard entry in the inline unit-test Jest config |
| `apps/api/test/jest-e2e.json` | guard entry in the e2e Jest config |

Rejected: patching the dependency import (lost on install); forcing the CJS build of `libphonenumber-js` (module format changes, pnpm export-map fragility); silencing `console.warn` (hides the symptom and the future error).

## Outcome and verification

Jest output is clean while resolution of our own `.js` → `.ts` imports is unchanged.

```powershell
cd packages/shared
node --experimental-vm-modules node_modules/jest/bin/jest.js   # 22 suites / 335 tests, no warnings

cd ../../apps/api
node --experimental-vm-modules node_modules/jest/bin/jest.js   # 39 suites / 433 tests, no warnings
```

## Follow-ups

- If our own code ever imports JSON directly, use `import data from './x.json' with { type: 'json' }`.
- If a fourth Jest config is added, copy the guard entry — the mapper block is duplicated across configs today and is a candidate for a shared Jest preset.
