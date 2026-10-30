/**
 * Shapes of the success envelope (D2 of the API convention plan).
 *
 * Every successful response is `{ data, meta }`, without exception:
 *
 * - `data` is **always present** — `[]` for an empty list, `null` when the call
 *   succeeded but has nothing to return (never `204`, so the client always
 *   parses one shape);
 * - `meta` is **always present** and carries `requestId` + `timestamp`, which is
 *   what makes every response traceable to a server log line.
 */

/** `meta.pagination` — present only on paginated lists. */
export interface PaginationMeta {
  /** 1-based page number. */
  readonly page: number;
  /** Page size the server actually applied. */
  readonly limit: number;
  /** Total number of matching rows. */
  readonly total: number;
  /** `ceil(total / limit)`; `0` when nothing matches. */
  readonly totalPages: number;
}

/** `meta` of every successful response. */
export interface ResponseMeta {
  /** Correlation id of the request (`X-Request-Id`), echoed by the server. */
  readonly requestId: string;
  /** ISO 8601 UTC timestamp of the response. */
  readonly timestamp: string;
  /** Present only when the endpoint paginates; absent, never `null`. */
  readonly pagination?: PaginationMeta;
}

/** A successful response body. */
export interface ApiEnvelope<T> {
  /** `null` only for a success that has nothing to return (e.g. a delete). */
  readonly data: T | null;
  /** Always present. */
  readonly meta: ResponseMeta;
}
