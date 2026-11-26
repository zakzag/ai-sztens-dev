/**
 * Tests of the generic failure → form mapping (AIS-111).
 *
 * The interesting assertions are the negative ones:
 *
 * 1. a failure whose *message* says “conflict” but which is not a field-capable
 *    `ApiError` code must not reach any field (plan `D4` — never match on text);
 * 2. a `409`/`500` whose code stays page-level does so even when it carries
 *    `issues[]` paths (ticket rule 2);
 * 3. the server's own `issue.message` never becomes user copy;
 * 4. a cancellation renders **nothing**, matching `toErrorSurface` → `silent`.
 *
 * The target is built from plain strings on purpose: this suite must prove the
 * mapper knows no domain field names.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { API_ERROR_CODE } from '@callback/shared';
import { describe, expect, it } from 'vitest';
import {
  VALIDATION_DETAIL,
  createAbortError,
  createCancelledError,
  createCodedError,
  createConflictError,
  createLegacyConflictError,
  createMultiFieldValidationError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
} from '../test/mocks/api-error.mock.js';
import { toFieldErrors } from './field-errors.logic.js';
import {
  API_KEY_IDENTIFIER_FIELD_MESSAGE,
  CONFLICT_MESSAGE,
  FIELD_INVALID_MESSAGE,
  IDENTIFIER_CONFLICT_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  SERVER_ERROR_MESSAGE,
  STALE_WRITE_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';
import type { FieldErrorTarget } from './field-errors.interface.js';

/** The five inputs the api-keys create form owns. */
const API_KEY_FIELDS = [
  'name',
  'identifier',
  'description',
  'apiKey',
  'expiresAt',
] as const;

/** The target `ApiKeyForm` passes to the mapper. */
const API_KEY_TARGET: FieldErrorTarget<(typeof API_KEY_FIELDS)[number]> = {
  fieldPaths: API_KEY_FIELDS,
  defaultPathByCode: {
    [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: 'identifier',
  },
};

describe('toFieldErrors — field-capable codes produce field errors', () => {
  it('maps a duplicate identifier onto the identifier field', () => {
    expect(toFieldErrors(createConflictError(), API_KEY_TARGET)).toEqual({
      fields: { identifier: API_KEY_IDENTIFIER_FIELD_MESSAGE },
      form: null,
    });
  });

  it('maps a validation issue onto its field', () => {
    expect(toFieldErrors(createValidationError(), API_KEY_TARGET)).toEqual({
      fields: { identifier: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });

  it('maps several bad fields at once, each on its own input', () => {
    expect(
      toFieldErrors(createMultiFieldValidationError(), API_KEY_TARGET).fields,
    ).toEqual({
      name: FIELD_INVALID_MESSAGE,
      apiKey: FIELD_INVALID_MESSAGE,
    });
  });

  it('reports the unmappable path page-level while keeping the mapped fields', () => {
    expect(
      toFieldErrors(createMultiFieldValidationError(), API_KEY_TARGET).form,
    ).toBe(VALIDATION_MESSAGE);
  });

  it('keeps the first message of a duplicated path', () => {
    const error = createCodedError({
      status: HTTP_STATUS.BAD_REQUEST,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      issues: [
        { path: 'name', message: 'first' },
        { path: 'name', message: 'second' },
      ],
    });

    expect(toFieldErrors(error, API_KEY_TARGET)).toEqual({
      fields: { name: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });

  it('blames the offending field of a semantic validation failure', () => {
    const error = createCodedError({
      status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      code: API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      issues: [{ path: 'expiresAt', message: 'Date must be in the future' }],
    });

    expect(toFieldErrors(error, API_KEY_TARGET)).toEqual({
      fields: { expiresAt: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });

  it('works with any field list, without knowing the domain', () => {
    const target = { fieldPaths: ['a', 'b'] } as const;
    const error = createCodedError({
      status: HTTP_STATUS.BAD_REQUEST,
      code: API_ERROR_CODE.VALIDATION_FAILED,
      issues: [{ path: 'b', message: 'invalid' }],
    });

    expect(toFieldErrors(error, target)).toEqual({
      fields: { b: FIELD_INVALID_MESSAGE },
      form: null,
    });
  });
});

describe('toFieldErrors — missing paths fall back to the code default', () => {
  it('keeps a legacy duplicate identifier on the identifier field', () => {
    expect(toFieldErrors(createLegacyConflictError(), API_KEY_TARGET)).toEqual({
      fields: { identifier: API_KEY_IDENTIFIER_FIELD_MESSAGE },
      form: null,
    });
  });

  it('reports a pathless validation failure page-level', () => {
    const error = createCodedError({
      status: HTTP_STATUS.BAD_REQUEST,
      code: API_ERROR_CODE.VALIDATION_FAILED,
    });

    expect(toFieldErrors(error, API_KEY_TARGET)).toEqual({
      fields: {},
      form: VALIDATION_MESSAGE,
    });
  });

  it('ignores a default path the form does not render', () => {
    const narrowedForm: FieldErrorTarget<'name'> = {
      fieldPaths: ['name'],
      defaultPathByCode: {
        [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: 'name',
      },
    };

    expect(toFieldErrors(createLegacyConflictError(), narrowedForm)).toEqual({
      fields: { name: API_KEY_IDENTIFIER_FIELD_MESSAGE },
      form: null,
    });

    // The same code, but the default now points at a path this form omits: the
    // mapper must degrade to page copy instead of inventing a field.
    const mismatchedForm: FieldErrorTarget<'name' | 'identifier'> = {
      fieldPaths: ['name'],
      defaultPathByCode: {
        [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: 'identifier',
      },
    };

    expect(toFieldErrors(createLegacyConflictError(), mismatchedForm)).toEqual({
      fields: {},
      form: IDENTIFIER_CONFLICT_MESSAGE,
    });
  });
});

describe('toFieldErrors — cancellations render nothing', () => {
  it('stays silent for an aborted request', () => {
    expect(toFieldErrors(createAbortError(), API_KEY_TARGET)).toEqual({
      fields: {},
      form: null,
    });
  });

  it('stays silent for a superseded request', () => {
    expect(toFieldErrors(createCancelledError(), API_KEY_TARGET)).toEqual({
      fields: {},
      form: null,
    });
  });
});

describe('toFieldErrors — everything else stays page-level', () => {
  it('ignores the paths of a non-field-capable code', () => {
    const error = createCodedError({
      status: HTTP_STATUS.CONFLICT,
      code: API_ERROR_CODE.CONFLICT,
      issues: [{ path: 'identifier', message: 'generic conflict' }],
    });

    expect(toFieldErrors(error, API_KEY_TARGET)).toEqual({
      fields: {},
      form: CONFLICT_MESSAGE,
    });
  });

  it('reports a lost update page-level, never on the hidden token', () => {
    const error = createCodedError({
      status: HTTP_STATUS.CONFLICT,
      code: API_ERROR_CODE.STALE_WRITE,
      issues: [{ path: 'updatedAt', message: 'Version mismatch' }],
    });

    expect(toFieldErrors(error, API_KEY_TARGET)).toEqual({
      fields: {},
      form: STALE_WRITE_MESSAGE,
    });
  });

  it('reports a 409 without a code page-level', () => {
    expect(
      toFieldErrors(createStatusError(HTTP_STATUS.CONFLICT), API_KEY_TARGET),
    ).toEqual({
      fields: {},
      form: CONFLICT_MESSAGE,
    });
  });

  it('reports a server failure page-level, without its detail text', () => {
    const result = toFieldErrors(createServerError(500, true), API_KEY_TARGET);

    expect(result).toEqual({ fields: {}, form: SERVER_ERROR_MESSAGE });
    expect(result.form).not.toContain('Database is unavailable');
  });

  it('reports a transport failure instead of the generic copy', () => {
    expect(toFieldErrors(createNetworkError(), API_KEY_TARGET)).toEqual({
      fields: {},
      form: NETWORK_ERROR_USER_MESSAGE,
    });
  });

  it('is not fooled by an error whose message mentions a conflict', () => {
    expect(
      toFieldErrors(new Error('Conflict: duplicate key'), API_KEY_TARGET),
    ).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
  });

  it('reports a thrown non-error page-level', () => {
    expect(toFieldErrors(null, API_KEY_TARGET)).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
    expect(toFieldErrors(undefined, API_KEY_TARGET)).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
    expect(
      toFieldErrors({ status: HTTP_STATUS.CONFLICT }, API_KEY_TARGET),
    ).toEqual({
      fields: {},
      form: UNKNOWN_ERROR_MESSAGE,
    });
  });
});

describe('toFieldErrors — the server text never becomes user copy', () => {
  it('does not render the English issue message anywhere', () => {
    const result = toFieldErrors(createValidationError(), API_KEY_TARGET);
    const rendered = [result.form ?? '', ...Object.values(result.fields)].join(
      ' ',
    );

    expect(rendered).not.toContain(VALIDATION_DETAIL);
  });
});
