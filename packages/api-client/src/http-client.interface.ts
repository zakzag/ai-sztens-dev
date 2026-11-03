/**
 * Contracts of the HTTP transport.
 *
 * Everything here is an interface so the transport can be doubled in tests and
 * swapped later (e.g. for an authenticated gateway) without touching a service.
 *
 * Six methods, two shapes:
 *
 * - the five data-only verbs (`get`, `post`, `put`, `patch`, `delete`) return the
 *   **payload** of the success envelope, because a service that reads one
 *   resource never needs the pager;
 * - `getList` returns `ApiResult<TRows>` (`data` + a mandatory `meta.pagination`),
 *   because that is the only place the pager block is meaningful.
 */

import type { z } from 'zod';
import type {
  ApiHttpMethod,
  ApiResult,
  ListQuery,
  ListQueryDefaults,
} from '@callback/shared';

/** Per-request options a caller may pass through. */
export interface RequestOptions {
  /** Abort signal, e.g. from a React Query cancellation. */
  readonly signal?: AbortSignal;
  /** Extra headers, merged over the defaults. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * One telemetry event of a finished attempt (AIS-109, `onEvent`).
 *
 * Deliberately narrow: method, path, status, duration, outcome. There is no
 * header, token or body field, so a listener **cannot** leak credentials or
 * personal data even by accident — the privacy is a property of the type, not of
 * the listener's discipline.
 */
export interface HttpEvent {
  /** HTTP verb of the attempt. */
  readonly method: ApiHttpMethod;
  /** Path relative to the base URL, **without** the query string. */
  readonly path: string;
  /** Response status, or `null` when no response was received (network error). */
  readonly status: number | null;
  /** Wall-clock duration of the attempt in milliseconds. */
  readonly durationMs: number;
  /** `success` only when a response arrived **and** its body parsed. */
  readonly outcome: 'success' | 'error';
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
  /**
   * Optional listener for finished attempts (notification capture, metrics).
   *
   * Optional on purpose: without it the transport behaves exactly as it did
   * before the hook existed. A listener that throws can never fail the request —
   * the emission is wrapped.
   */
  readonly onEvent?: (event: HttpEvent) => void;
}

/**
 * The query of a list call.
 *
 * `sort` is optional because not every resource is sortable; `defaults` carries
 * the resource's own default sort so the URL only contains what the user
 * actually changed (the omission rule lives in `toListQueryParams`).
 */
export interface ListRequest {
  /** The list query to encode. */
  readonly query: ListQuery & { readonly sort?: string };
  /** Values that count as “unchanged”; defaults to the shared list defaults. */
  readonly defaults?: ListQueryDefaults;
}

/**
 * Transport used by the services.
 *
 * Every method parses the body with the supplied zod schema, so the returned
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

  /** `POST path` with a JSON body, response parsed as `TRes`. */
  post<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;

  /** `PUT path` with a JSON body, response parsed as `TRes`. */
  put<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;

  /** `PATCH path` with a JSON body, response parsed as `TRes`. */
  patch<TBody, TRes>(
    path: string,
    body: TBody,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;

  /**
   * `DELETE path`, response parsed as `TRes`.
   *
   * No body parameter: the API convention has no body-carrying delete, so the
   * signature stays honest instead of accepting a payload the server ignores.
   */
  delete<TRes>(
    path: string,
    schema: z.ZodType<TRes>,
    options?: RequestOptions,
  ): Promise<TRes>;

  /**
   * `GET path?query`, response parsed as a paginated list.
   *
   * @param rowsSchema - schema of the **row array** (input equals output).
   * @returns the rows plus the guaranteed `meta.pagination` block.
   */
  getList<TRows>(
    path: string,
    rowsSchema: z.ZodType<TRows, z.ZodTypeDef, TRows>,
    request: ListRequest,
    options?: RequestOptions,
  ): Promise<ApiResult<TRows>>;
}
