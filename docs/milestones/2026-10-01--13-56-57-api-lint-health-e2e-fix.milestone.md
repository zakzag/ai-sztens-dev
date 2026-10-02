# API lint failure on health e2e spec — fix and rationale

## Problem

GitHub Actions `Deploy` workflow (`pnpm -r lint`) failed on
`apps/api/test/health.e2e-spec.ts`. ESLint under
`tseslint.configs.recommendedTypeChecked` reported 6 errors and 1
warning, all chained from one source: `response.json()` is typed `any`
by Fastify, and the test stored it in `const body = response.json();`
without any narrowing.

## Measured data

CI excerpt (the deploy job, `lint` step):

```
apps/api lint:   42:11  error   Unsafe assignment of an `any` value
apps/api lint:   43:17  error   Unsafe member access .status on an `any` value
apps/api lint:   44:24  error   Unsafe member access .uptime on an `any` value
apps/api lint:   45:17  error   Unsafe member access .uptime on an `any` value
apps/api lint:   46:24  error   Unsafe member access .timestamp on an `any` value
apps/api lint:   47:36  warning Unsafe argument of type `any` assigned to string
apps/api lint:   47:41  error   Unsafe member access .timestamp on an `any` value
apps/api lint:   ✖ 7 problems (6 errors, 1 warning)
apps/api lint:   Failed
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @callback/api@0.0.1 lint
```

## Root cause / why the obvious fix doesn't work

The obvious first attempt — adding a local interface and casting — is
wrong under `recommendedTypeChecked`:

| Approach                                      | Result                                                 |
|----------------------------------------------|--------------------------------------------------------|
| `const body = response.json();`               | `any` everywhere, all rules fire                       |
| `as unknown as HealthBody`                    | All `no-unsafe-*` rules still fire (cast ≠ narrowing)  |
| `expect(isHealthBody(body)).toBe(true)` only  | Fixes the assignment; `body` remains `unknown` after   |
| `if (!isHealthBody(body)) throw` + assertions | **All rules satisfied** — control-flow narrowing works |

A double-cast (`as unknown as X`) is a *type assertion*, not a
narrowing; under `recommendedTypeChecked` the type-checker still
treats the result as `any`. It also trips `no-unused-vars` on the
target interface because the cast erases the symbol from the program's
type graph.

## Solution

In [`apps/api/test/health.e2e-spec.ts`](apps/api/test/health.e2e-spec.ts:1):

1. Add `interface HealthBody` matching
   [`HealthController.check()`](apps/api/src/health/health.controller.ts:15).
2. Add a real type guard
   `function isHealthBody(value: unknown): value is HealthBody`.
3. Replace the assertion block:

   ```ts
   const body: unknown = response.json();
   if (!isHealthBody(body)) throw new Error('health body shape mismatch');
   expect(body.status).toBe('ok');
   ...
   ```

No rule was disabled; no `eslint.config.mjs` change; no infra touched.

## Outcome and verification

```
$ pnpm --filter @callback/api lint
apps/api lint: Done   (exit 0, 0 errors, 0 warnings)
apps/admin lint: Done
apps/web lint: Done
```

Re-run `pnpm -r lint` from the repo root to reproduce the CI step
locally. The `Deploy` workflow's lint step will now pass and the
remaining CI stages (test, build, deploy) will run.

## Follow-ups

- The `HealthBody` shape duplicates
  [`HealthController.check()`'s return type](apps/api/src/health/health.controller.ts:15).
  If the controller ever returns more fields, both sides must be kept
  in sync — acceptable for now (small, stable contract), worth promoting
  to a shared DTO only if a second consumer appears.
- A reusable `isObjectWith(record, ['status', 'uptime', 'timestamp'])`
  helper in [`packages/shared/`](packages/shared/src/index.ts:1) would
  remove the duplication once a second e2e spec needs the same pattern.
