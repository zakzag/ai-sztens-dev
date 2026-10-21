/**
 * `ApiError` factories for the admin tests.
 *
 * Every failure the UI has to distinguish is built here, in the shape the real
 * transport produces (`status` + `details`), so a test never hand-crafts an
 * error object and a change of the `ApiErrorInit` contract breaks one file
 * instead of ten test suites.
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';

/** Backend text of a duplicate-identifier response (from `apps/api`). */
export const CONFLICT_DETAIL = 'identifier must be unique';

/** Validator text of a rejected payload (Nest `ValidationPipe` output). */
export const VALIDATION_DETAIL = 'identifier must match /^[A-Za-z0-9._-]+$/';

/**
 * @param message - technical message; defaults to the Nest conflict text.
 * @returns the failure of a duplicate identifier (`409`).
 */
export function createConflictError(
  message = 'Identifier already exists',
): ApiError {
  return new ApiError({
    message,
    status: HTTP_STATUS.CONFLICT,
    url: '/api/api-keys',
    details: [CONFLICT_DETAIL],
  });
}

/**
 * @param message - technical message; defaults to the Nest validation text.
 * @returns the failure of a payload the backend rejected (`400`).
 */
export function createValidationError(
  message = VALIDATION_DETAIL,
): ApiError {
  return new ApiError({
    message,
    status: HTTP_STATUS.BAD_REQUEST,
    url: '/api/api-keys',
    details: [message],
  });
}

/**
 * @param status - the 5xx status to simulate; defaults to `500`.
 * @param withDetails - whether the body carries a message.
 * @returns the failure of a broken backend.
 */
export function createServerError(
  status = 500,
  withDetails = false,
): ApiError {
  return new ApiError({
    message: 'Internal server error',
    status,
    url: '/api/api-keys',
    details: withDetails ? ['Database is unavailable'] : [],
  });
}

/**
 * @returns the failure of a request that never reached the server
 *   (`status: null` — offline, DNS, CORS or abort).
 */
export function createNetworkError(): ApiError {
  return new ApiError({
    message: 'The request could not be completed.',
    status: null,
    url: '/api/api-keys',
  });
}

/**
 * @param status - the 4xx status to simulate; defaults to `403`.
 * @returns a failure the UI has no field-level mapping for.
 */
export function createStatusError(status: number = HTTP_STATUS.FORBIDDEN): ApiError {
  return new ApiError({
    message: 'Request failed',
    status,
    url: '/api/api-keys',
    details: [],
  });
}
