import {
  API_ERROR_CODE,
  API_ERROR_CODE_STATUS,
  HTTP_STATUS,
  UNKNOWN_API_ERROR_CODE_STATUS,
  resolveApiErrorStatus,
} from '../src/index.js';

/**
 * Unit tests for the error-code catalogue (AIS-108).
 *
 * The catalogue is the one table the server, the OpenAPI document and the
 * client all decide from, so two things must hold and both are asserted here:
 *
 * 1. **Completeness** — every code has a status. A missing entry would make
 *    `resolveApiErrorStatus` return `undefined` and the server would send a
 *    status-less response.
 * 2. **The two new mutation codes** — `STALE_WRITE` (`409`) and
 *    `SEMANTIC_VALIDATION_FAILED` (`422`) — resolve to exactly the statuses the
 *    convention document promises, because the client's retry advice is keyed
 *    on those numbers.
 */

describe('API_ERROR_CODE catalogue', () => {
  it('catalogues STALE_WRITE as a 409 conflict', () => {
    expect(API_ERROR_CODE.STALE_WRITE).toBe('STALE_WRITE');
    expect(API_ERROR_CODE_STATUS[API_ERROR_CODE.STALE_WRITE]).toBe(
      HTTP_STATUS.CONFLICT,
    );
    expect(resolveApiErrorStatus(API_ERROR_CODE.STALE_WRITE)).toBe(409);
  });

  it('catalogues SEMANTIC_VALIDATION_FAILED as a 422', () => {
    expect(API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED).toBe(
      'SEMANTIC_VALIDATION_FAILED',
    );
    expect(
      API_ERROR_CODE_STATUS[API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED],
    ).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(resolveApiErrorStatus(API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED)).toBe(
      422,
    );
  });

  it('keeps the two mutation codes distinct from the generic CONFLICT', () => {
    // A stale write shares the status with CONFLICT but not the decision key:
    // the client has to re-read instead of picking another value.
    expect(API_ERROR_CODE.STALE_WRITE).not.toBe(API_ERROR_CODE.CONFLICT);
    // A 400 and a 422 are different causes, so they must be different codes.
    expect(API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED).not.toBe(
      API_ERROR_CODE.VALIDATION_FAILED,
    );
  });

  it('gives every catalogued code a status entry', () => {
    for (const code of Object.values(API_ERROR_CODE)) {
      expect(API_ERROR_CODE_STATUS[code]).toBeDefined();
      expect(typeof API_ERROR_CODE_STATUS[code]).toBe('number');
    }
  });

  it('maps every catalogued code to a status the contract knows', () => {
    const statuses = new Set<number>(Object.values(HTTP_STATUS));

    for (const status of Object.values(API_ERROR_CODE_STATUS)) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it('never maps two codes to an undocumented status', () => {
    for (const code of Object.values(API_ERROR_CODE)) {
      expect(API_ERROR_CODE_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });

  it('falls back to 500 for an unknown code', () => {
    // @ts-expect-error - an unknown code must be a compile error, but a newer
    // server could still send one, so the runtime answer has to exist.
    expect(resolveApiErrorStatus('SOMETHING_NEW')).toBe(
      UNKNOWN_API_ERROR_CODE_STATUS,
    );
    expect(UNKNOWN_API_ERROR_CODE_STATUS).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
  });
});
