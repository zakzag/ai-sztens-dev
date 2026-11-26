# Jest JSON import-attribute warning — fix

**Date:** 2026-11-05 14:55
**Scope:** `packages/shared`, `apps/api` (Jest configuration only)
**Type:** `fix(test)`

## Symptom

Every Jest run printed this warning (dozens of times, a couple of times per test file):

```text
Jest: importing JSON without an import attribute is deprecated and will be a
hard error in the next major. Update the import of
".../libphonenumber-js@1.13.15/node_modules/libphonenumber-js/metadata.min.json"
(from ".../libphonenumber-js/min/exports/PhoneNumber.js"): use
`with { type: 'json' }` for static imports, or pass
`{ with: { type: 'json' } }` as the second argument to dynamic `import()`.
```

Tests were green (`packages/shared`: 22 suites / 335 tests). The warning is noise
from Jest 30's ESM linker (`jest-runtime@30.5.2`, `ImportAttributeValidator`) and
becomes a hard error in the next Jest major.

## Root cause

The reporter names a third-party file, so the first instinct — "patch the
import" — is impossible: `libphonenumber-js` is in `node_modules`.

The actual trigger is our own `moduleNameMapper` entry, present in three configs:

```json
"moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }
```

It exists because our TypeScript uses NodeNext-style explicit `.js` specifiers
(`./format.const.js`) while the source files are `.ts`; stripping the suffix lets
Jest resolve the `.ts` file.

`libphonenumber-js@1.13.15` ships its ESM builds against **`metadata.min.json.js`**
wrappers on purpose (the file itself says: "Importing from a `.js` file is a
workaround for Node.js ES Modules importing system which is even uncapable of
importing `*.json` files"). Those wrappers are imported as:

```js
import metadata from '../../metadata.min.json.js' // min/exports/PhoneNumber.js
```

Jest applies `moduleNameMapper` to **every** module request, including relative
imports inside untransformed `node_modules` files. The mapper stripped `.js`, so
the request became `metadata.min.json` — a real JSON file — and the ESM linker
warned about the missing `with { type: 'json' }` attribute for a pair
(referencing file, JSON file) it had not warned about yet.

## Fix

A no-op mapping inserted **before** the suffix-stripping entry. `moduleNameMapper`
uses the first matching pattern, so `.json.js` specifiers now keep their
extension and resolve to the JS wrapper instead of the raw JSON:

```json
"moduleNameMapper": {
  "^(\\.{1,2}/.*\\.json\\.js)$": "$1",
  "^(\\.{1,2}/.*)\\.js$": "$1"
}
```

Rejected alternatives:

| Option | Why not |
| --- | --- |
| Add `with { type: 'json' }` to the import | Third-party file; would be lost on every install |
| Force `libphonenumber-js` to its CJS build (`customExportConditions`) | Changes the module format under test and is fragile with pnpm export maps |
| Silence `console.warn` in a setup file | Hides the symptom; Jest's next major turns it into a hard error |
| Drop `moduleNameMapper` entirely | Breaks resolution of our own `./x.js` → `x.ts` imports |

## Changed files

- `packages/shared/package.json` — guard entry added to `jest.moduleNameMapper`.
- `apps/api/package.json` — same guard in the inline unit-test Jest config.
- `apps/api/test/jest-e2e.json` — same guard in the e2e Jest config.

## Verification

```powershell
cd packages/shared
node --experimental-vm-modules node_modules/jest/bin/jest.js
# Test Suites: 22 passed, Tests: 335 passed — 0 JSON warnings

cd ../../apps/api
node --experimental-vm-modules node_modules/jest/bin/jest.js
# Test Suites: 39 passed, Tests: 433 passed — 0 JSON warnings
```
