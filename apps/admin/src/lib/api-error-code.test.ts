/**
 * Tests of the single error-code catalogue (AIS-111).
 *
 * The point of this file is the **exhaustiveness gate**: the shared catalogue is
 * the contract, and the admin copy table must cover it exactly. AIS-108 added two
 * codes (`STALE_WRITE`, `SEMANTIC_VALIDATION_FAILED`) and this app silently fell
 * back to the generic `409`/`422` sentences — that class of bug fails here now.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { API_ERROR_CODE } from '@callback/shared';
import { describe, expect, it } from 'vitest';
import { createCodedError } from '../test/mocks/api-error.mock.js';
import {
  CLIENT_UNEXPECTED_PAYLOAD_CODE,
  ERROR_CODE_CATALOGUE,
  ERROR_CODE_MESSAGE,
  FIELD_SURFACE_CODES,
} from './api-error-code.const.js';
import { toErrorMessage } from './error-message.js';
import {
  CONFLICT_MESSAGE,
  FIELD_INVALID_MESSAGE,
  SEMANTIC_VALIDATION_FAILED_MESSAGE,
  STALE_WRITE_MESSAGE,
} from './error-message.const.js';

describe('ERROR_CODE_CATALOGUE — one entry per shared code', () => {
  it('covers the shared catalogue exactly, in both directions', () => {
    expect(Object.keys(ERROR_CODE_CATALOGUE).sort()).toEqual(
      Object.values(API_ERROR_CODE).sort(),
    );
  });

  it('gives every code page copy and an explicit field decision', () => {
    for (const [code, copy] of Object.entries(ERROR_CODE_CATALOGUE)) {
      expect(copy.message.length, code).toBeGreaterThan(0);
      expect(
        copy.fieldMessage === null || copy.fieldMessage.length > 0,
        code,
      ).toBe(true);
    }
  });
});

describe('FIELD_SURFACE_CODES — derived from the catalogue', () => {
  it('contains exactly the field-capable codes', () => {
    expect([...FIELD_SURFACE_CODES].sort()).toEqual(
      [
        API_ERROR_CODE.VALIDATION_FAILED,
        API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
        API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
      ].sort(),
    );
  });

  it('never allows a lost update to blame an input', () => {
    expect(FIELD_SURFACE_CODES).not.toContain(API_ERROR_CODE.STALE_WRITE);
  });
});

describe('ERROR_CODE_MESSAGE — derived from the catalogue', () => {
  it('maps every catalogue code plus the client-only payload code', () => {
    expect(Object.keys(ERROR_CODE_MESSAGE).sort()).toEqual(
      [
        ...Object.keys(ERROR_CODE_CATALOGUE),
        CLIENT_UNEXPECTED_PAYLOAD_CODE,
      ].sort(),
    );
  });

  it('renders dedicated copy for a lost update instead of the conflict sentence', () => {
    expect(ERROR_CODE_MESSAGE[API_ERROR_CODE.STALE_WRITE]).toBe(
      STALE_WRITE_MESSAGE,
    );
    expect(ERROR_CODE_MESSAGE[API_ERROR_CODE.STALE_WRITE]).not.toBe(
      CONFLICT_MESSAGE,
    );
  });

  it('renders dedicated copy for a semantic validation failure', () => {
    expect(ERROR_CODE_MESSAGE[API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED]).toBe(
      SEMANTIC_VALIDATION_FAILED_MESSAGE,
    );
  });
});

describe('toErrorMessage — uses the catalogue copy', () => {
  it('explains a stale write with its own sentence', () => {
    const error = createCodedError({
      status: HTTP_STATUS.CONFLICT,
      code: API_ERROR_CODE.STALE_WRITE,
    });

    expect(toErrorMessage(error)).toBe(STALE_WRITE_MESSAGE);
  });

  it('explains a semantic validation failure with its own sentence', () => {
    const error = createCodedError({
      status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      code: API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      issues: [{ path: 'expiresAt', message: 'Date must be in the future' }],
    });

    expect(toErrorMessage(error)).toBe(SEMANTIC_VALIDATION_FAILED_MESSAGE);
  });

  it('keeps the field copy generic, so one message covers every input', () => {
    expect(
      ERROR_CODE_CATALOGUE[API_ERROR_CODE.VALIDATION_FAILED].fieldMessage,
    ).toBe(FIELD_INVALID_MESSAGE);
    expect(
      ERROR_CODE_CATALOGUE[API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED]
        .fieldMessage,
    ).toBe(FIELD_INVALID_MESSAGE);
  });
});
