import { API_ERROR_CODE } from '@callback/shared';
import {
  AppError,
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from './app-error.js';
import type { AppErrorInit } from './app-error.interface.js';

/**
 * The hierarchy's only real contract: **code decides status**, and the details
 * survive untouched. If this ever drifts, the client would start seeing a `200`
 * catalogue entry for a failure.
 *
 * The catalogue is also enforced at **compile** time: `AppErrorInit.code` and the
 * `ConflictAppError` override are typed as `ApiErrorCode`, so a code the deployed
 * client cannot map does not build. The two `@ts-expect-error` tests below are
 * the proof — ts-jest reports TS2578 the moment the type stops rejecting them.
 */
describe('AppError', () => {
  it('derives the status from the catalogue', () => {
    const error = new AppError({
      code: API_ERROR_CODE.CONFLICT,
      message: 'taken',
    });

    expect(error.status).toBe(409);
    expect(error.code).toBe(API_ERROR_CODE.CONFLICT);
    expect(error.details).toEqual([]);
  });

  it('keeps the cause for the server log', () => {
    const cause = new Error('23505');
    const error = new AppError({
      code: API_ERROR_CODE.CONFLICT,
      message: 'taken',
      cause,
    });

    expect(error.cause).toBe(cause);
  });

  it('builds a VALIDATION_FAILED error with field details', () => {
    const error = new ValidationAppError('invalid', [
      { path: 'name', message: 'Required' },
    ]);

    expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
    expect(error.status).toBe(400);
    expect(error.details).toHaveLength(1);
    expect(error.name).toBe('ValidationAppError');
  });

  it('builds a NOT_FOUND error with a default message', () => {
    const error = new NotFoundAppError();

    expect(error.code).toBe(API_ERROR_CODE.NOT_FOUND);
    expect(error.status).toBe(404);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('lets a conflict carry a domain-specific code with the same status', () => {
    const error = new ConflictAppError(
      'identifier taken',
      API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
      [{ path: 'identifier', message: 'already taken' }],
    );

    expect(error.code).toBe(API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT);
    expect(error.status).toBe(409);
    expect(error.details[0]?.path).toBe('identifier');
  });

  it('defaults a conflict to the generic CONFLICT code', () => {
    const error = new ConflictAppError('taken');

    expect(error.code).toBe(API_ERROR_CODE.CONFLICT);
    expect(error.status).toBe(409);
  });

  it('does not compile an init with a code outside the catalogue', () => {
    // @ts-expect-error - the catalogue is the only vocabulary an AppError may use
    const broken: AppErrorInit = { code: 'NOT_A_CATALOGUE_CODE', message: 'x' };

    expect(broken.message).toBe('x');
  });

  it('does not compile a conflict with an uncatalogued override', () => {
    // @ts-expect-error - `ConflictAppError` only accepts `ApiErrorCode` overrides
    const broken = new ConflictAppError('taken', 'NOT_A_CATALOGUE_CODE');

    expect(broken.message).toBe('taken');
  });
});
