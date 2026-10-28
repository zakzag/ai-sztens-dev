import { API_ERROR_CODE } from '@callback/shared';
import {
  AppError,
  ConflictAppError,
  NotFoundAppError,
  ValidationAppError,
} from './app-error.js';

/**
 * The hierarchy's only real contract: **code decides status**, and the details
 * survive untouched. If this ever drifts, the client would start seeing a `200`
 * catalogue entry for a failure.
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

  it('maps an unknown code to 500 instead of guessing', () => {
    const error = new AppError({ code: 'SOMETHING_NEW', message: 'oops' });

    expect(error.status).toBe(500);
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
});
