/**
 * Tests of the single error → text mapping.
 *
 * Two invariants:
 * 1. the **code** decides first (plan `D3`) — a domain code gets its own copy;
 * 2. an unknown code or a legacy body degrades to the status copy, and the
 *    server's English message/details never reach the user.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  createCodedError,
  createConflictError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
} from '../test/mocks/api-error.mock.js';
import { toErrorMessage } from './error-message.js';
import {
  CONFLICT_MESSAGE,
  FORBIDDEN_MESSAGE,
  IDENTIFIER_CONFLICT_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  NOT_FOUND_MESSAGE,
  SERVER_ERROR_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';

describe('toErrorMessage — non-API failures', () => {
  it('falls back to the generic text for a non-ApiError value', () => {
    expect(toErrorMessage(new Error('boom'))).toBe(UNKNOWN_ERROR_MESSAGE);
  });

  it('falls back to the generic text for a thrown non-error', () => {
    expect(toErrorMessage('something went wrong')).toBe(UNKNOWN_ERROR_MESSAGE);
    expect(toErrorMessage(undefined)).toBe(UNKNOWN_ERROR_MESSAGE);
  });

  it('explains a transport failure when no response arrived', () => {
    expect(toErrorMessage(createNetworkError())).toBe(
      NETWORK_ERROR_USER_MESSAGE,
    );
  });
});

describe('toErrorMessage — code first', () => {
  it('uses the domain copy of a duplicate identifier', () => {
    expect(toErrorMessage(createConflictError())).toBe(
      IDENTIFIER_CONFLICT_MESSAGE,
    );
  });

  it('uses the code copy instead of the generic status copy', () => {
    expect(toErrorMessage(createServerError(503))).toBe(
      SERVICE_UNAVAILABLE_MESSAGE,
    );
  });

  it('maps VALIDATION_FAILED to the validation copy', () => {
    expect(toErrorMessage(createValidationError())).toBe(VALIDATION_MESSAGE);
  });

  it('falls back to the status copy for an unknown code', () => {
    expect(
      toErrorMessage(
        createCodedError({
          status: HTTP_STATUS.CONFLICT,
          code: 'SOMETHING_NEW_FROM_A_NEWER_SERVER',
        }),
      ),
    ).toBe(CONFLICT_MESSAGE);
  });
});

describe('toErrorMessage — status fallback', () => {
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

  it('reports a conflict on 409', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.CONFLICT))).toBe(
      CONFLICT_MESSAGE,
    );
  });

  it('reports invalid data on 400 and 422', () => {
    expect(toErrorMessage(createStatusError(HTTP_STATUS.BAD_REQUEST))).toBe(
      VALIDATION_MESSAGE,
    );
    expect(
      toErrorMessage(createStatusError(HTTP_STATUS.UNPROCESSABLE_ENTITY)),
    ).toBe(VALIDATION_MESSAGE);
  });

  it('reports a server failure for any 5xx', () => {
    expect(toErrorMessage(createStatusError(500))).toBe(SERVER_ERROR_MESSAGE);
    expect(toErrorMessage(createStatusError(503))).toBe(SERVER_ERROR_MESSAGE);
  });

  it('never renders the server message or detail as user copy', () => {
    expect(toErrorMessage(createServerError(500, true))).toBe(
      SERVER_ERROR_MESSAGE,
    );
  });

  it('falls back to the generic text for an unmapped status', () => {
    expect(toErrorMessage(createStatusError(418))).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
