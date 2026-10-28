/**
 * Request correlation (AIS-92, plan `D10`).
 *
 * Three functions, no Nest types in the pure ones:
 *
 * - {@link readRequestId} — is there an inbound `X-Request-Id`? (no generation)
 * - {@link resolveRequestId} — the id used in the envelope; generates one when
 *   neither the header nor Fastify's own id is available;
 * - {@link toRequestContext} — the `ErrorContext` handed to `ok()` / `fail()`.
 *
 * Preferring the inbound header means a client (or Caddy) can correlate a
 * request across services; Fastify's id is the fallback, a random UUID the last
 * resort so a context is never built without an id.
 */

import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from './api-messages.const.js';
import type {
  HttpHeadersLike,
  HttpRequestLike,
  RequestContext,
} from './request-context.interface.js';

/**
 * Reads the inbound correlation header.
 *
 * @param headers - request headers (Node lower-cases the names).
 * @returns the first non-blank value, or `undefined` when the header is absent.
 */
export function readRequestId(headers: HttpHeadersLike): string | undefined {
  const raw = headers[REQUEST_ID_HEADER];

  if (typeof raw === 'string') {
    return raw.trim().length > 0 ? raw.trim() : undefined;
  }

  if (!Array.isArray(raw)) {
    return undefined;
  }

  // `Array.isArray` narrows a `readonly string[]` to `any[]`, so the element is
  // read as `unknown` first — no unsafe assignment reaches the id.
  const first: unknown = raw[0];

  return typeof first === 'string' && first.trim().length > 0
    ? first.trim()
    : undefined;
}

/**
 * Resolves the correlation id of a request, generating one when necessary.
 *
 * @param request - the (possibly partial) request object.
 * @returns a non-empty correlation id.
 */
export function resolveRequestId(request: HttpRequestLike): string {
  const inbound = readRequestId(request.headers);

  if (inbound !== undefined) {
    return inbound;
  }

  return typeof request.id === 'string' && request.id.length > 0
    ? request.id
    : randomUUID();
}

/**
 * Builds the context one response is built from.
 *
 * `now` is injectable so a test can assert the exact timestamp without freezing
 * the global clock.
 *
 * @param request - the (possibly partial) request object.
 * @param now - response timestamp (default: the current time).
 */
export function toRequestContext(
  request: HttpRequestLike,
  now: Date = new Date(),
): RequestContext {
  const url = typeof request.url === 'string' ? request.url : '';

  return {
    requestId: resolveRequestId(request),
    timestamp: now.toISOString(),
    path: url.length > 0 ? url : '/',
    method: typeof request.method === 'string' ? request.method : 'GET',
  };
}

/**
 * Parameter decorator that hands the controller its {@link RequestContext}.
 *
 * Used as `@ReqCtx() ctx: RequestContext`; the controller passes it straight to
 * `responses.ok(result, ctx)`, so `meta.requestId` can never be forgotten.
 */
export const ReqCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext =>
    toRequestContext(context.switchToHttp().getRequest<HttpRequestLike>()),
);
