/**
 * Shapes of the error envelope (D3 and D13 of the API convention plan).
 *
 * There is exactly one error shape on the wire. The client decides by `code`
 * (stable, locale independent) and never by `message` (English, for developers
 * and logs — it is never rendered as user copy).
 */

/** One field-level issue, addressable from a form. */
export interface ApiErrorDetail {
  /** Dot path of the offending field (`name`, `lines.2.quantity`), `''` for the whole payload. */
  readonly path: string;
  /** Developer-facing, English explanation of what is wrong. */
  readonly message: string;
}

/**
 * What a domain service knows about the failure it throws.
 *
 * `code` is typed as `string` on purpose: an unknown code must still produce a
 * valid envelope (with a `500` status), because a newer server must never be
 * able to break an older client's parsing.
 */
export interface AppErrorShape {
  /** One of {@link API_ERROR_CODE}; anything else maps to `INTERNAL_ERROR` status. */
  readonly code: string;
  /** English developer message, never shown to the user. */
  readonly message: string;
  /** Field-level issues; omitted means “no field is at fault”. */
  readonly details?: readonly ApiErrorDetail[];
}

/** Request facts the factory cannot invent without becoming impure. */
export interface ErrorContext {
  /** Correlation id of the request. */
  readonly requestId: string;
  /** ISO 8601 UTC timestamp of the response. */
  readonly timestamp: string;
  /** Requested route, e.g. `/api/api-keys`. */
  readonly path: string;
}

/** `error` — the single error body of the contract. */
export interface ApiErrorBody {
  /** Stable machine code; the client's decision key. */
  readonly code: string;
  /** HTTP status, derived from the code catalogue. */
  readonly status: number;
  /** English developer message; for 5xx always a fixed generic string. */
  readonly message: string;
  /** Always present, `[]` when no field is at fault. */
  readonly details: readonly ApiErrorDetail[];
  /** Correlation id, matching the server log line. */
  readonly requestId: string;
  /** ISO 8601 UTC timestamp of the response. */
  readonly timestamp: string;
  /** Requested route. */
  readonly path: string;
}

/** The error response body. */
export interface ApiErrorEnvelope {
  readonly error: ApiErrorBody;
}
