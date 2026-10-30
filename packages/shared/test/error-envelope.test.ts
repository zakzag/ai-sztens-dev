import {
  API_ERROR_CODE,
  API_ERROR_CODE_STATUS,
  UNKNOWN_API_ERROR_CODE_STATUS,
} from '../src/contract/error-code.const.js';
import {
  apiErrorEnvelopeSchema,
  resolveApiErrorStatus,
  toErrorEnvelope,
} from '../src/contract/error-envelope.js';
import type {
  ApiErrorEnvelope,
  ErrorContext,
} from '../src/contract/error-envelope.interface.js';

/**
 * Unit tests for `src/contract/error-envelope.ts` and `error-code.const.ts`
 * (D3, D8, D13).
 *
 * The status is derived from the code catalogue, so the table below *is* the
 * assertion: a code whose status drifts would change a client decision. The
 * unknown-code cases pin the forward-compatibility promise — a newer server
 * still produces a body an older client can parse.
 */

const CTX: ErrorContext = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
  path: '/api/api-keys',
};

describe('API_ERROR_CODE catalogue', () => {
  const codes = Object.values(API_ERROR_CODE);

  it('declares every catalogued code exactly once', () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('maps every catalogued code to a Client-or-Server error status', () => {
    for (const code of codes) {
      const status = API_ERROR_CODE_STATUS[code];

      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThanOrEqual(599);
    }
  });

  it('has no catalogue entry for a code that is not declared', () => {
    expect(Object.keys(API_ERROR_CODE_STATUS).sort()).toEqual(
      [...codes].sort(),
    );
  });
});

describe('resolveApiErrorStatus', () => {
  it.each([
    [API_ERROR_CODE.VALIDATION_FAILED, 400],
    [API_ERROR_CODE.UNAUTHENTICATED, 401],
    [API_ERROR_CODE.FORBIDDEN, 403],
    [API_ERROR_CODE.NOT_FOUND, 404],
    [API_ERROR_CODE.CONFLICT, 409],
    [API_ERROR_CODE.PAYLOAD_TOO_LARGE, 413],
    [API_ERROR_CODE.RATE_LIMITED, 429],
    [API_ERROR_CODE.INTERNAL_ERROR, 500],
    [API_ERROR_CODE.SERVICE_UNAVAILABLE, 503],
    [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT, 409],
  ])('maps %s to %i', (code, status) => {
    expect(resolveApiErrorStatus(code)).toBe(status);
  });

  it('falls back to the internal-error status for an unknown code', () => {
    expect(resolveApiErrorStatus('SOMETHING_FROM_A_NEWER_SERVER')).toBe(
      UNKNOWN_API_ERROR_CODE_STATUS,
    );
    expect(UNKNOWN_API_ERROR_CODE_STATUS).toBe(500);
  });

  it('does not resolve an inherited object key', () => {
    expect(resolveApiErrorStatus('toString')).toBe(
      UNKNOWN_API_ERROR_CODE_STATUS,
    );
  });
});

describe('toErrorEnvelope', () => {
  it('builds the envelope with an empty details array by default', () => {
    const envelope = toErrorEnvelope(
      {
        code: API_ERROR_CODE.NOT_FOUND,
        message: 'api key not found',
      },
      CTX,
    );

    expect(envelope.error.details).toEqual([]);
    expect(envelope.error.status).toBe(404);
    expect(envelope.error.requestId).toBe(CTX.requestId);
    expect(envelope.error.timestamp).toBe(CTX.timestamp);
    expect(envelope.error.path).toBe(CTX.path);
  });

  it('keeps the field-level details as { path, message } pairs', () => {
    const details = [
      { path: 'identifier', message: 'already taken' },
      { path: 'name', message: 'must not be empty' },
    ];

    const envelope = toErrorEnvelope(
      {
        code: API_ERROR_CODE.VALIDATION_FAILED,
        message: 'validation failed',
        details,
      },
      CTX,
    );

    expect(envelope.error.details).toEqual(details);
    expect(envelope.error.status).toBe(400);
  });

  it('copies the details instead of sharing the caller array', () => {
    const details = [{ path: 'name', message: 'required' }];

    const envelope = toErrorEnvelope(
      { code: API_ERROR_CODE.VALIDATION_FAILED, message: 'x', details },
      CTX,
    );

    expect(envelope.error.details).not.toBe(details);
    expect(envelope.error.details[0]).toEqual(details[0]);
  });

  it('gives a domain-specific conflict code the 409 status', () => {
    const envelope = toErrorEnvelope(
      {
        code: API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
        message: 'identifier already exists',
        details: [{ path: 'identifier', message: 'already taken' }],
      },
      CTX,
    );

    expect(envelope.error.status).toBe(409);
    expect(envelope.error.details[0]?.path).toBe('identifier');
  });

  it('still produces a parseable envelope for an unknown code', () => {
    const envelope: ApiErrorEnvelope = toErrorEnvelope(
      { code: 'UNKNOWN_FROM_THE_FUTURE', message: 'what happened?' },
      CTX,
    );

    expect(envelope.error.code).toBe('UNKNOWN_FROM_THE_FUTURE');
    expect(envelope.error.status).toBe(500);
    expect(apiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });

  it('produces an envelope that the shared schema parses', () => {
    const envelope = toErrorEnvelope(
      { code: API_ERROR_CODE.CONFLICT, message: 'conflict' },
      CTX,
    );

    expect(apiErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });
});

describe('apiErrorEnvelopeSchema', () => {
  const VALID_BODY = {
    error: {
      code: 'VALIDATION_FAILED',
      status: 400,
      message: 'validation failed',
      details: [{ path: 'name', message: 'must not be empty' }],
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      path: CTX.path,
    },
  };

  it('parses a real error response body', () => {
    expect(apiErrorEnvelopeSchema.parse(VALID_BODY)).toEqual(VALID_BODY);
  });

  it('accepts an unknown code, so a newer server cannot break the client', () => {
    const parsed = apiErrorEnvelopeSchema.parse({
      ...VALID_BODY,
      error: { ...VALID_BODY.error, code: 'BRAND_NEW_CODE' },
    });

    expect(parsed.error.code).toBe('BRAND_NEW_CODE');
  });

  it('rejects a success status in an error body', () => {
    expect(() =>
      apiErrorEnvelopeSchema.parse({
        ...VALID_BODY,
        error: { ...VALID_BODY.error, status: 200 },
      }),
    ).toThrow();
  });

  it('rejects a missing requestId', () => {
    const { requestId, ...withoutRequestId } = VALID_BODY.error;

    expect(requestId).toBe(CTX.requestId);
    expect(() =>
      apiErrorEnvelopeSchema.parse({ error: withoutRequestId }),
    ).toThrow();
  });

  it('rejects an empty code', () => {
    expect(() =>
      apiErrorEnvelopeSchema.parse({
        ...VALID_BODY,
        error: { ...VALID_BODY.error, code: '' },
      }),
    ).toThrow();
  });

  it('rejects an error body without details', () => {
    const { details, ...withoutDetails } = VALID_BODY.error;

    expect(details).toHaveLength(1);
    expect(() =>
      apiErrorEnvelopeSchema.parse({ error: withoutDetails }),
    ).toThrow();
  });

  it('rejects a timestamp without a timezone', () => {
    expect(() =>
      apiErrorEnvelopeSchema.parse({
        ...VALID_BODY,
        error: { ...VALID_BODY.error, timestamp: '2026-10-26T15:21:48' },
      }),
    ).toThrow();
  });
});
