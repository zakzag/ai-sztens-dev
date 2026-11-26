/**
 * Constants of the transport's telemetry event (AIS-152).
 *
 * Every limit and every magic string of `HttpEvent` lives here, so the size of
 * what a listener receives is reviewable in one place instead of being scattered
 * across the emit paths. The limits exist because the event ends up in the
 * admin's log drawer and, through it, in `sessionStorage`: an unbounded body or
 * query string would blow the quota of a whole session.
 */

/** Upper bound of the request-body prefix carried by {@link HttpEvent.bodyPreview}. */
export const HTTP_BODY_PREVIEW_MAX_LENGTH = 500;

/** Upper bound of the query string carried by {@link HttpEvent.query}. */
export const HTTP_QUERY_MAX_LENGTH = 500;

/** Suffix appended to any value that had to be shortened, so truncation is visible. */
export const HTTP_EVENT_TRUNCATION_SUFFIX = '…';

/**
 * Response header the server echoes the correlation id in.
 *
 * Lower case on purpose: `Headers.get` is case insensitive, and a lower-case
 * literal is what the HTTP/2 wire actually carries.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Top-level body keys whose value must never enter the preview.
 *
 * The transport cannot rely on the notification store's redaction here: the
 * store redacts by **detail label**, and the whole body travels under one label,
 * so a credential nested inside the payload would survive. Masking happens on the
 * object before it is serialised, which is why the pattern matches the JSON key.
 */
export const HTTP_PREVIEW_SENSITIVE_KEY_PATTERN =
  /authorization|token|password|secret|api[_-]?key/i;

/** Replacement for a masked body value. */
export const HTTP_PREVIEW_REDACTED_PLACEHOLDER = '<redacted>';
