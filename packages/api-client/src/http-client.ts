/**
 * The only place in the frontend that talks HTTP.
 *
 * Responsibilities are deliberately narrow:
 * 1. compose the URL from the injected `baseUrl`, the service path and — for a
 *    list — the encoded query,
 * 2. attach the optional bearer token,
 * 3. parse a successful body as the contract envelope and hand the service only
 *    its `data` (plan `D12`), or `data` + `meta` for a list (AIS-109),
 * 4. turn every failure — transport, HTTP status, schema mismatch — into one
 *    {@link ApiError} carrying `code`, `requestId` and `issues`,
 * 5. report the finished attempt through the optional `onEvent` hook.
 *
 * There is no React import and no `import.meta.env` read here: the base URL and
 * the token supplier are injected by the app's composition root
 * (`apps/admin/src/services/api-client.ts`), which keeps this package usable
 * from tests and from Node without a bundle.
 */

import type { z } from 'zod';
import type { ApiHttpMethod, ApiResult } from '@callback/shared';
import { toListQueryParams } from '@callback/shared';
import type { ApiErrorDetail } from '@callback/shared';
import {
  NETWORK_ERROR_MESSAGE,
  UNEXPECTED_PAYLOAD_CODE,
  UNEXPECTED_PAYLOAD_MESSAGE,
} from './api-error.const.js';
import {
  ApiError,
  formatIssueLine,
  parseErrorBody,
  toFailureMessage,
} from './api-error.js';
import { assertNoUnresolvedPathParameter } from './endpoint-path.js';
import { unwrapEnvelope } from './envelope.logic.js';
import { REQUEST_ID_HEADER } from './http-event.const.js';
import { toBodyPreview, toEventQuery, toResponseMeta } from './http-event.logic.js';
import { unwrapPaginatedEnvelope } from './paginated-envelope.logic.js';
import type {
  AttemptOutcome,
  AttemptRequest,
  HttpClient,
  HttpClientConfig,
  HttpEvent,
  HttpEventResponseMeta,
  ListRequest,
  RequestOptions,
} from './http-client.interface.js';

/**
 * Joins the base URL and a service path with exactly one slash.
 *
 * `'/api'` + `'api-keys'` and `'/api/'` + `'/api-keys'` both become
 * `'/api/api-keys'` — a double slash would 404 behind Caddy/nginx.
 */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Builds the request headers.
 *
 * `Content-Type` is only sent when a body exists, so a `GET`/`DELETE` never
 * advertises a body it does not have. A falsy token produces no `Authorization`
 * header at all (the API is unauthenticated until the auth story lands).
 */
function buildHeaders(
  config: HttpClientConfig,
  options: RequestOptions | undefined,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options?.headers,
  };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const token = config.getToken?.();
  if (typeof token === 'string' && token.length > 0) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Reads and parses the response body without ever throwing.
 *
 * An empty body (e.g. a proxy error page with no payload) and a non-JSON body
 * both yield `null`, which the callers treat as “no details available”.
 */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Intentional: a non-JSON error body is reported as “no details”, not as a
    // second failure that would hide the HTTP status.
    return null;
  }
}

/**
 * Builds the “contract drift” error, i.e. a 2xx body that does not match the
 * shared contract. Its code is client-side: the server never sent one.
 *
 * `issues` carries payload-relative paths (the `data.` wrapper is stripped by
 * the unwrap), so the admin can map a drift onto a form field — or, for a list,
 * onto the pager (`meta.pagination`) — and `details` is derived from the same
 * list, so the two can never disagree.
 *
 * @param response - the 2xx response that carried the drifting body.
 * @param url - absolute request URL, for logs.
 * @param issues - payload-relative field issues; never empty.
 * @param cause - the zod error behind the issues.
 */
function toPayloadError(
  response: Response,
  url: string,
  issues: readonly ApiErrorDetail[],
  cause: unknown,
): ApiError {
  return new ApiError({
    message: UNEXPECTED_PAYLOAD_MESSAGE,
    status: response.status,
    url,
    code: UNEXPECTED_PAYLOAD_CODE,
    issues,
    details: issues.map(formatIssueLine),
    cause,
  });
}

/**
 * Parses a 2xx body as the success envelope and returns its `data` plus the
 * traceable `meta` the telemetry event reports (AIS-152).
 *
 * All decoding happens in {@link unwrapEnvelope}; this function only owns the
 * transport concerns: reading the body, turning a failed unwrap into the
 * contract-drift {@link ApiError}, and deriving the event's meta from the **same**
 * body (never a second read).
 *
 * @throws {ApiError} with code `UNEXPECTED_PAYLOAD` when the unwrap fails.
 */
async function parsePayload<T>(
  response: Response,
  schema: z.ZodType<T>,
  url: string,
): Promise<AttemptOutcome<T>> {
  const body = await readBody(response);
  const result = unwrapEnvelope(schema, body);

  if (!result.ok) {
    throw toPayloadError(response, url, result.issues, result.cause);
  }

  return { data: result.data, responseMeta: toResponseMeta(body) };
}

/**
 * Parses a 2xx body as a paginated list and returns rows, pager metadata and the
 * traceable `meta` of the attempt.
 *
 * @throws {ApiError} with code `UNEXPECTED_PAYLOAD` when the unwrap fails,
 *   including a missing `meta.pagination` (issue path `meta.pagination`).
 */
async function parseListPayload<TRows>(
  response: Response,
  rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
  url: string,
): Promise<AttemptOutcome<ApiResult<TRows>>> {
  const body = await readBody(response);
  const result = unwrapPaginatedEnvelope(rowsSchema, body);

  if (!result.ok) {
    throw toPayloadError(response, url, result.issues, result.cause);
  }

  return {
    data: { data: result.data, meta: result.meta },
    responseMeta: toResponseMeta(body),
  };
}

/**
 * Converts a non-2xx response into an {@link ApiError}.
 *
 * @throws {ApiError} always — the return type is `never`.
 */
async function toFailure(response: Response, url: string): Promise<never> {
  const body = await readBody(response);
  const parsed = parseErrorBody(body);

  throw new ApiError({
    message: toFailureMessage(body, response.statusText),
    status: response.status,
    url,
    code: parsed.code,
    requestId: parsed.requestId,
    issues: parsed.issues,
    details: parsed.details,
  });
}

/**
 * @param path - a transport path, optionally carrying a query string.
 * @returns the pathname only, which is what a telemetry event may carry.
 */
function toEventPath(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

/**
 * Reads the correlation id out of the response headers.
 *
 * @param response - the received response.
 * @returns the header value, or `null` when the server sent none.
 */
function toHeaderRequestId(response: Response): string | null {
  const value = response.headers.get(REQUEST_ID_HEADER);

  return value === null || value.length === 0 ? null : value;
}

/**
 * Resolves the correlation id of a **failed** attempt (AIS-152 decision `D-A`).
 *
 * The header wins because the server sets it on error responses too; when it is
 * missing, the thrown `ApiError` already carries the envelope's `error.requestId`,
 * so no second body read is needed.
 *
 * @param response - the response that carried the failure.
 * @param error - whatever the failure path threw.
 * @returns the correlation id, or `null` when nothing identified the request.
 */
function toFailureRequestId(response: Response, error: unknown): string | null {
  const headerRequestId = toHeaderRequestId(response);

  if (headerRequestId !== null) {
    return headerRequestId;
  }

  return error instanceof ApiError ? error.requestId : null;
}

/**
 * Resolves the correlation id of a **successful** attempt.
 *
 * @param response - the 2xx response.
 * @param responseMeta - the validated `meta` of the body, when it had one.
 * @returns the header value first, then `meta.requestId`, otherwise `null`.
 */
function toSuccessRequestId(
  response: Response,
  responseMeta: HttpEventResponseMeta | null,
): string | null {
  return toHeaderRequestId(response) ?? responseMeta?.requestId ?? null;
}

/**
 * Hands a finished attempt to the configured listener.
 *
 * A listener is a consumer, never a participant: it cannot change the result and
 * cannot fail the request, so a throwing listener is swallowed on purpose (a
 * broken telemetry sink must not break the admin). Without a listener this is a
 * no-op, which is what keeps the pre-AIS-109 behaviour bit-for-bit.
 */
function emitEvent(config: HttpClientConfig, event: HttpEvent): void {
  const listener = config.onEvent;

  if (listener === undefined) {
    return;
  }

  try {
    listener(event);
  } catch {
    // Intentional: telemetry must never fail a request.
  }
}

/**
 * Creates the transport described by {@link HttpClientConfig}.
 *
 * @param config - base URL, optional token supplier, optional `fetch` double and
 *   optional `onEvent` listener.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;

  /**
   * Runs one attempt: guard the path, fetch, parse, and report the outcome.
   *
   * The two `try` blocks are deliberate. The first one covers `fetch` only, so a
   * dead network becomes the network `ApiError` and an unexpected error from the
   * parser is never misreported as a network failure. The second one observes the
   * parse result for telemetry and rethrows unchanged.
   *
   * The three values a listener may see (`eventPath`, `eventQuery`, `bodyPreview`)
   * are derived **once** here, so the three emit paths cannot disagree about what
   * the attempt looked like (AIS-152).
   */
  async function attempt<T>(request: AttemptRequest<T>): Promise<T> {
    const { method, path, init, body, parse, options } = request;

    assertNoUnresolvedPathParameter(path);

    const url = joinUrl(config.baseUrl, path);
    const eventPath = toEventPath(path);
    const eventQuery = toEventQuery(path);
    const bodyPreview = toBodyPreview(body);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: buildHeaders(config, options, init.body !== undefined),
        signal: options?.signal,
      });
    } catch (error) {
      emitEvent(config, {
        method,
        path: eventPath,
        status: null,
        durationMs: Date.now() - startedAt,
        outcome: 'error',
        requestId: null,
        query: eventQuery,
        bodyPreview,
        responseMeta: null,
      });

      throw new ApiError({
        message: NETWORK_ERROR_MESSAGE,
        status: null,
        url,
        cause: error,
      });
    }

    try {
      const outcome = response.ok
        ? await parse(response, url)
        : await toFailure(response, url);

      emitEvent(config, {
        method,
        path: eventPath,
        status: response.status,
        durationMs: Date.now() - startedAt,
        outcome: 'success',
        requestId: toSuccessRequestId(response, outcome.responseMeta),
        query: eventQuery,
        bodyPreview,
        responseMeta: outcome.responseMeta,
      });

      return outcome.data;
    } catch (error) {
      emitEvent(config, {
        method,
        path: eventPath,
        status: response.status,
        durationMs: Date.now() - startedAt,
        outcome: 'error',
        requestId: toFailureRequestId(response, error),
        query: eventQuery,
        bodyPreview,
        responseMeta: null,
      });

      throw error;
    }
  }

  return {
    get: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) =>
      attempt({
        method: 'GET',
        path,
        init: { method: 'GET' },
        body: undefined,
        parse: (response, url) => parsePayload(response, schema, url),
        options,
      }),

    post: <TBody, TRes>(
      path: string,
      body: TBody,
      schema: z.ZodType<TRes>,
      options?: RequestOptions,
    ) =>
      attempt({
        method: 'POST',
        path,
        init: { method: 'POST', body: JSON.stringify(body) },
        body,
        parse: (response, url) => parsePayload(response, schema, url),
        options,
      }),

    put: <TBody, TRes>(
      path: string,
      body: TBody,
      schema: z.ZodType<TRes>,
      options?: RequestOptions,
    ) =>
      attempt({
        method: 'PUT',
        path,
        init: { method: 'PUT', body: JSON.stringify(body) },
        body,
        parse: (response, url) => parsePayload(response, schema, url),
        options,
      }),

    patch: <TBody, TRes>(
      path: string,
      body: TBody,
      schema: z.ZodType<TRes>,
      options?: RequestOptions,
    ) =>
      attempt({
        method: 'PATCH',
        path,
        init: { method: 'PATCH', body: JSON.stringify(body) },
        body,
        parse: (response, url) => parsePayload(response, schema, url),
        options,
      }),

    delete: <TRes>(
      path: string,
      schema: z.ZodType<TRes>,
      options?: RequestOptions,
    ) =>
      attempt({
        method: 'DELETE',
        path,
        init: { method: 'DELETE' },
        body: undefined,
        parse: (response, url) => parsePayload(response, schema, url),
        options,
      }),

    getList: <TRows>(
      path: string,
      rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
      request: ListRequest,
      options?: RequestOptions,
    ) => {
      const search = toListQueryParams(
        request.query,
        request.defaults,
      ).toString();
      const requestPath = search.length === 0 ? path : `${path}?${search}`;

      return attempt({
        method: 'GET',
        path: requestPath,
        init: { method: 'GET' },
        body: undefined,
        parse: (response, url) => parseListPayload(response, rowsSchema, url),
        options,
      });
    },
  };
}
