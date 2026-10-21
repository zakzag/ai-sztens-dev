/**
 * The single error → text mapping of the UI.
 *
 * Components and query hooks never render `error.message` directly: the backend
 * message is English and sometimes technical, while the user needs a sentence
 * that says what to do next. Keeping the mapping in one pure function means a
 * new status is handled once, and every page stays consistent.
 *
 * The decision is made on `ApiError.status` — never on message text (plan
 * decision **D4**), so a translated backend message cannot change the UI.
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';
import {
  CONFLICT_MESSAGE,
  FORBIDDEN_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  NOT_FOUND_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';

/**
 * Reads the first usable message out of the normalised error details.
 *
 * @param error - the normalised API failure.
 * @returns the first non-blank detail, or `null` when the API sent none.
 */
function firstDetail(error: ApiError): string | null {
  const [detail] = error.details;

  return typeof detail === 'string' && detail.trim().length > 0 ? detail : null;
}

/**
 * @param status - HTTP status, or `null` when no response was received.
 * @returns the 5xx range test result (kept as a named helper so the main
 *   function reads as a list of decisions).
 */
function isServerFailure(status: number | null): boolean {
  return status !== null && status >= 500;
}

/**
 * Maps any thrown value to a sentence the admin user can act on.
 *
 * @param error - whatever a hook or a service rejected with; never trusted.
 * @returns a Hungarian, user-facing message. Always a string — the UI never has
 *   to fall back on its own placeholder.
 */
export function toErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return UNKNOWN_ERROR_MESSAGE;
  }

  const status = error.status;

  switch (status) {
    case null:
      return NETWORK_ERROR_USER_MESSAGE;
    case HTTP_STATUS.UNAUTHORIZED:
      return SESSION_EXPIRED_MESSAGE;
    case HTTP_STATUS.FORBIDDEN:
      return FORBIDDEN_MESSAGE;
    case HTTP_STATUS.NOT_FOUND:
      return NOT_FOUND_MESSAGE;
    case HTTP_STATUS.CONFLICT:
      return firstDetail(error) ?? CONFLICT_MESSAGE;
    default:
      break;
  }

  if (
    status === HTTP_STATUS.BAD_REQUEST ||
    status === HTTP_STATUS.UNPROCESSABLE_ENTITY
  ) {
    return firstDetail(error) ?? VALIDATION_MESSAGE;
  }

  if (isServerFailure(status)) {
    return SERVER_ERROR_MESSAGE;
  }

  return firstDetail(error) ?? UNKNOWN_ERROR_MESSAGE;
}
