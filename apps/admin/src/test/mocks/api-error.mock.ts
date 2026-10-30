/**
 * `ApiError` factories for the admin tests.
 *
 * Every failure the UI has to distinguish is built here, in the shape the real
 * transport produces (`status` + `code` + `issues` + `details`), so a test never
 * hand-crafts an error object and a change of the `ApiErrorInit` contract breaks
 * one file instead of ten test suites.
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';

/** Backend text of a duplicate-identifier response (for logs only). */
export const CONFLICT_DETAIL = 'identifier must be unique';

/** Validator text of a rejected payload (for logs only). */
export const VALIDATION_DETAIL = 'identifier must match /^[A-Za-z0-9._-]+$/';

/**
 * Builds one error from the contract envelope.
 *
 * `issues` is the field-level list the UI maps onto inputs; `details` stays the
 * rendered projection so a test can assert either view of the same failure.
 *
 * @param init - status, code, optional message, issues, details and requestId.
 */
export function createCodedError(init: {
  readonly status: number;
  readonly code: string | null;
  readonly message?: string;
  readonly issues?: readonly {
    readonly path: string;
    readonly message: string;
  }[];
  readonly details?: readonly string[];
  readonly requestId?: string | null;
}): ApiError {
  return new ApiError({
    message: init.message ?? 'Request failed',
    status: init.status,
    url: '/api/api-keys',
    code: init.code,
    requestId: init.requestId ?? null,
    issues: init.issues ?? [],
    details: init.details ?? [],
  });
}

/**
 * @returns the failure of a duplicate identifier, with its domain code, the
 *   `issues[]` entry that addresses the `identifier` input and a requestId.
 */
export function createConflictError(): ApiError {
  return createCodedError({
    status: HTTP_STATUS.CONFLICT,
    code: 'API_KEY_IDENTIFIER_CONFLICT',
    message: 'identifier already exists',
    issues: [{ path: 'identifier', message: CONFLICT_DETAIL }],
    details: [`identifier: ${CONFLICT_DETAIL}`],
    requestId: 'req-conflict',
  });
}

/**
 * @returns a duplicate identifier as an older server reports it — the domain
 *   code, but no `issues[]` to say which field is at fault.
 */
export function createLegacyConflictError(): ApiError {
  return createCodedError({
    status: HTTP_STATUS.CONFLICT,
    code: 'API_KEY_IDENTIFIER_CONFLICT',
    message: 'identifier already exists',
    details: [CONFLICT_DETAIL],
    requestId: 'req-legacy-conflict',
  });
}

/**
 * @returns a `400` in which the server blames two inputs at once, plus a path
 *   no form field owns — the case that must split between fields and the alert.
 */
export function createMultiFieldValidationError(): ApiError {
  return createCodedError({
    status: HTTP_STATUS.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    message: 'The request payload does not match the API contract.',
    issues: [
      { path: 'name', message: 'String must contain at least 1 character(s)' },
      {
        path: 'apiKey',
        message: 'String must contain at least 8 character(s)',
      },
      { path: 'metadata.owner', message: 'Unrecognized key' },
    ],
    details: [
      `name: String must contain at least 1 character(s)`,
      `apiKey: String must contain at least 8 character(s)`,
      `metadata.owner: Unrecognized key`,
    ],
  });
}

/**
 * @returns the failure of a payload the backend rejected (`400`).
 */
export function createValidationError(): ApiError {
  return createCodedError({
    status: HTTP_STATUS.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    message: 'The request payload does not match the API contract.',
    issues: [{ path: 'identifier', message: VALIDATION_DETAIL }],
    details: [`identifier: ${VALIDATION_DETAIL}`],
  });
}

/**
 * @param status - the 5xx status to simulate; defaults to `500`.
 * @param withDetails - whether the body carries leftover detail text.
 * @returns the failure of a broken backend.
 */
export function createServerError(status = 500, withDetails = false): ApiError {
  return createCodedError({
    status,
    code:
      status === HTTP_STATUS.SERVICE_UNAVAILABLE
        ? 'SERVICE_UNAVAILABLE'
        : 'INTERNAL_ERROR',
    message: 'Internal server error',
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
 * @param code - the envelope code, `null` for a legacy body without one.
 * @returns a failure the UI has no field-level mapping for.
 */
export function createStatusError(
  status: number = HTTP_STATUS.FORBIDDEN,
  code: string | null = null,
): ApiError {
  return createCodedError({ status, code, message: 'Request failed' });
}

/**
 * @returns a rejection with the shape a cancelled request produces (`AbortError`
 *   from `fetch`, `CancelledError` from TanStack Query), so the classifier can
 *   be tested without involving a real transport.
 */
export function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

/**
 * @returns a broken-backend failure that also carries a correlation id, so the
 *   log tier (AIS-86) can be asserted against a realistic envelope.
 */
export function createServerErrorWithRequestId(): ApiError {
  return createCodedError({
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    requestId: 'req-server',
  });
}
