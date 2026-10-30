/**
 * Request correlation (AIS-92, plan `D10`).
 *
 * Pure functions only — no Nest and no Fastify types, so the filter, the
 * interceptor and the `@ReqCtx()` decorator (in
 * `request-context.decorator.ts`) all build the same context from the same
 * rules. Four functions:
 *
 * - {@link isValidRequestId} — is this inbound value an acceptable correlation
 *   id at all? (length + character allow-list)
 * - {@link readRequestId} — is there a *usable* inbound `X-Request-Id`?
 *   (no generation)
 * - {@link resolveRequestId} — the id used in the envelope; generates one when
 *   neither the header nor Fastify's own id is available;
 * - {@link toRequestContext} — the `ErrorContext` handed to `ok()` / `fail()`.
 *
 * Preferring the inbound header means a client (or Caddy) can correlate a
 * request across services; Fastify's id is the fallback, a random UUID the last
 * resort so a context is never built without an id.
 */

import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from './api-messages.const.js';
import {
  REQUEST_ID_MAX_LENGTH,
  REQUEST_ID_PATTERN,
} from './request-id.const.js';
import type {
  HttpHeadersLike,
  HttpRequestLike,
  RequestContext,
} from './request-context.interface.js';

/**
 * Decides whether an inbound value may be used as a correlation id.
 *
 * The value ends up in a response header and in every log line, so anything
 * outside the allow-list (whitespace, newline, `<`, a 10 kB string) is refused
 * and the request gets a generated id instead.
 *
 * @param value - candidate read from the request (`unknown`: the wire is untyped).
 * @returns `true` only for a non-empty, length-bounded, allow-listed string.
 */
export function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

/**
 * Extracts the first usable value of a header (Node hands a repeated header
 * over as an array).
 *
 * @param raw - header value as Node exposes it.
 * @returns the trimmed, validated value, or `undefined`.
 */
function firstValidRequestId(raw: unknown): string | undefined {
  // `Array.isArray` narrows to `any[]`, so the element is re-typed as `unknown`
  // before validation — no unsafe assignment reaches the id.
  const candidate: unknown = Array.isArray(raw) ? raw[0] : raw;

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim();

  return isValidRequestId(trimmed) ? trimmed : undefined;
}

/**
 * Reads a **usable** inbound correlation header.
 *
 * An invalid value (blank, too long, forbidden character) is treated exactly
 * like an absent header, so {@link resolveRequestId} falls back to a trusted
 * source instead of echoing attacker-controlled text.
 *
 * @param headers - request headers (Node lower-cases the names).
 * @returns the first valid value, or `undefined` when unusable/absent.
 */
export function readRequestId(headers: HttpHeadersLike): string | undefined {
  return firstValidRequestId(headers[REQUEST_ID_HEADER]);
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
