/**
 * Constants of the transport layer.
 *
 * The statuses are named instead of written as literals at the call sites, so a
 * future change (e.g. treating 422 like 400) touches one place. They come from
 * `@callback/shared` — the client and the server must not keep two copies of the
 * same table (D5 of the API convention plan). The messages are the technical
 * fallbacks used when the response carries no usable body; the UI never shows
 * them verbatim, it maps the error through `toErrorMessage`.
 */

import { HTTP_STATUS } from '@callback/shared';

export { HTTP_STATUS };

/** `name` of every error raised by this package. */
export const API_ERROR_NAME = 'ApiError';

/** Message used when `fetch` itself failed (DNS, offline, CORS, abort). */
export const NETWORK_ERROR_MESSAGE = 'The request could not be completed.';

/** Message used when the response body does not match the shared schema. */
export const UNEXPECTED_PAYLOAD_MESSAGE =
  'The server returned an unexpected response payload.';

/**
 * Client-side error code for a contract drift.
 *
 * The server never sends this: it marks a response that did **not** follow the
 * contract (missing `data`, wrong field type, a bare body). It exists so the
 * log drawer can file a drift under a code instead of guessing from a message.
 */
export const UNEXPECTED_PAYLOAD_CODE = 'UNEXPECTED_PAYLOAD';

/** Message used when the error response body cannot be parsed as JSON. */
export const UNPARSEABLE_ERROR_MESSAGE = 'The request failed.';
