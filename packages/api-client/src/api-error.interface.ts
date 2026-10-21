/**
 * Shapes describing an error raised by the API client.
 *
 * `ApiErrorBody` mirrors what Nest's exception filter puts on the wire:
 *
 * ```json
 * { "statusCode": 409, "message": "…", "error": "Conflict" }
 * ```
 *
 * `message` is a `string` for our own exceptions, but the global
 * `ValidationPipe` produces an **array** of messages, so both are accepted.
 */

/** Error body as produced by the Nest exception filter. */
export interface ApiErrorBody {
  readonly statusCode?: number;
  readonly message?: string | readonly string[];
  readonly error?: string;
}

/** Constructor options of {@link ApiError}. */
export interface ApiErrorInit {
  /** Technical, English message (never rendered as-is). */
  readonly message: string;
  /** HTTP status, or `null` when the request never produced a response. */
  readonly status: number | null;
  /** Absolute request URL, for logs. */
  readonly url?: string | null;
  /** Field-level or validator-level details, when the API sent any. */
  readonly details?: readonly string[];
  /** Original failure, kept for logging. */
  readonly cause?: unknown;
}
