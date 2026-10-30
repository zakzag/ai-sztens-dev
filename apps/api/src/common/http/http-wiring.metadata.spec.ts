import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiResponseService } from './api-response.service.js';
import { RequestIdInterceptor } from './request-id.interceptor.js';

/**
 * Guard against the *invisible* DI failure: an injectable that is imported with
 * `import type` is erased at compile time, so `emitDecoratorMetadata` writes a
 * placeholder (`Function`) instead of the class into `design:paramtypes`.
 *
 * Why a separate spec: the failure is not visible to the type checker and not to
 * a unit test that constructs the class by hand — it only appears when Nest
 * resolves the provider graph. `ApiKeysModule` imports `HttpModule`, so the
 * `APP_FILTER` provider is instantiated there; on Node >= 24.9 the real-module
 * compile in `api-keys.module.spec.ts` runs and failed with
 * “Nest can't resolve dependencies of the ApiExceptionFilter
 * (ApiResponseService, ?)”. Below that runtime that spec self-skips, which is
 * exactly why this metadata spec exists: it runs on every Node version.
 *
 * The same defect class is documented in `vapi-webhooks.module.spec.ts`, where a
 * type-only `ConfigService` import once stopped the whole application from
 * booting.
 */

/** Metadata key emitted by `emitDecoratorMetadata` for ctor parameter types. */
const DESIGN_PARAMTYPES = 'design:paramtypes';

/** Placeholders the compiler writes when it cannot reference the real class. */
const ERASED_PLACEHOLDERS: readonly unknown[] = [Function, Object];

/**
 * @param target - a class whose constructor metadata is inspected.
 * @returns the emitted `design:paramtypes`, or `[]` when none was emitted.
 */
function paramTypesOf(
  target: new (...args: never[]) => unknown,
): readonly unknown[] {
  const metadata: unknown = Reflect.getMetadata(DESIGN_PARAMTYPES, target);

  if (!Array.isArray(metadata)) {
    return [];
  }

  // Re-typed element by element: `Array.isArray` narrows to `any[]`, and an
  // untyped element would silently weaken every assertion below.
  return metadata.map((type: unknown) => type);
}

describe('HTTP wiring metadata', () => {
  it('emits the real classes as ApiExceptionFilter dependencies', () => {
    expect(paramTypesOf(ApiExceptionFilter)).toEqual([
      ApiResponseService,
      Reflector,
    ]);
  });

  it('never emits an erased placeholder for a wired provider', () => {
    const wired = [
      ApiExceptionFilter,
      ApiResponseService,
      RequestIdInterceptor,
    ];

    for (const provider of wired) {
      for (const type of paramTypesOf(provider)) {
        expect(ERASED_PLACEHOLDERS).not.toContain(type);
      }
    }
  });

  it('emits the real ApiResponseService class, not a placeholder', () => {
    // Positive control for the check above: index [0] has always resolved, so a
    // failing assertion here would mean the spec itself is broken, not the code.
    expect(paramTypesOf(ApiExceptionFilter)[0]).toBe(ApiResponseService);
  });

  it('injects no dependencies into the request-id interceptor', () => {
    expect(paramTypesOf(RequestIdInterceptor)).toEqual([]);
  });
});
