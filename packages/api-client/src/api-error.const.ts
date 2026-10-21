/**
 * Constants of the transport layer.
 *
 * The statuses are named instead of written as literals at the call sites, so a
 * future change (e.g. treating 422 like 400) touches one place. The messages are
 * the technical fallbacks used when the response carries no usable body; the UI
 * never shows them verbatim, it maps the error through `toErrorMessage`.
 */

/** HTTP statuses the client reacts to explicitly. */
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
} as const;

/** `name` of every error raised by this package. */
export const API_ERROR_NAME = 'ApiError';

/** Message used when `fetch` itself failed (DNS, offline, CORS, abort). */
export const NETWORK_ERROR_MESSAGE = 'The request could not be completed.';

/** Message used when the response body does not match the shared schema. */
export const UNEXPECTED_PAYLOAD_MESSAGE =
  'The server returned an unexpected response payload.';

/** Message used when the error response body cannot be parsed as JSON. */
export const UNPARSEABLE_ERROR_MESSAGE = 'The request failed.';
