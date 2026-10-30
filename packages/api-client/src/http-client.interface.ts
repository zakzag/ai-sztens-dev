/**
 * Contracts of the HTTP transport.
 *
 * Everything here is an interface so the transport can be doubled in tests and
 * swapped later (e.g. for an authenticated gateway) without touching a service.
 */

import type { z } from 'zod';

/** Per-request options a caller may pass through. */
export interface RequestOptions {
  /** Abort signal, e.g. from a React Query cancellation. */
  readonly signal?: AbortSignal;
  /** Extra headers, merged over the defaults. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** Injected dependencies of the transport. */
export interface HttpClientConfig {
  /**
   * Base URL of the API, e.g. `/api` (Vite dev proxy) or
   * `https://api.example.com/api`. Paths are appended to it.
   */
  readonly baseUrl: string;
  /**
   * Optional bearer-token supplier.
   *
   * Called before every request; `null`/`undefined` means “send no
   * `Authorization` header”. The auth story can be wired in later without a
   * refactor of this package.
   */
  readonly getToken?: () => string | null | undefined;
  /**
   * `fetch` implementation. Defaults to the global one; tests inject a mock so
   * no request ever leaves the process.
   */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Transport used by the services.
 *
 * Both methods parse the body with the supplied zod schema, so the returned
 * value is already the domain type — a malformed payload is an `ApiError`, never
 * a partially-typed object.
 */
export interface HttpClient {
  /** `GET path`, body parsed as `T`. */
  get<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ): Promise<T>;
  /** `POST path` with a JSON body, response parsed as `T`. */
  post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ): Promise<T>;
}
