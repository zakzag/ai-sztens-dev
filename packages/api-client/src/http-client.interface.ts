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
 * Traceable metadata of a success response, as the event reports it (AIS-152).
 *
 * A subset of the envelope's `meta` on purpose: the log drawer shows where a
 * request can be found in the server log, not a copy of the whole envelope.
 */
export interface HttpEventResponseMeta {
  /** Correlation id of the response (`meta.requestId`). */
  readonly requestId: string;
  /** ISO 8601 UTC timestamp the server stamped the response with. */
  readonly timestamp: string;
  /**
   * Total row count of a paginated response (`meta.pagination.total`).
   *
   * `null` when the endpoint does not paginate — “no pager” and “zero rows” must
   * stay distinguishable.
   */
  readonly totalItems: number | null;
}

/**
 * One telemetry event of a finished attempt (AIS-109, `onEvent`; enriched by
 * AIS-152).
 *
 * What it **may** carry: the attempt's shape (method, path, query, status,
 * duration, outcome), the correlation ids, and a **masked, truncated prefix** of
 * the request body — enough for the log drawer to explain a failure without a
 * server log at hand.
 *
 * What it **never** carries: the token. No `Authorization` value and no other
 * header value exists on the type, and a sensitive top-level body key is masked
 * before the preview is serialised (AIS-152 decision `D-C`). Redacting the values
 * of the remaining fields is still the **store's** job (`redactValue` by detail
 * label), so this type is safe to record but its consumer decides what is shown.
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
  /**
   * Correlation id of the attempt (AIS-152 decision `D-A`).
   *
   * The `X-Request-Id` response header wins, because the server sets it on every
   * response, including a successful one. When the header is absent the value
   * falls back to the parsed envelope (`meta.requestId`) or, for a failure, to the
   * thrown `ApiError.requestId`. `null` when no response arrived at all.
   */
  readonly requestId: string | null;
  /**
   * Query string of the request, **without** the leading `?`.
   *
   * `''` when the call carried none. Emitted unfiltered (AIS-152 decision `D-B`)
   * and only length-clamped, so a filter the user typed is visible in the log.
   */
  readonly query: string;
  /**
   * Masked prefix of the serialised request payload.
   *
   * `null` for a body-less call (`GET`/`DELETE`) or an unserialisable payload. The
   * preview is built from the string that was actually sent, never from the
   * caller's object, and it is truncated to `HTTP_BODY_PREVIEW_MAX_LENGTH` with a
   * visible `…` suffix.
   */
  readonly bodyPreview: string | null;
  /**
   * `meta` of a parseable success envelope, or `null`.
   *
   * `null` on a network error, a non-2xx response, a contract drift and any body
   * without a valid `meta`.
   */
  readonly responseMeta: HttpEventResponseMeta | null;
}

/**
 * Result of parsing one successful attempt.
 *
 * `data` is what the caller receives; `responseMeta` is what the telemetry event
 * reports about the same body. They travel together because the body is read
 * once — parsing it twice just to build an event would double the cost of every
 * request (AIS-152 decision `D-J`).
 *
 * @typeParam T - the parsed payload handed to the service.
 */
export interface AttemptOutcome<T> {
  /** Parsed payload, exactly what the verb returns. */
  readonly data: T;
  /** Traceable `meta` of the envelope, `null` when the body had no valid one. */
  readonly responseMeta: HttpEventResponseMeta | null;
}

/**
 * One attempt to run, as the verb methods describe it.
 *
 * A single object instead of a growing positional parameter list: the preview of
 * the body belongs next to the body itself, and adding a field later cannot
 * silently shift a caller's argument (AIS-152 decision `D-J`).
 *
 * @typeParam T - the parsed payload type of the attempt.
 */
export interface AttemptRequest<T> {
  /** HTTP verb of the attempt. */
  readonly method: ApiHttpMethod;
  /** Path, optionally carrying the query string. */
  readonly path: string;
  /** What `fetch` receives (minus the headers the transport composes). */
  readonly init: RequestInit;
  /**
   * The payload the body preview is derived from.
   *
   * `undefined` for a body-less verb; the value is the caller's object, **not**
   * the serialised string, so the preview can mask a sensitive key.
   */
  readonly body: unknown;
  /** Reads `data` and `meta` out of a 2xx response. */
  readonly parse: (response: Response, url: string) => Promise<AttemptOutcome<T>>;
  /** Per-request options passed by the caller. */
  readonly options?: RequestOptions;
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
