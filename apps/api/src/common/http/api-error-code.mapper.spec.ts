import { API_ERROR_CODE, HTTP_STATUS } from '@callback/shared';
import type { ApiErrorCode } from '@callback/shared';
import { toApiErrorCode } from './api-error-code.mapper.js';

/**
 * The mapper is the **only** place where a foreign HTTP status becomes a
 * catalogue code, and the code decides the status we answer with. Two failure
 * modes are pinned here:
 *
 * - a Nest exception losing its meaning (e.g. `404` becoming a `500`), which
 *   would make the client's retry and copy decisions wrong;
 * - an *unmapped* status silently acquiring a soft code, which would hide a bug
 *   behind a 4xx-looking response — those must fall back to `INTERNAL_ERROR`.
 */

/** One row of the status → code table. */
interface MappingCase {
  /** Status produced by Nest, a guard or the body-size limit. */
  readonly status: number;
  /** Catalogue code the mapper must return. */
  readonly code: ApiErrorCode;
}

/** Every status the contract knows, including the shared `422` alias. */
const MAPPED: readonly MappingCase[] = [
  { status: HTTP_STATUS.BAD_REQUEST, code: API_ERROR_CODE.VALIDATION_FAILED },
  { status: HTTP_STATUS.UNAUTHORIZED, code: API_ERROR_CODE.UNAUTHENTICATED },
  { status: HTTP_STATUS.FORBIDDEN, code: API_ERROR_CODE.FORBIDDEN },
  { status: HTTP_STATUS.NOT_FOUND, code: API_ERROR_CODE.NOT_FOUND },
  { status: HTTP_STATUS.CONFLICT, code: API_ERROR_CODE.CONFLICT },
  {
    status: HTTP_STATUS.PAYLOAD_TOO_LARGE,
    code: API_ERROR_CODE.PAYLOAD_TOO_LARGE,
  },
  {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: API_ERROR_CODE.VALIDATION_FAILED,
  },
  { status: HTTP_STATUS.TOO_MANY_REQUESTS, code: API_ERROR_CODE.RATE_LIMITED },
  {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: API_ERROR_CODE.SERVICE_UNAVAILABLE,
  },
];

/** Statuses that must NOT resolve a soft code. */
const UNMAPPED: readonly number[] = [
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.OK,
  HTTP_STATUS.CREATED,
  // Deliberately outside the `HTTP_STATUS` catalogue (`418`), plus the numeric
  // edge cases that make a naive array lookup or `Object.prototype` access fail.
  418,
  0,
  -1,
  Number.NaN,
];

describe('toApiErrorCode', () => {
  it.each(MAPPED)('maps $status to $code', ({ status, code }) => {
    expect(toApiErrorCode(status)).toBe(code);
  });

  it.each(UNMAPPED)('falls back to INTERNAL_ERROR for status %i', (status) => {
    expect(toApiErrorCode(status)).toBe(API_ERROR_CODE.INTERNAL_ERROR);
  });

  it('never resolves a soft code for a success status', () => {
    // The code is what the envelope derives the status from, so a `200`/`201`
    // input must not acquire a 4xx code and ship a client error for a success.
    expect(toApiErrorCode(HTTP_STATUS.OK)).toBe(API_ERROR_CODE.INTERNAL_ERROR);
    expect(toApiErrorCode(HTTP_STATUS.CREATED)).toBe(
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  });

  it('returns only catalogue codes', () => {
    const codes = [
      ...MAPPED.map((row) => row.code),
      ...UNMAPPED.map((status) => toApiErrorCode(status)),
    ];

    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });
});
