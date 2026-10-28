/**
 * Global HTTP-edge module (plan `D7`).
 *
 * Registers the two cross-cutting providers exactly once, so a feature module
 * only has to inject {@link ApiResponseService}:
 *
 * - `APP_FILTER` → {@link ApiExceptionFilter} (every throwable becomes the error
 *   envelope, except on `@SkipEnvelope()` routes);
 * - `APP_INTERCEPTOR` → {@link RequestIdInterceptor} (header echo only).
 *
 * `@Global()` because every controller will need `ok()`; requiring an explicit
 * import in each feature module would make it possible to forget one and ship a
 * bare payload.
 */

import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiResponseService } from './api-response.service.js';
import { RequestIdInterceptor } from './request-id.interceptor.js';

@Global()
@Module({
  providers: [
    ApiResponseService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
  ],
  exports: [ApiResponseService],
})
export class HttpModule {}
