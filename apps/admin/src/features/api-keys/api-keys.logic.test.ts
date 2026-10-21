/**
 * Tests of the pure `api-keys` rules.
 *
 * The interesting assertion is the negative one: an error whose *message* says
 * “conflict” but whose status is not 409 must not reach the identifier field
 * (plan decision **D4** — never match on message text).
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  createConflictError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import { API_KEY_IDENTIFIER_CONFLICT_MESSAGE } from './api-keys.const.js';
import {
  isIdentifierConflict,
  toIdentifierFieldError,
} from './api-keys.logic.js';

describe('isIdentifierConflict', () => {
  it('is true for a 409 ApiError', () => {
    expect(isIdentifierConflict(createConflictError())).toBe(true);
  });

  it('is false for a 400 ApiError', () => {
    expect(isIdentifierConflict(createValidationError())).toBe(false);
  });

  it('is false for a plain Error that mentions a conflict', () => {
    expect(isIdentifierConflict(new Error('Conflict: duplicate key'))).toBe(
      false,
    );
  });

  it('is false for a non-error value', () => {
    expect(isIdentifierConflict(null)).toBe(false);
    expect(isIdentifierConflict({ status: HTTP_STATUS.CONFLICT })).toBe(false);
  });

  it('is false for a 409 thrown as a new ApiError of a different name', () => {
    const lookAlike = new Error('duplicate');

    expect(isIdentifierConflict(lookAlike)).toBe(false);
    expect(isIdentifierConflict(ApiError)).toBe(false);
  });
});

describe('toIdentifierFieldError', () => {
  it('maps a 409 onto the identifier field message', () => {
    expect(toIdentifierFieldError(createConflictError())).toBe(
      API_KEY_IDENTIFIER_CONFLICT_MESSAGE,
    );
  });

  it('returns null for other failures, so the caller reports them page-level', () => {
    expect(toIdentifierFieldError(createValidationError())).toBeNull();
    expect(toIdentifierFieldError(new Error('boom'))).toBeNull();
    expect(toIdentifierFieldError(undefined)).toBeNull();
  });
});
