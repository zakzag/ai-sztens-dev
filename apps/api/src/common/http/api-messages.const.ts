/**
 * Developer-facing messages and header names of the HTTP edge.
 *
 * Centralised for one reason: `INTERNAL_ERROR_MESSAGE` is a **security**
 * decision, not a string. A 5xx response must never reveal a stack trace, an SQL
 * fragment or a constraint name — the client gets this fixed sentence plus a
 * `requestId`, and the detail stays in the server log.
 */

import type { ApiErrorDetail } from '@callback/shared';

/** Fixed 5xx message; the only thing a client ever learns about a crash. */
export const INTERNAL_ERROR_MESSAGE = 'An unexpected server error occurred.';

/** Summary used when a payload does not match its shared zod schema. */
export const VALIDATION_FAILED_MESSAGE =
  'The request payload does not match the API contract.';

/** Default message of a `404` raised without a specific one. */
export const NOT_FOUND_MESSAGE = 'The requested resource does not exist.';

/**
 * Field detail of a stale write (AIS-108).
 *
 * Names `updatedAt` on purpose: it is the exact field the client has to refresh
 * (re-read the resource) before it can retry, so a generic “conflict” sentence
 * would leave the caller guessing.
 */
export const STALE_UPDATED_AT_DETAIL: ApiErrorDetail = {
  path: 'updatedAt',
  message: 'This resource changed since it was read; re-read it and retry.',
};

/** Inbound correlation header, echoed in `meta.requestId`. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Response header that carries the resolved correlation id. */
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-Id';
