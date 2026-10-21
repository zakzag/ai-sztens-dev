/**
 * The only place in the frontend that talks HTTP.
 *
 * Responsibilities are deliberately narrow:
 * 1. compose the URL from the injected `baseUrl` and the service path,
 * 2. attach the optional bearer token,
 * 3. turn every failure — transport, HTTP status, schema mismatch — into one
 *    {@link ApiError},
 * 4. parse a successful body with the caller's zod schema.
 *
 * There is no React import and no `import.meta.env` read here: the base URL and
 * the token supplier are injected by the app's composition root
 * (`apps/admin/src/services/api-client.ts`), which keeps this package usable
 * from tests and from Node without a bundle.
 */

import { z } from 'zod';
import {
  NETWORK_ERROR_MESSAGE,
  UNEXPECTED_PAYLOAD_MESSAGE,
} from './api-error.const.js';
import {
  ApiError,
  extractErrorDetails,
  toFailureMessage,
} from './api-error.js';
import type {
  HttpClient,
  HttpClientConfig,
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
 * `Content-Type` is only sent when a body exists, so a `GET` never advertises a
 * body it does not have. A falsy token produces no `Authorization` header at
 * all (the API is unauthenticated until the auth story lands).
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

/** Renders zod issues as `field: message` strings for the UI. */
function toContractDetails(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Parses a 2xx body with the supplied schema.
 *
 * @throws {ApiError} when the payload does not match the shared contract.
 */
async function parsePayload<T>(
  response: Response,
  schema: z.ZodType<T>,
  url: string,
): Promise<T> {
  const body = await readBody(response);
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError({
      message: UNEXPECTED_PAYLOAD_MESSAGE,
      status: response.status,
      url,
      details: toContractDetails(result.error),
      cause: result.error,
    });
  }

  return result.data;
}

/**
 * Converts a non-2xx response into an {@link ApiError}.
 *
 * @throws {ApiError} always — the return type is `never`.
 */
async function toFailure(response: Response, url: string): Promise<never> {
  const body = await readBody(response);

  throw new ApiError({
    message: toFailureMessage(body, response.statusText),
    status: response.status,
    url,
    details: extractErrorDetails(body),
  });
}

/**
 * Creates the transport described by {@link HttpClientConfig}.
 *
 * @param config - base URL, optional token supplier and optional `fetch` double.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = joinUrl(config.baseUrl, path);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: buildHeaders(config, options, init.body !== undefined),
        signal: options?.signal,
      });
    } catch (error) {
      throw new ApiError({
        message: NETWORK_ERROR_MESSAGE,
        status: null,
        url,
        cause: error,
      });
    }

    if (!response.ok) {
      return toFailure(response, url);
    }

    return parsePayload(response, schema, url);
  }

  return {
    get: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) =>
      request(path, { method: 'GET' }, schema, options),

    post: <T>(
      path: string,
      body: unknown,
      schema: z.ZodType<T>,
      options?: RequestOptions,
    ) =>
      request(
        path,
        { method: 'POST', body: JSON.stringify(body) },
        schema,
        options,
      ),
  };
}
