import { API_ERROR_CODE, HTTP_STATUS } from '../src/api-error.const.js';
import {
  ApiError,
  extractErrorDetails,
  formatIssueLine,
  isConflict,
  isNetworkError,
  isNotFoundError,
  isValidationError,
  parseErrorBody,
  toFailureMessage,
} from '../src/api-error.js';

/**
 * Unit tests for `src/api-error.ts` — the error model and its untrusted body
 * parsing.
 *
 * These cases are asserted directly instead of through the transport, because
 * the ticket's parse rules (a `details` that is not an array, a `null` body, a
 * code-only body) are facts about the parser, not about `fetch`.
 */

/** Builds a full contract error envelope body. */
function envelopeError(overrides: Record<string, unknown> = {}): unknown {
  return {
    error: {
      code: API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
      status: HTTP_STATUS.CONFLICT,
      message: 'identifier already exists',
      details: [{ path: 'identifier', message: 'already taken' }],
      requestId: 'req-1',
      timestamp: '2026-10-27T10:00:00.000Z',
      path: '/api/api-keys',
      ...overrides,
    },
  };
}

describe('API_ERROR_CODE re-export', () => {
  it('exposes the shared catalogue instead of a local copy', () => {
    expect(API_ERROR_CODE.NOT_FOUND).toBe('NOT_FOUND');
    expect(API_ERROR_CODE.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });
});

describe('parseErrorBody — contract envelope', () => {
  it('reads message, code, requestId and the field issues', () => {
    const parsed = parseErrorBody(envelopeError());

    expect(parsed.message).toBe('identifier already exists');
    expect(parsed.code).toBe(API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT);
    expect(parsed.requestId).toBe('req-1');
    expect(parsed.issues).toEqual([
      { path: 'identifier', message: 'already taken' },
    ]);
  });

  it('renders `details` as the projection of `issues`', () => {
    const parsed = parseErrorBody(envelopeError());

    expect(parsed.details).toEqual(['identifier: already taken']);
    expect(parsed.details).toHaveLength(parsed.issues.length);
  });

  it('keeps the message when the body has only a message', () => {
    const parsed = parseErrorBody({ error: { message: 'boom' } });

    expect(parsed.message).toBe('boom');
    expect(parsed.code).toBeNull();
    expect(parsed.requestId).toBeNull();
    expect(parsed.issues).toEqual([]);
  });

  it('keeps the code when the body has only a code', () => {
    const parsed = parseErrorBody({ error: { code: 'NOT_FOUND' } });

    expect(parsed.code).toBe('NOT_FOUND');
    expect(parsed.message).toBeNull();
    expect(parsed.details).toEqual([]);
  });

  it('ignores a `details` that is not an array', () => {
    const parsed = parseErrorBody(
      envelopeError({ details: 'identifier: already taken' }),
    );

    expect(parsed.issues).toEqual([]);
    expect(parsed.details).toEqual([]);
    expect(parsed.message).toBe('identifier already exists');
  });

  it('drops malformed `details` entries instead of throwing', () => {
    const parsed = parseErrorBody(
      envelopeError({
        details: [
          { path: 'identifier', message: 'already taken' },
          { path: 'identifier' },
          { message: 'no path' },
          'nonsense',
        ],
      }),
    );

    expect(parsed.issues).toEqual([
      { path: 'identifier', message: 'already taken' },
    ]);
  });

  it('treats a blank code as absent', () => {
    expect(parseErrorBody(envelopeError({ code: '   ' })).code).toBeNull();
  });

  it('falls back to the legacy body when `error` is not an object', () => {
    const parsed = parseErrorBody({
      error: 'Conflict',
      message: 'identifier already exists',
    });

    expect(parsed.message).toBe('identifier already exists');
    expect(parsed.code).toBeNull();
    expect(parsed.details).toEqual(['identifier already exists']);
  });
});

describe('parseErrorBody — legacy and unusable bodies', () => {
  it('reads a Nest string body', () => {
    const parsed = parseErrorBody({
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'The request payload does not match the API contract.',
    });

    expect(parsed.message).toBe('The request payload does not match the API contract.');
    expect(parsed.details).toEqual([
      'The request payload does not match the API contract.',
    ]);
    expect(parsed.code).toBeNull();
    expect(parsed.requestId).toBeNull();
    expect(parsed.issues).toEqual([]);
  });

  it('reads a Nest string[] body with the first line as the message', () => {
    const parsed = parseErrorBody({
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: ['identifier must not be empty', 'name must not be empty'],
    });

    expect(parsed.message).toBe('identifier must not be empty');
    expect(parsed.details).toEqual([
      'identifier must not be empty',
      'name must not be empty',
    ]);
  });

  it('ignores a legacy body without a usable message', () => {
    expect(parseErrorBody({ statusCode: 500, message: [] })).toEqual({
      message: null,
      code: null,
      requestId: null,
      issues: [],
      details: [],
    });
  });

  it('degrades a null body to an empty result', () => {
    expect(parseErrorBody(null).details).toEqual([]);
    expect(parseErrorBody(null).message).toBeNull();
  });

  it('degrades a string body to an empty result', () => {
    expect(parseErrorBody('<html>502 Bad Gateway</html>').details).toEqual([]);
  });
});

describe('extractErrorDetails', () => {
  it('returns the rendered lines of an envelope body', () => {
    expect(extractErrorDetails(envelopeError())).toEqual([
      'identifier: already taken',
    ]);
  });

  it('returns `[]` when nothing is usable', () => {
    expect(extractErrorDetails(undefined)).toEqual([]);
  });
});

describe('formatIssueLine', () => {
  it('prefixes the path when there is one', () => {
    expect(formatIssueLine({ path: 'identifier', message: 'taken' })).toBe(
      'identifier: taken',
    );
  });

  it('returns the bare message for a payload-level issue', () => {
    expect(formatIssueLine({ path: '', message: 'expected an object' })).toBe(
      'expected an object',
    );
  });
});

describe('toFailureMessage', () => {
  it('prefers the envelope message', () => {
    expect(toFailureMessage(envelopeError(), 'Conflict')).toBe(
      'identifier already exists',
    );
  });

  it('falls back to the first detail line', () => {
    expect(
      toFailureMessage(
        { error: { details: [{ path: 'identifier', message: 'taken' }] } },
        'Conflict',
      ),
    ).toBe('identifier: taken');
  });

  it('falls back to the status text', () => {
    expect(toFailureMessage(null, 'Bad Gateway')).toBe('Bad Gateway');
  });

  it('falls back to the technical message when there is no status text', () => {
    expect(toFailureMessage(null, '')).toBe('The request failed.');
  });
});

describe('ApiError guards', () => {
  const withStatus = (status: number | null): ApiError =>
    new ApiError({ message: 'failed', status });

  it('detects a conflict', () => {
    expect(isConflict(withStatus(HTTP_STATUS.CONFLICT))).toBe(true);
    expect(isConflict(withStatus(HTTP_STATUS.NOT_FOUND))).toBe(false);
  });

  it('detects a validation failure on 400 and 422', () => {
    expect(isValidationError(withStatus(HTTP_STATUS.BAD_REQUEST))).toBe(true);
    expect(isValidationError(withStatus(HTTP_STATUS.UNPROCESSABLE_ENTITY))).toBe(true);
    expect(isValidationError(withStatus(HTTP_STATUS.CONFLICT))).toBe(false);
  });

  it('detects a missing resource', () => {
    expect(isNotFoundError(withStatus(HTTP_STATUS.NOT_FOUND))).toBe(true);
    expect(isNotFoundError(withStatus(HTTP_STATUS.CONFLICT))).toBe(false);
  });

  it('detects a network failure by the missing status', () => {
    expect(isNetworkError(withStatus(null))).toBe(true);
    expect(isNetworkError(withStatus(HTTP_STATUS.INTERNAL_SERVER_ERROR))).toBe(false);
  });

  it('rejects values that are not an ApiError', () => {
    expect(isConflict(new Error('boom'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
