/**
 * Tests of the single error → text mapping.
 *
 * Each branch is a different user instruction, so each branch is asserted: a
 * regression here shows the wrong advice to an admin (e.g. “check your network”
 * for a duplicate identifier).
 */

import { HTTP_STATUS } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  CONFLICT_DETAIL,
  createConflictError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
  VALIDATION_DETAIL,
} from '../test/mocks/api-error.mock.js';
import { toErrorMessage } from './error-message.js';
import {
  CONFLICT_MESSAGE,
  FORBIDDEN_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  NOT_FOUND_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';

describe('toErrorMessage', () => {
  it('falls back to the generic text for a non-ApiError value', () => {
    expect(toErrorMessage(new Error('boom'))).toBe(UNKNOWN_ERROR_MESSAGE);
  });

  it('falls back to the generic text for a thrown non-error', () => {
    expect(toErrorMessage('something went wrong')).toBe(
      UNKNOWN_ERROR_MESSAGE,
    );
    expect(toErrorMessage(undefined)).toBe(UNKNOWN_ERROR_MESSAGE);
  });

  it('explains a transport failure when no response arrived', () => {
    expect(toErrorMessage(createNetworkError())).toBe(
      NETWORK_ERROR_USER_MESSAGE,
    );
  });

  it('asks for a new login on 401', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.UNAUTHORIZED))).toBe(
      SESSION_EXPIRED_MESSAGE,
    );
  });

  it('reports missing permission on 403', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.FORBIDDEN))).toBe(
      FORBIDDEN_MESSAGE,
    );
  });

  it('reports a missing resource on 404', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.NOT_FOUND))).toBe(
      NOT_FOUND_MESSAGE,
    );
  });

  it('prefers the backend detail on a conflict', () => {
    expect(toErrorMessage(createConflictError())).toBe(CONFLICT_DETAIL);
  });

  it('falls back to the conflict text when the body carries no detail', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.CONFLICT))).toBe(
      CONFLICT_MESSAGE,
    );
  });

  it('prefers the validator detail on 400', () => {
    expect(toErrorMessage(createValidationError())).toBe(VALIDATION_DETAIL);
  });

  it('falls back to the validation text on 422 without details', () => {
    expect(
      toErrorMessage(createStatusError(HTTP_STATUS.UNPROCESSABLE_ENTITY)),
    ).toBe(VALIDATION_MESSAGE);
  });

  it('reports a server failure for 5xx even when the body has a message', () => {
    expect(toErrorMessage(createServerError(500, true))).toBe(
      SERVER_ERROR_MESSAGE,
    );
    expect(toErrorMessage(createServerError(503))).toBe(SERVER_ERROR_MESSAGE);
  });

  it('uses the detail for an unmapped status that has one', () => {
    expect(toErrorMessage(createServerError(418, true))).toBe(
      'Database is unavailable',
    );
  });

  it('falls back to the generic text for an unmapped status without detail', () => {
    expect(toErrorMessage(createStatusError(418))).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
