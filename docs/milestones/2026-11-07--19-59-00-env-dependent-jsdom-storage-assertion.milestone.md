# Environment-dependent jsdom storage assertion crashed the ThemeSelector suite

**Date:** 2026-11-07 19:59 (Europe/Budapest)
**Scope:** [`apps/admin/src/app/layout/ui/ThemeSelector.test.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.test.tsx:1), new test mock
**Related:** AIS-149 (theme select box), AIS-140 `D3` (selector is a UI contract, not a theme implementation)

## 1. Problem

The negative-contract test `ThemeSelector > touches neither the document nor the storage`
failed during `pnpm test` with a crash instead of an assertion failure:

```text
TypeError: Cannot read properties of undefined (reading 'length')
 ❯ src/app/layout/ui/ThemeSelector.test.tsx:145:32
    145|   expect(window.localStorage.length).toBe(0);
```

## 2. Evidence

- The single test passed when run alone and as part of the full admin suite on
  node 20.19.2 + jsdom 26 (`43 files / 490 tests` green), so the failure is
  environment-dependent, not a logic regression in the component.
- The error is a `TypeError` on a property read, which means the test never
  reached an assertion: `window.localStorage` was `undefined` in that run.
- jsdom only exposes `localStorage` / `sessionStorage` when the created window has a
  usable origin and the build supports Web Storage. Nothing guarantees it.

## 3. Root cause

The assertion depended on a **precondition of the test environment** instead of on the
behaviour under test. Even when jsdom does provide the storage, `length === 0` only says
"the storage is empty" — it cannot distinguish "the component never wrote" from "the
component wrote and something cleared it".

## 4. Solution

| File                                                                                      | Change                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`test/mocks/web-storage.mock.ts`](../../apps/admin/src/test/mocks/web-storage.mock.ts:1) | New mock: `installRecordingStorages()` installs in-memory `Storage` doubles on `window.localStorage` / `window.sessionStorage` via `Object.defineProperty`, with write/remove/clear counters and a `restore()` undo. |
| [`ThemeSelector.test.tsx`](../../apps/admin/src/app/layout/ui/ThemeSelector.test.tsx:46)  | `beforeEach` installs the doubles, `afterEach` restores them; the assertion is now `writtenKeys() === []` + `isUntouched() === true` on both storages.                                   |

The component and the `onThemeChange` port are untouched — only the way the contract is
observed changed.

## 5. Outcome and verification

Both storages are replaced before every test in the file, so the suite proves the real
contract ("the selector performs no storage write") and cannot crash on a missing jsdom
storage object.

```powershell
pnpm --filter @callback/admin exec vitest run src/app/layout/ui/ThemeSelector.test.tsx
pnpm --filter @callback/admin exec vitest run
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin lint
```

## 6. Follow-ups

- [`session-token.test.ts`](../../apps/admin/src/auth/session-token.test.ts:18) still calls
  `window.sessionStorage.clear()` directly; if the same environment issue appears there, the
  same harness applies.
- Rule of thumb for new tests: never assert through an environment object that may be absent —
  install the double in `src/test/mocks/` and assert on what the code did.
