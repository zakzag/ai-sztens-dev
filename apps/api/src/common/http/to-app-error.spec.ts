import { HttpException } from '@nestjs/common';
import { z } from 'zod';
import { API_ERROR_CODE, HTTP_STATUS, toErrorEnvelope } from '@callback/shared';
import type { ErrorContext } from '@callback/shared';
import { AppError, ConflictAppError, ValidationAppError } from './app-error.js';
import {
  INTERNAL_ERROR_MESSAGE,
  VALIDATION_FAILED_MESSAGE,
} from './api-messages.const.js';
import { toAppError } from './to-app-error.js';

/**
 * `toAppError` is the *pure* half of the error boundary: this is where a foreign
 * throwable becomes the contract's error shape, and where the security decision
 * about 5xx lives. The class doc of `to-app-error.ts` presents it as
 * `exception.logic`; keeping its own spec means the mapping is pinned
 * independently of Nest's `ArgumentsHost` plumbing (covered separately in
 * `api-exception.filter.spec.ts`).
 *
 * The two rules proven here:
 *
 * 1. **code decides status** — an `AppError` keeps its code, a Nest exception is
 *    translated onto the catalogue, and anything unknown becomes `INTERNAL_ERROR`;
 * 2. **5xx never leaks** — the message is replaced by the fixed generic sentence
 *    and the field details are dropped, for *both* `AppError` and `HttpException`,
 *    because a service-raised 500 is the realistic leak path.
 */

/** Fixed context so the wire-body assertion needs no clock mocking. */
const CTX: ErrorContext = {
  requestId: 'req-7',
  timestamp: '2026-10-28T10:00:00.000Z',
  path: '/api/api-keys',
};

/** Text that must never survive into a 5xx response body. */
const LEAKY_SQL = 'SELECT * FROM platform.api_keys WHERE id = $1';

/** A status deliberately outside the shared `HTTP_STATUS` catalogue (`418`). */
const NOT_IN_CONTRACT = 418;

describe('toAppError', () => {
  describe('AppError', () => {
    it('keeps a 4xx AppError as it is', () => {
      const original = new ValidationAppError('invalid', [
        { path: 'name', message: 'Required' },
      ]);

      const error = toAppError(original);

      expect(error).toBe(original);
      expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
      expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.message).toBe('invalid');
      expect(error.details).toEqual([{ path: 'name', message: 'Required' }]);
    });

    it('keeps a domain-specific 409 code and its details', () => {
      const error = toAppError(
        new ConflictAppError(
          'identifier taken',
          API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
          [{ path: 'identifier', message: 'already taken' }],
        ),
      );

      expect(error.code).toBe(API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT);
      expect(error.status).toBe(HTTP_STATUS.CONFLICT);
      expect(error.details).toHaveLength(1);
    });

    it('sanitises a 5xx AppError: generic message, no details, cause kept', () => {
      const original = new AppError({
        code: API_ERROR_CODE.INTERNAL_ERROR,
        message: LEAKY_SQL,
        details: [{ path: 'id', message: 'constraint api_keys_pkey' }],
      });

      const error = toAppError(original);

      expect(error).not.toBe(original);
      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.details).toEqual([]);
      expect(error.cause).toBe(original);
    });

    it('sanitises a 503 AppError instead of forcing it to 500', () => {
      const error = toAppError(
        new AppError({
          code: API_ERROR_CODE.SERVICE_UNAVAILABLE,
          message: 'postgres: connection refused',
        }),
      );

      expect(error.code).toBe(API_ERROR_CODE.SERVICE_UNAVAILABLE);
      expect(error.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
    });
  });

  describe('ZodError', () => {
    it('maps a validation failure to VALIDATION_FAILED with field details', () => {
      const result = z
        .object({ name: z.string().min(1, 'Required') })
        .safeParse({ name: '' });

      const error = toAppError(result.error);

      expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
      expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.message).toBe(VALIDATION_FAILED_MESSAGE);
      expect(error.details).toEqual([{ path: 'name', message: 'Required' }]);
    });

    it('reports a whole-payload failure with an empty path and the zod text', () => {
      const result = z.object({ name: z.string() }).safeParse(null);

      const error = toAppError(result.error);

      // `ValidationAppError` keeps no raw `cause`: the field detail is the part
      // a form can act on, and a 4xx is logged as a one-liner anyway.
      expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
      expect(error.details[0]?.path).toBe('');
      expect(error.details[0]?.message.length).toBeGreaterThan(0);
    });
  });

  describe('Nest HttpException', () => {
    it('maps a 404 to NOT_FOUND, not to a 500', () => {
      const error = toAppError(
        new HttpException('Cannot GET /api/nope', HTTP_STATUS.NOT_FOUND),
      );

      expect(error.code).toBe(API_ERROR_CODE.NOT_FOUND);
      expect(error.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(error.message).toBe('Cannot GET /api/nope');
    });

    it('maps a 409 to CONFLICT and keeps the developer message', () => {
      const error = toAppError(
        new HttpException(
          { message: 'identifier exists', error: 'Conflict' },
          HTTP_STATUS.CONFLICT,
        ),
      );

      expect(error.code).toBe(API_ERROR_CODE.CONFLICT);
      expect(error.status).toBe(HTTP_STATUS.CONFLICT);
      expect(error.message).toBe('identifier exists');
      expect(error.details).toEqual([]);
    });

    it('turns a ValidationPipe message array into whole-payload details', () => {
      const error = toAppError(
        new HttpException(
          {
            message: ['name should not be empty', 'apiKey must be a string'],
            error: 'Bad Request',
          },
          HTTP_STATUS.BAD_REQUEST,
        ),
      );

      expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
      expect(error.message).toBe('name should not be empty');
      expect(error.details).toEqual([
        { path: '', message: 'name should not be empty' },
        { path: '', message: 'apiKey must be a string' },
      ]);
    });

    it('sanitises a 5xx HttpException as well', () => {
      const error = toAppError(
        new HttpException(`database exploded: ${LEAKY_SQL}`, 503),
      );

      expect(error.code).toBe(API_ERROR_CODE.SERVICE_UNAVAILABLE);
      expect(error.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
    });

    it('maps a 422 onto VALIDATION_FAILED, i.e. a 400 on the wire', () => {
      const error = toAppError(
        new HttpException('semantic problem', HTTP_STATUS.UNPROCESSABLE_ENTITY),
      );

      // The catalogue has no semantic-validation code yet, so 422 shares the
      // VALIDATION_FAILED code. Mapping it is what keeps a Nest client error
      // from being reported as a 500.
      expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
      expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('maps a status outside the contract to INTERNAL_ERROR and a 500', () => {
      const error = toAppError(new HttpException('teapot', NOT_IN_CONTRACT));

      // Sending a 4xx-looking status for a failure the catalogue does not know
      // would hide a bug, so an unknown status is reported as a server error.
      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('unknown throwables', () => {
    it('maps a plain Error to INTERNAL_ERROR with the generic message', () => {
      const original = new Error('boom');

      const error = toAppError(original);

      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.cause).toBe(original);
    });

    it('maps a thrown `null` to INTERNAL_ERROR', () => {
      const error = toAppError(null);

      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.cause).toBeNull();
    });

    it('maps a thrown `undefined` to INTERNAL_ERROR', () => {
      const error = toAppError(undefined);

      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.cause).toBeUndefined();
    });

    it('maps a thrown primitive to INTERNAL_ERROR', () => {
      const error = toAppError('boom');

      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.cause).toBe('boom');
    });

    it('maps a thrown plain object to INTERNAL_ERROR', () => {
      const thrown = { code: 'SOMETHING_ELSE', message: LEAKY_SQL };

      const error = toAppError(thrown);

      expect(error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(error.cause).toBe(thrown);
    });
  });

  describe('wire body', () => {
    it('carries no SQL text for any 5xx throwable', () => {
      const throwables: readonly unknown[] = [
        new Error(LEAKY_SQL),
        new AppError({
          code: API_ERROR_CODE.INTERNAL_ERROR,
          message: LEAKY_SQL,
        }),
        new HttpException(LEAKY_SQL, HTTP_STATUS.INTERNAL_SERVER_ERROR),
        { message: LEAKY_SQL },
      ];

      for (const throwable of throwables) {
        const body = toErrorEnvelope(toAppError(throwable), CTX);

        expect(JSON.stringify(body)).not.toContain('SELECT');
        expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
        expect(body.error.requestId).toBe('req-7');
      }
    });

    it('keeps the field details of a 4xx on the wire', () => {
      const body = toErrorEnvelope(
        toAppError(
          new ValidationAppError(VALIDATION_FAILED_MESSAGE, [
            { path: 'apiKey', message: 'Required' },
          ]),
        ),
        CTX,
      );

      expect(body.error.details).toEqual([
        { path: 'apiKey', message: 'Required' },
      ]);
      expect(body.error.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(body.error.path).toBe('/api/api-keys');
    });
  });
});
