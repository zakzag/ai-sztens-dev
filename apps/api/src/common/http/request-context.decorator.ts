/**
 * `@ReqCtx()` — the controller-facing half of request correlation (AIS-92).
 *
 * Kept in its own file because it is the only piece of the correlation layer
 * that depends on Nest: `request-context.ts` stays a pure module (readable and
 * testable without a Nest container), while this decorator is the single place
 * where a Nest `ExecutionContext` is turned into a {@link RequestContext}.
 *
 * Usage:
 *
 * ```ts
 * @Get()
 * async list(@ReqCtx() ctx: RequestContext): Promise<ApiEnvelope<readonly ApiKey[]>> {
 *   return this.responses.ok(await this.apiKeys.list(), ctx);
 * }
 * ```
 */

import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { toRequestContext } from './request-context.js';
import type {
  HttpRequestLike,
  RequestContext,
} from './request-context.interface.js';

/**
 * Reads the request out of a Nest execution context and builds its
 * {@link RequestContext}.
 *
 * Extracted from the decorator body so the mapping is a plain, directly
 * testable function: a param decorator can only be exercised through Nest's
 * reflection metadata, which would make the spec assert Nest internals instead
 * of our behaviour.
 *
 * @param executionContext - context of the request being handled.
 * @returns the correlation context of the current HTTP request.
 */
export function resolveRequestContext(
  executionContext: ExecutionContext,
): RequestContext {
  return toRequestContext(
    executionContext.switchToHttp().getRequest<HttpRequestLike>(),
  );
}

/**
 * Parameter decorator that hands the controller its {@link RequestContext}.
 *
 * The controller passes the context straight to `responses.ok(result, ctx)`, so
 * `meta.requestId` can never be forgotten, and the controller never touches the
 * raw request object (which keeps it mockable in unit tests).
 *
 * @returns the resolved context of the current HTTP request.
 */
export const ReqCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext =>
    resolveRequestContext(context),
);
