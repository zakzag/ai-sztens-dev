/**
 * Tests of the pure `api-keys` failure → form mapping.
 *
 * The interesting assertions are the negative ones:
 *
 * 1. a failure whose *message* says “conflict” but which is not an allowed
 *    `ApiError` code must not reach any field (plan `D4` — never match on text);
 * 2. a `409`/`500` whose code is outside the allow-list stays page-level even
 *    when it carries `details[]` paths (plan `D1`);
 * 3. the server's own `issue.message` never becomes user copy (plan `D4`).
 */

import { HTTP_STATUS } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  VALIDATION_DETAIL,
  createCodedError,
  createConflictError,
  createLegacyConflictError,
  createMultiFieldValidationError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import {
  API_KEY_IDENTIFIER_FIELD_MESSAGE,
  CONFLICT_MESSAGE,
  FIELD_INVALID_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from '../../lib/error-message.const.js';
import { toFieldErrors } from './api-keys.logic.js';

describe('toFieldErrors — allowed codes produce field errors', () => {
  it('maps a duplicate identifier onto the identifier field', () => {
    expect(toFieldErrors(createConflictError())).toEqual({
      fields: { identifier: API_KEY_IDENTIFIER_FIELD_MESSAGE },
      form: null,
    });
  });

  it('maps a validation issue onto its field', () => {
    expect(toFieldErrors(createValidationError())).toEqual({
      fields: { identifier: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });

  it('maps several bad fields at once, each on its own input', () => {
    expect(toFieldErrors(createMultiFieldValidationError()).fields).toEqual({
      name: FIELD_INVALID_MESSAGE,
      apiKey: FIELD_INVALID_MESSAGE,
    });
  });

  it('reports the unmappable path page-level while keeping the mapped fields', () => {
    expect(toFieldErrors(createMultiFieldValidationError()).form).toBe(
      VALIDATION_MESSAGE,
    );
  });

  it('keeps the first message of a duplicated path', () => {
    const error = createCodedError({
      status: HTTP_STATUS.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
      issues: [
        { path: 'name', message: 'first' },
        { path: 'name', message: 'second' },
      ],
    });

    expect(toFieldErrors(error)).toEqual({
      fields: { name: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });
});

describe('toFieldErrors — missing paths fall back to the code default', () => {
  it('keeps a legacy duplicate identifier on the identifier field', () => {
    expect(toFieldErrors(createLegacyConflictError())).toEqual({
      fields: { identifier: API_KEY_IDENTIFIER_FIELD_MESSAGE },
      form: null,
    });
  });

  it('reports a pathless validation failure page-level', () => {
    const error = createCodedError({
      status: HTTP_STATUS.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
    });

    expect(toFieldErrors(error)).toEqual({
      fields: {},
      form: VALIDATION_MESSAGE,
    });
  });
});

describe('toFieldErrors — everything else stays page-level', () => {
  it('ignores the paths of a non-allowed code', () => {
    const error = createCodedError({
      status: HTTP_STATUS.CONFLICT,
      code: 'CONFLICT',
      issues: [{ path: 'identifier', message: 'generic conflict' }],
    });

    expect(toFieldErrors(error)).toEqual({
      fields: {},
      form: CONFLICT_MESSAGE,
    });
  });

  it('reports a 409 without a code page-level', () => {
    expect(toFieldErrors(createStatusError(HTTP_STATUS.CONFLICT))).toEqual({
      fields: {},
      form: CONFLICT_MESSAGE,
    });
  });

  it('reports a server failure page-level, without its detail text', () => {
    const result = toFieldErrors(createServerError(500, true));

    expect(result).toEqual({ fields: {}, form: SERVER_ERROR_MESSAGE });
    expect(result.form).not.toContain('Database is unavailable');
  });

  it('reports a transport failure instead of the generic copy', () => {
    expect(toFieldErrors(createNetworkError())).toEqual({
      fields: {},
      form: NETWORK_ERROR_USER_MESSAGE,
    });
  });

  it('is not fooled by an error whose message mentions a conflict', () => {
    expect(toFieldErrors(new Error('Conflict: duplicate key'))).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
  });

  it('reports a thrown non-error page-level', () => {
    expect(toFieldErrors(null)).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
    expect(toFieldErrors(undefined)).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
    expect(toFieldErrors({ status: HTTP_STATUS.CONFLICT })).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
  });
});

describe('toFieldErrors — the server text never becomes user copy', () => {
  it('does not render the English issue message anywhere', () => {
    const result = toFieldErrors(createValidationError());
    const rendered = [result.form ?? '', ...Object.values(result.fields)].join(
      ' ',
    );

    expect(rendered).not.toContain(VALIDATION_DETAIL);
  });
});
