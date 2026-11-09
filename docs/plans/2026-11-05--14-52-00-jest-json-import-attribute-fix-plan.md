# Plan — Jest "importing JSON without an import attribute" warning

**Date:** 2026-11-05 · **Related:** `docs/milestones/2026-11-05--14-55-00-jest-json-import-attribute-warning.milestone.md`

## Goal

Remove the Jest 30 warning `importing JSON without an import attribute is deprecated …`
that floods `packages/shared` (and can hit `apps/api`) test runs, without patching
`node_modules` and without weakening the assertions.

## Hypotheses considered

1. **Our own code imports a JSON file without attributes.** — Rejected: the reporter
   names `libphonenumber-js/min/exports/PhoneNumber.js`; no JSON import exists in our sources.
2. **`libphonenumber-js` ESM build is genuinely broken for Node ESM.** — Partly true in
   isolation (a bare JSON import needs attributes), but the package deliberately ships
   `*.json.js` wrappers to avoid exactly that, so the raw JSON import is *created* later.
3. **`moduleNameMapper` `^(\\.{1,2}/.*)\\.js$` strips `.js` from third-party specifiers
   too**, turning `../../metadata.min.json.js` into `../../metadata.min.json` (a real JSON
   file). ← selected
4. **Transform settings / `transformIgnorePatterns`** — Rejected: `node_modules` is
   untransformed, and the warning comes from the ESM *linker*, not a transformer.
5. **Jest resolves the `import` export condition of `libphonenumber-js`** — true but not the
   cause of the message; forcing the CJS build would only work around it.
6. **ts-jest ESM preset is broken / too old** — Rejected: preset works, only the mapper it
   brings conflicts with third-party `.json.js` wrappers.
7. **Cache/ghost artefact** — Rejected: reproducible on a clean run, deterministic per
   `(importer, JSON)` pair.

## Fix (option 3)

Insert a no-op mapping before the strip mapper; Jest's `moduleNameMapper` uses the first
matching entry:

```json
"moduleNameMapper": {
  "^(\\.{1,2}/.*\\.json\\.js)$": "$1",
  "^(\\.{1,2}/.*)\\.js$": "$1"
}
```

## Execution steps

1. Reproduce in `packages/shared` (22 suites / 335 tests, hundreds of warnings). — done
2. Apply the guard to `packages/shared/package.json`. — done
3. Re-run: 0 warnings, tests green. — done
4. Apply the same guard to `apps/api/package.json` and `apps/api/test/jest-e2e.json`. — done
5. Re-run `apps/api` unit suite: 39 suites / 433 tests, 0 warnings. — done
6. Record the change in `docs/history/` and the milestone in `docs/milestones/`. — done

## Acceptance criteria

- `packages/shared` and `apps/api` Jest output contains no `importing JSON without an import attribute` line.
- All existing tests pass unchanged.
- Resolution of our own `.js` → `.ts` specifiers still works (proven by the green suites).
