# api lint fix: health e2e spec

## Context

GitHub Actions `Deploy` workflow failed at the `pnpm -r lint` step on
`apps/api`. ESLint with `tseslint.configs.recommendedTypeChecked` flagged
6 errors + 1 warning in `apps/api/test/health.e2e-spec.ts`:

```
42:11  error  Unsafe assignment of an `any` value              no-unsafe-assignment
43:17  error  Unsafe member access .status on an `any` value   no-unsafe-member-access
44:24  error  Unsafe member access .uptime on an `any` value   no-unsafe-member-access
45:17  error  Unsafe member access .uptime on an `any` value   no-unsafe-member-access
46:24  error  Unsafe member access .timestamp on an `any`     no-unsafe-member-access
47:36  warn   Unsafe argument of type `any` assigned to string  no-unsafe-argument
47:41  error  Unsafe member access .timestamp on an `any`     no-unsafe-member-access
```

Root cause: `FastifyInjectResponse.json()` is typed `any`, and the test
stored the result in `const body = response.json();` (also `any`),
making every subsequent member access unsafe.

## First attempt (failed lint)

Added a local `HealthBody` interface and tried
`const body = response.json() as unknown as HealthBody;`. This:

- Still triggered `no-unsafe-assignment` and `no-unsafe-member-access`
  because `recommendedTypeChecked` does NOT narrow through a double-cast
  assertion; from the linter's perspective `body` is still `any`.
- Also triggered `no-unused-vars` on the `HealthBody` interface itself,
  because the cast erased the symbol from the program's type graph.

Lesson documented in the source comment: **`as unknown as X` is not a
narrowing tool under `recommendedTypeChecked`**; use a real type guard.

## Final fix (passes lint, exit 0)

1. Defined `interface HealthBody` matching the return type of
   `HealthController.check()` (`apps/api/src/health/health.controller.ts`).
2. Added a runtime type-guard `function isHealthBody(value: unknown): value is HealthBody`
   that checks `status === 'ok'`, `typeof uptime === 'number'`, and
   `typeof timestamp === 'string'`.
3. Replaced the assertion block with:

   ```ts
   const body: unknown = response.json();
   if (!isHealthBody(body)) throw new Error('health body shape mismatch');
   expect(body.status).toBe('ok');
   // ...
   ```

The `if` (not `expect`) is essential: a control-flow narrowing is what
the type-checker requires to flow `HealthBody` into the subsequent
assertions. `expect(isHealthBody(body)).toBe(true)` would leave `body`
as `unknown` and only fix half the errors.

## Verification

Run the same command CI uses, scoped to the api workspace:

```
pnpm --filter @callback/api lint
```

(or `pnpm -r lint` from repo root). Result on this commit:

- `apps/api lint: Done` (exit 0, 0 errors, 0 warnings)
- `apps/admin lint: Done` (placeholder)
- `apps/web lint: Done` (placeholder)

## Files touched

- [`apps/api/test/health.e2e-spec.ts`](apps/api/test/health.e2e-spec.ts:1) — added
  `HealthBody` interface + `isHealthBody` type guard, refactored the
  body assertions to use a control-flow-narrowed `unknown` instead of
  the `any` from `response.json()`.

No other files modified. No infra, no docs specs, no GitHub Action YAML.
