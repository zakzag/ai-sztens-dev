/**
 * Shapes of the request facts the envelope layer needs (plan `D10`).
 *
 * They are declared structurally instead of importing Fastify's types: the
 * filter, the decorator and the interceptor are unit-tested with plain objects,
 * and a Fastify upgrade must not be able to break the tests.
 */

import type { ErrorContext } from '@callback/shared';

/** Headers as Node exposes them (a repeated header arrives as an array). */
export type HttpHeadersLike = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/** The subset of a Fastify request the HTTP edge relies on. */
export interface HttpRequestLike {
  /** Fastify-generated request id (always present in a real request). */
  readonly id?: unknown;
  /** HTTP verb, for the log line. */
  readonly method?: unknown;
  /** Requested URL, e.g. `/api/api-keys?limit=20`. */
  readonly url?: unknown;
  /** Request headers, used to accept an inbound `X-Request-Id`. */
  readonly headers: HttpHeadersLike;
  /**
   * Fastify's matched-route descriptor. `url` is the **route pattern**
   * (`/api/api-keys/:identifier`), not the concrete URL, which is what the
   * exemption allow-list is written in.
   */
  readonly routeOptions?: {
    /** Route pattern of the matched route. */
    readonly url?: unknown;
  };
}

/** The subset of a Fastify reply the HTTP edge relies on. */
export interface HttpReplyLike {
  /** Sets a response header. */
  header(name: string, value: string): HttpReplyLike;
  /** Sets the status code. */
  status(code: number): HttpReplyLike;
  /** Sends the body. */
  send(body: unknown): unknown;
}

/**
 * Everything one response needs to be traceable.
 *
 * Extends the shared {@link ErrorContext} (which the error factory consumes), so
 * the same object can be passed to `ok()` and `fail()`.
 */
export interface RequestContext extends ErrorContext {
  /** HTTP verb, used only for logging. */
  readonly method: string;
}
