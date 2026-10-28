# 2026-10-28 12:07 — ApiExceptionFilter DI failure: type-only `Reflector` import fixed

## What was reported

`ApiKeysModule › resolves the controller, the service and the repository from the real
module` failed on the user's machine with:

```
Nest can't resolve dependencies of the ApiExceptionFilter (ApiResponseService, ?).
```

## Diagnosis

One root cause, confirmed by the compiled artefact, not by guesswork:

* [`apps/api/src/common/http/api-exception.filter.ts:25`](../../apps/api/src/common/http/api-exception.filter.ts:1)
  imported `Reflector` as `import type`, while the constructor injected it.
* `apps/api/dist/common/http/api-exception.filter.js` showed
  `__metadata("design:paramtypes", [ApiResponseService, Function])` — the class reference
  had been erased, so Nest had no provider token for index [1].
* `ApiKeysModule` imports `HttpModule`, which registers the filter as `APP_FILTER`;
  that is why this spec, and app boot, hit the failure while all unit specs passed.
* It only reproduces on Node ≥ 24.9, because `api-keys.module.spec.ts` self-skips the
  real-module compile below that (`JEST_CAN_REQUIRE_ESM`, local Node is 20.19.2) — which
  is also why the earlier commit run looked green.

## Change

1. `Reflector` is now a **value** import, with a comment explaining why it must stay one.
2. New `apps/api/src/common/http/http-wiring.metadata.spec.ts`:
   * `design:paramtypes` of `ApiExceptionFilter` must equal `[ApiResponseService, Reflector]`;
   * no wired provider may emit an erased placeholder (`Function` / `Object`);
   * `RequestIdInterceptor` must inject nothing.
   The spec runs on every Node version, so the self-skipping module spec can no longer
   be the only detector.

## Verification

```bash
pnpm --filter @callback/api test      # 24 suites, 212 passed (was 23 / 208)
pnpm --filter @callback/api build     # green
findstr /n "Reflector" apps\api\dist\common\http\api-exception.filter.js
# 12: import { Reflector } from '@nestjs/core';
# 82: Reflector])
```

## Notes

* A milestone was written for this fix (`docs/milestones/2026-10-28--12-07-00-api-exception-filter-type-only-reflector.milestone.md`):
  the symptom pointed at a missing provider, the cause was erased decorator metadata.
* Remaining gap: a lint gate that forbids `import type` for classes used in a decorated
  constructor is not implemented yet.
