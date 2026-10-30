# ApiExceptionFilter: type-only `Reflector` import broke DI metadata

**Date:** 2026-10-28 12:07 · **Area:** `apps/api/src/common/http` · **Severity:** boot-blocking on Node ≥ 24.9

## Problem

`ApiKeysModule › resolves the controller, the service and the repository from the
real module` failed with:

```
Nest can't resolve dependencies of the ApiExceptionFilter (ApiResponseService, ?).
Please make sure that the argument at index [1] is available in the current module.
```

The same graph is resolved at application bootstrap, so the API would not start on
a runtime where the gate below opens.

## Measured data / evidence

1. `ApiExceptionFilter` injects `private readonly reflector: Reflector`, but the class
   was imported as `import type { Reflector } from '@nestjs/core'`.
2. Compiled output was the proof: `apps/api/dist/common/http/api-exception.filter.js`
   contained `__metadata("design:paramtypes", [ApiResponseService, Function])` and the
   identifier `Reflector` did not appear anywhere in the file.
3. After the fix the same line reads `__metadata("design:paramtypes", [ApiResponseService, Reflector])`
   and line 12 holds `import { Reflector } from '@nestjs/core'`.
4. Reproduced only on Node ≥ 24.9: `apps/api/src/api-keys/api-keys.module.spec.ts`
   self-skips the real-module compile while `JEST_CAN_REQUIRE_ESM` is false
   (Node 20.19.2 locally). `ApiKeysModule` imports `HttpModule`, which registers the
   filter as `APP_FILTER` — that is why the module spec, and not the unit specs,
   surfaced it.
5. Ruled out: a missing `Reflector` provider (Nest's internal core module always
   provides it, and the error would name `Reflector` instead of `?`), a missing
   `HttpModule` import (it is imported; index [0] resolved), a duplicated `@nestjs/common`
   instance, and a missing `@Injectable()` (filters do not need it).

## Root cause

`emitDecoratorMetadata` must reference the parameter type **at runtime**. A type-only
import is erased by the compiler, so `design:paramtypes` degrades to `Function`, which
is not a provider token — Nest reports it as `?`. The defect is invisible to `tsc` and
to every unit test that constructs the class by hand; only a real DI resolution fails.
The identical failure class is already documented in
`apps/api/src/vapi-webhooks/vapi-webhooks.module.spec.ts` (type-only `ConfigService`
once stopped the whole app from booting).

## Solution

- `apps/api/src/common/http/api-exception.filter.ts` — `Reflector` is now a value
  import, with a comment stating why it must never become `import type`.
- `apps/api/src/common/http/http-wiring.metadata.spec.ts` (new) — asserts
  `design:paramtypes` of `ApiExceptionFilter` equals `[ApiResponseService, Reflector]`,
  that no wired provider emits an erased placeholder (`Function` / `Object`), and that
  `RequestIdInterceptor` injects nothing. It runs on **every** Node version, so the
  gap left by the self-skipping module spec is closed.

## Outcome and how to verify

```bash
pnpm --filter @callback/api test      # 24 suites, 212 tests, incl. http-wiring.metadata.spec.ts
pnpm --filter @callback/api build
findstr /n "paramtypes" apps\api\dist\common\http\api-exception.filter.js
# 81: __metadata("design:paramtypes", [ApiResponseService,  82: Reflector])
```

On Node ≥ 24.9 the real-module spec (`api-keys.module.spec.ts`) now also passes instead
of throwing `UnknownDependenciesException`.

## Follow-ups

- The same trap can be introduced by any future type-only import of a class used in a
  decorated constructor. A lint rule (`@typescript-eslint/consistent-type-imports` with a
  decoration-aware exception, or a custom check over `design:paramtypes`) would fail
  earlier, at PR time rather than at boot.
- `JEST_CAN_REQUIRE_ESM` still hides module-graph failures on Node < 24.9; CI should run
  the suite on a runtime where it is true.
