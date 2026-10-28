import { jest } from '@jest/globals';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { API_ERROR_CODE, HTTP_STATUS } from '@callback/shared';
import type { ApiErrorEnvelope } from '@callback/shared';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiResponseService } from './api-response.service.js';
import { AppError, NotFoundAppError } from './app-error.js';
import {
  INTERNAL_ERROR_MESSAGE,
  NOT_FOUND_MESSAGE,
} from './api-messages.const.js';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.const.js';
import {
  createHost,
  createReflectorSpy,
  createReply,
} from './test/mocks/http-host.mock.js';
import type { ReplySpy } from './test/mocks/http-host.mock.js';
import { captureLogger } from './test/mocks/logger.mock.js';

/**
 * The error boundary is the security-relevant part of the envelope, so the suite
 * walks every input the filter can receive:
 *
 * - an `AppError` keeps its code (and therefore its status);
 * - a `ZodError` becomes `VALIDATION_FAILED` with field details;
 * - a Nest `HttpException` is mapped onto the catalogue;
 * - a 5xx is sanitised — for a raw `Error` **and** for a service-raised
 *   `AppError`, which is the realistic leak path;
 * - an `@SkipEnvelope()` handler keeps Nest's raw body;
 * - a non-HTTP context is logged, not answered;
 * - the log side of the rule: 4xx → `warn` without a stack, 5xx → `error` with
 *   the stack, and the leaked detail present **there** while absent from the
 *   response body.
 *
 * The reply/request/reflector doubles live in `test/mocks/http-host.mock.ts`
 * (no mocks inside spec files), the log recorder in `logger.mock.ts`.
 */

/** Text that must never survive into a 5xx response body. */
const LEAKY_SQL = 'SELECT * FROM platform.api_keys WHERE id = $1';

/**
 * @param exempt - whether the matched route carries `@SkipEnvelope()`.
 * @returns the filter under test, wired with a reporter-free service.
 */
function createFilter(exempt = false): ApiExceptionFilter {
  const { reflector } = createReflectorSpy({ exempt });

  return new ApiExceptionFilter(new ApiResponseService(), reflector);
}

/** @returns the body the filter sent. */
function readBody(reply: ReplySpy): ApiErrorEnvelope {
  return reply.send.mock.calls[0]?.[0] as ApiErrorEnvelope;
}

describe('ApiExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('the error envelope', () => {
    it('serialises an AppError with its catalogue code and status', () => {
      const reply = createReply();
      captureLogger('warn');

      createFilter().catch(new NotFoundAppError('gone'), createHost(reply));

      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(reply.header).toHaveBeenCalledWith('X-Request-Id', 'req-1');
      expect(readBody(reply).error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'gone',
        path: '/api/api-keys',
      });
    });

    it('maps a ZodError to VALIDATION_FAILED with field details', () => {
      const reply = createReply();
      captureLogger('warn');
      const result = z
        .object({ name: z.string().min(1, 'Required') })
        .safeParse({ name: '' });

      createFilter().catch(result.error, createHost(reply));

      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(readBody(reply).error).toMatchObject({
        code: API_ERROR_CODE.VALIDATION_FAILED,
        details: [{ path: 'name', message: 'Required' }],
      });
    });

    it('maps a 4xx HttpException onto the catalogue', () => {
      const reply = createReply();
      captureLogger('warn');
      const exception = new HttpException(
        { message: 'identifier exists', error: 'Conflict' },
        HTTP_STATUS.CONFLICT,
      );

      createFilter().catch(exception, createHost(reply));

      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT);
      expect(readBody(reply).error).toMatchObject({
        code: API_ERROR_CODE.CONFLICT,
        message: 'identifier exists',
      });
    });
  });

  describe('5xx sanitising', () => {
    it('answers a raw Error with a fixed message and no stack', () => {
      const reply = createReply();
      captureLogger('error');

      createFilter().catch(new Error(LEAKY_SQL), createHost(reply));

      const body = readBody(reply);

      expect(reply.status).toHaveBeenCalledWith(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
      expect(body.error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
      expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(JSON.stringify(body)).not.toContain('SELECT');
    });

    it('answers a service-raised 5xx AppError sanitised, without its details', () => {
      const reply = createReply();
      captureLogger('error');
      const exception = new AppError({
        code: API_ERROR_CODE.INTERNAL_ERROR,
        message: LEAKY_SQL,
        details: [{ path: 'id', message: 'api_keys_pkey' }],
      });

      createFilter().catch(exception, createHost(reply));

      const body = readBody(reply);

      expect(reply.status).toHaveBeenCalledWith(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
      expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(body.error.details).toEqual([]);
      expect(JSON.stringify(body)).not.toContain('SELECT');
    });

    it('sanitises a 5xx HttpException as well', () => {
      const reply = createReply();
      captureLogger('error');

      createFilter().catch(
        new HttpException('database exploded', HTTP_STATUS.SERVICE_UNAVAILABLE),
        createHost(reply),
      );

      const body = readBody(reply);

      expect(reply.status).toHaveBeenCalledWith(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
      expect(body.error.code).toBe(API_ERROR_CODE.SERVICE_UNAVAILABLE);
      expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
    });
  });

  describe('logging', () => {
    it('logs a 4xx as one warn line without a stack', () => {
      const reply = createReply();
      const warnings = captureLogger('warn');
      const errors = captureLogger('error');

      createFilter().catch(new NotFoundAppError('gone'), createHost(reply));

      expect(warnings.calls).toHaveLength(1);
      expect(warnings.messages[0]).toContain('GET /api/api-keys -> 404');
      expect(warnings.messages[0]).toContain('requestId=req-1');
      expect(warnings.stacks[0]).toBeUndefined();
      expect(errors.calls).toHaveLength(0);
    });

    it('logs a 5xx as an error with the stack, detail only in the log', () => {
      const reply = createReply();
      const warnings = captureLogger('warn');
      const errors = captureLogger('error');
      const exception = new Error(LEAKY_SQL);

      createFilter().catch(exception, createHost(reply));

      expect(errors.calls).toHaveLength(1);
      expect(errors.messages[0]).toContain('GET /api/api-keys -> 500');
      expect(errors.messages[0]).toContain('requestId=req-1');
      // The detail the client must never see has to survive *somewhere*.
      expect(errors.messages[0]).toContain(LEAKY_SQL);
      expect(errors.stacks[0]).toBe(exception.stack);
      expect(warnings.calls).toHaveLength(0);
      expect(JSON.stringify(readBody(reply))).not.toContain(LEAKY_SQL);
    });

    it('logs an error for a non-HTTP context and answers nothing', () => {
      const reply = createReply();
      const errors = captureLogger('error');

      createFilter().catch(
        new NotFoundAppError(NOT_FOUND_MESSAGE),
        createHost(reply, { type: 'rpc' }),
      );

      expect(errors.messages[0]).toContain('Unhandled non-HTTP exception');
      expect(reply.send).not.toHaveBeenCalled();
    });
  });

  describe('@SkipEnvelope() exemption', () => {
    it('keeps Nest’s raw body for an exempt handler', () => {
      const reply = createReply();
      captureLogger('warn');
      const exception = new HttpException(
        { statusCode: 404, message: 'raw', error: 'Not Found' },
        HTTP_STATUS.NOT_FOUND,
      );

      createFilter(true).catch(exception, createHost(reply));

      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(reply.send).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'raw',
        error: 'Not Found',
      });
      expect(reply.header).toHaveBeenCalledWith('X-Request-Id', 'req-1');
    });

    it('answers an unknown error on an exempt handler with the Nest default body', () => {
      const reply = createReply();
      captureLogger('error');

      createFilter(true).catch(new Error('boom'), createHost(reply));

      expect(reply.send).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: INTERNAL_ERROR_MESSAGE,
      });
    });

    it('reads the exemption flag from the skip-envelope metadata key', () => {
      const reply = createReply();
      captureLogger('warn');
      const reflectorSpy = createReflectorSpy({ exempt: false });

      new ApiExceptionFilter(
        new ApiResponseService(),
        reflectorSpy.reflector,
      ).catch(new NotFoundAppError('gone'), createHost(reply));

      expect(reflectorSpy.requestedKeys).toEqual([SKIP_ENVELOPE_KEY]);
      expect(readBody(reply).error.code).toBe(API_ERROR_CODE.NOT_FOUND);
    });

    it('skips the reflector entirely when the host has no handler or class', () => {
      const reply = createReply();
      captureLogger('warn');
      const reflectorSpy = createReflectorSpy({ exempt: false });

      // A route-handler error reaches the filter through a host built from the
      // raw `[req, res, next]` tuple: no metadata targets at all. Passing
      // `undefined` to `Reflector` throws and would answer 500 for every 4xx.
      new ApiExceptionFilter(
        new ApiResponseService(),
        reflectorSpy.reflector,
      ).catch(
        new NotFoundAppError('gone'),
        createHost(reply, { metadataTargets: 'none' }),
      );

      expect(reflectorSpy.requestedKeys).toEqual([]);
      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(readBody(reply).error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: HTTP_STATUS.NOT_FOUND,
        requestId: 'req-1',
      });
    });

    it('falls back to the registry when a guard rejection has no metadata target', () => {
      const reply = createReply();
      captureLogger('warn');

      // Guard errors reach the filter without a handler/class pair; only the
      // documented allow-list can keep a VAPI / healthz rejection raw.
      new ApiExceptionFilter(
        new ApiResponseService(),
        createReflectorSpy({ exempt: false }).reflector,
      ).catch(
        new UnauthorizedException('raw body missing'),
        createHost(reply, {
          metadataTargets: 'none',
          routePattern: '/api/vapi/webhooks/tool-calls',
        }),
      );

      expect(reply.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(reply.send).toHaveBeenCalledWith({
        message: 'raw body missing',
        error: 'Unauthorized',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      });
    });

    it('falls back to the request URL when Fastify exposes no route pattern', () => {
      const reply = createReply();
      captureLogger('warn');

      new ApiExceptionFilter(
        new ApiResponseService(),
        createReflectorSpy({ exempt: false }).reflector,
      ).catch(
        new UnauthorizedException('probe'),
        createHost(reply, {
          metadataTargets: 'none',
          requestUrl: '/healthz?verbose=1',
        }),
      );

      expect(reply.send).toHaveBeenCalledWith({
        message: 'probe',
        error: 'Unauthorized',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      });
    });

    it('keeps the envelope for a route that is on neither list', () => {
      const reply = createReply();
      captureLogger('warn');

      new ApiExceptionFilter(
        new ApiResponseService(),
        createReflectorSpy({ exempt: false }).reflector,
      ).catch(
        new UnauthorizedException('nope'),
        createHost(reply, {
          metadataTargets: 'none',
          routePattern: '/api/api-keys',
        }),
      );

      expect(readBody(reply).error.code).toBe(API_ERROR_CODE.UNAUTHENTICATED);
      expect(readBody(reply).error.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('reads a class-level exemption when only the class target is available', () => {
      const reply = createReply();
      captureLogger('warn');

      new ApiExceptionFilter(
        new ApiResponseService(),
        createReflectorSpy({ exempt: true }).reflector,
      ).catch(
        new HttpException(
          {
            statusCode: HTTP_STATUS.NOT_FOUND,
            message: 'raw',
            error: 'Not Found',
          },
          HTTP_STATUS.NOT_FOUND,
        ),
        createHost(reply, { metadataTargets: 'class' }),
      );

      expect(reply.send).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'raw',
        error: 'Not Found',
      });
    });
  });
});
