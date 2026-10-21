/**
 * The single error type every failure of this package is normalised into.
 *
 * Callers (query hooks, forms) must never have to inspect a `Response` or a
 * `ZodError`: the reason is always answerable from the `status` and `details`
 * fields, which is what makes D4 in the plan (“409 is decided by status, never
 * by message text”) enforceable.
 */

import {
  API_ERROR_NAME,
  HTTP_STATUS,
  UNPARSEABLE_ERROR_MESSAGE,
} from './api-error.const.js';
import type {
  ApiErrorBody,
  ApiErrorInit,
} from './api-error.interface.js';

/** Normalised failure of an API call. */
export class ApiError extends Error {
  /** HTTP status, or `null` when no response was received. */
  readonly status: number | null;
  /** Absolute request URL, for logs and error reports. */
  readonly url: string | null;
  /** Field-level or validator-level details (`[]` when the API sent none). */
  readonly details: readonly string[];

  /**
   * @param init - message, status, url, details and the original cause.
   */
  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause });
    this.name = API_ERROR_NAME;
    this.status = init.status;
    this.url = init.url ?? null;
    this.details = init.details ?? [];
  }
}

/**
 * Reads the human-readable messages out of an untrusted error body.
 *
 * @param body - parsed JSON body, or `null` when parsing failed.
 * @returns `[]` when the body carries no message field.
 */
export function extractErrorDetails(body: unknown): readonly string[] {
  if (typeof body !== 'object' || body === null) {
    return [];
  }

  const message = (body as ApiErrorBody).message;

  if (typeof message === 'string') {
    return message.length > 0 ? [message] : [];
  }

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

/**
 * Builds the message for a failed response.
 *
 * @param body - parsed JSON body, or `null`.
 * @param statusText - the response's status text, used as the last resort.
 */
export function toFailureMessage(
  body: unknown,
  statusText: string,
): string {
  const [first] = extractErrorDetails(body);

  if (first !== undefined) {
    return first;
  }

  return statusText.length > 0 ? statusText : UNPARSEABLE_ERROR_MESSAGE;
}

/** @returns `true` for a duplicate-identifier (409) failure. */
export function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === HTTP_STATUS.CONFLICT;
}

/** @returns `true` for a payload validation (400/422) failure. */
export function isValidationError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === HTTP_STATUS.BAD_REQUEST ||
      error.status === HTTP_STATUS.UNPROCESSABLE_ENTITY)
  );
}

/** @returns `true` for a missing resource (404) failure. */
export function isNotFoundError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND;
}

/** @returns `true` when the request never reached the server. */
export function isNetworkError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === null;
}
