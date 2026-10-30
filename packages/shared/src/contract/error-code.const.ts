/**
 * The error-code catalogue (D8 of the API convention plan).
 *
 * `code` is the decision key on the client: it is stable, locale independent and
 * never a human sentence. The server always derives the HTTP status from this
 * table, so “which code with which status” cannot drift between the two sides.
 *
 * Two rules keep this safe to extend:
 *
 * 1. Generic codes map one-to-one to a status; a feature may emit a more
 *    specific code with the *same* status (e.g.
 *    {@link API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT} is a `409`).
 * 2. An unknown code (a newer server than the deployed bundle) must never break
 *    the client — it falls back to status-based copy, which is why
 *    {@link resolveApiErrorStatus} has a defined answer for it.
 */

import { HTTP_STATUS } from './http-status.const.js';

/** Every error code the contract knows. */
export const API_ERROR_CODE = {
  /** Shape validation failed; `details[]` carries the field paths. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** No credentials, or they are not valid. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Credentials are valid, the action is not allowed. */
  FORBIDDEN: 'FORBIDDEN',
  /** The addressed resource does not exist. */
  NOT_FOUND: 'NOT_FOUND',
  /** Generic uniqueness / state conflict. */
  CONFLICT: 'CONFLICT',
  /** Request body is larger than the configured limit. */
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  /** Rate limit exceeded. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Unexpected server failure; never carries internal details. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** A dependency is down; retryable. */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /** Domain specific: the `identifier` of an API key is already taken. */
  API_KEY_IDENTIFIER_CONFLICT: 'API_KEY_IDENTIFIER_CONFLICT',
} as const;

/** Union of the catalogue values. */
export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

/**
 * The status each code is sent with.
 *
 * `UNAUTHENTICATED` is the wire-level `401`, i.e. {@link HTTP_STATUS.UNAUTHORIZED};
 * the two names differ only because the code describes the cause and the status
 * describes the response.
 */
export const API_ERROR_CODE_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  [API_ERROR_CODE.VALIDATION_FAILED]: HTTP_STATUS.BAD_REQUEST,
  [API_ERROR_CODE.UNAUTHENTICATED]: HTTP_STATUS.UNAUTHORIZED,
  [API_ERROR_CODE.FORBIDDEN]: HTTP_STATUS.FORBIDDEN,
  [API_ERROR_CODE.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
  [API_ERROR_CODE.CONFLICT]: HTTP_STATUS.CONFLICT,
  [API_ERROR_CODE.PAYLOAD_TOO_LARGE]: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  [API_ERROR_CODE.RATE_LIMITED]: HTTP_STATUS.TOO_MANY_REQUESTS,
  [API_ERROR_CODE.INTERNAL_ERROR]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  [API_ERROR_CODE.SERVICE_UNAVAILABLE]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: HTTP_STATUS.CONFLICT,
};

/**
 * Status used when a code is not part of the catalogue.
 *
 * `500` on purpose: an unknown code is a programming error on the server, and a
 * client must never receive “success-looking” status for it.
 */
export const UNKNOWN_API_ERROR_CODE_STATUS = HTTP_STATUS.INTERNAL_SERVER_ERROR;
