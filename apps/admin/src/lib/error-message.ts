/**
 * The single error → text mapping of the UI.
 *
 * Components and query hooks never render `error.message` directly: the backend
 * message is English and technical, while the user needs a sentence that says
 * what to do next.
 *
 * Decision order (plan `D3`, `D11`):
 *
 * 1. **no response** (`status === null`) → offline copy;
 * 2. **`code`** → the Hungarian copy from {@link ERROR_CODE_MESSAGE} — this is
 *    the primary key, because it is stable and locale independent;
 * 3. **`status`** → fallback copy, so a code from a newer server still produces
 *    a usable sentence instead of a crash.
 *
 * The server's own `message`/`details` are **never** used as user copy: they
 * exist for logs and for field-level mapping (see the form's `setError`), not for
 * the page alert.
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';
import {
  CONFLICT_MESSAGE,
  ERROR_CODE_MESSAGE,
  FORBIDDEN_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  NOT_FOUND_MESSAGE,
  SERVER_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';

/**
 * @param code - the envelope code, or `null` for a legacy body.
 * @returns the Hungarian copy, or `null` when the code is not mapped.
 */
function toCodeMessage(code: string | null): string | null {
  if (code === null) {
    return null;
  }

  return Object.hasOwn(ERROR_CODE_MESSAGE, code)
    ? (ERROR_CODE_MESSAGE[code] ?? null)
    : null;
}

/**
 * @param status - HTTP status of a failure (never `null` here).
 * @returns the status-based fallback copy.
 */
function toStatusMessage(status: number): string {
  switch (status) {
    case HTTP_STATUS.UNAUTHORIZED:
      return SESSION_EXPIRED_MESSAGE;
    case HTTP_STATUS.FORBIDDEN:
      return FORBIDDEN_MESSAGE;
    case HTTP_STATUS.NOT_FOUND:
      return NOT_FOUND_MESSAGE;
    case HTTP_STATUS.CONFLICT:
      return CONFLICT_MESSAGE;
    case HTTP_STATUS.BAD_REQUEST:
    case HTTP_STATUS.UNPROCESSABLE_ENTITY:
      return VALIDATION_MESSAGE;
    default:
      return status >= 500 ? SERVER_ERROR_MESSAGE : UNKNOWN_ERROR_MESSAGE;
  }
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

  // Destructured so the `null` check narrows `status` for the fallback call.
  const { status, code } = error;

  if (status === null) {
    return NETWORK_ERROR_USER_MESSAGE;
  }

  return toCodeMessage(code) ?? toStatusMessage(status);
}
