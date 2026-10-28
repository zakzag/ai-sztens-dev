import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { z } from 'zod';
import { API_ERROR_CODE } from '@callback/shared';
import type { ApiErrorEnvelope } from '@callback/shared';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { ApiResponseService } from './api-response.service.js';
import {
  NOT_FOUND_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
} from './api-messages.const.js';
import { NotFoundAppError } from './app-error.js';

/**
 * The error boundary is the security-relevant part of the envelope, so the suite
 * walks every input the filter can receive:
 *
 * - an `AppError` keeps its code (and therefore its status);
 * - a `ZodError` becomes `VALIDATION_FAILED` with field details;
 * - a Nest `HttpException` is mapped onto the catalogue;
 * - an unknown `Error` becomes a sanitised `500` (no stack, no message leak);
 * - an `@SkipEnvelope()` handler keeps Nest's raw body;
 * - a non-HTTP context is logged, not answered.
 */

interface ReplySpy {
  readonly header: jest.Mock<(name: string, value: string) => unknown>;
  readonly status: jest.Mock<(code: number) => unknown>;
  readonly send: jest.Mock<(body: unknown) => unknown>;
}

function createReply(): ReplySpy {
  const reply = {
    header: jest.fn<(name: string, value: string) => unknown>(),
    status: jest.fn<(code: number) => unknown>(),
    send: jest.fn<(body: unknown) => unknown>(),
  };

  reply.header.mockReturnValue(reply);
  reply.status.mockReturnValue(reply);

  return reply;
}

function createHost(
  reply: ReplySpy,
  options: { readonly exempt: boolean; readonly type?: string } = {
    exempt: false,
  },
): ArgumentsHost {
  const handler = (): void => undefined;
  class ControllerStub {}

  const http = {
    getRequest: () => ({
      id: 'req-1',
      method: 'GET',
      url: '/api/api-keys',
      headers: {},
    }),
    getResponse: () => reply,
  };

  return {
    getType: () => options.type ?? 'http',
    switchToHttp: () => http,
    getHandler: () => handler,
    getClass: () => ControllerStub,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => {
      throw new Error('not used in this suite');
    },
    switchToWs: () => {
      throw new Error('not used in this suite');
    },
  } as unknown as ArgumentsHost;
}

function createFilter(exempt = false): ApiExceptionFilter {
  const reflector = {
    getAllAndOverride: () => exempt,
  } as unknown as Reflector;

  return new ApiExceptionFilter(new ApiResponseService(), reflector);
}

/** Reads the body the filter sent. */
function readBody(reply: ReplySpy): ApiErrorEnvelope {
  return reply.send.mock.calls[0]?.[0] as ApiErrorEnvelope;
}

describe('ApiExceptionFilter', () => {
  it('serialises an AppError with its catalogue code and status', () => {
    const reply = createReply();

    createFilter().catch(new NotFoundAppError('gone'), createHost(reply));

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.header).toHaveBeenCalledWith('X-Request-Id', 'req-1');
    expect(readBody(reply).error).toMatchObject({
      code: API_ERROR_CODE.NOT_FOUND,
      status: 404,
      message: 'gone',
      path: '/api/api-keys',
    });
  });

  it('maps a ZodError to VALIDATION_FAILED with field details', () => {
    const reply = createReply();
    const result = z
      .object({ name: z.string().min(1, 'Required') })
      .safeParse({ name: '' });

    createFilter().catch(result.error, createHost(reply));

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(readBody(reply).error).toMatchObject({
      code: API_ERROR_CODE.VALIDATION_FAILED,
      details: [{ path: 'name', message: 'Required' }],
    });
  });

  it('maps a 4xx HttpException onto the catalogue', () => {
    const reply = createReply();
    const exception = new HttpException(
      { message: 'identifier exists', error: 'Conflict' },
      409,
    );

    createFilter().catch(exception, createHost(reply));

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(readBody(reply).error).toMatchObject({
      code: API_ERROR_CODE.CONFLICT,
      message: 'identifier exists',
    });
  });

  it('sanitises an injected 500: fixed message, no stack, no cause text', () => {
    const reply = createReply();

    createFilter().catch(
      new Error('SELECT * FROM platform.api_keys failed'),
      createHost(reply),
    );

    const body = readBody(reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(body.error.code).toBe(API_ERROR_CODE.INTERNAL_ERROR);
    expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('SELECT');
  });

  it('sanitises a 5xx HttpException as well', () => {
    const reply = createReply();

    createFilter().catch(
      new HttpException('database exploded', 503),
      createHost(reply),
    );

    const body = readBody(reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(body.error.code).toBe(API_ERROR_CODE.SERVICE_UNAVAILABLE);
    expect(body.error.message).toBe(INTERNAL_ERROR_MESSAGE);
  });

  it('keeps Nest’s raw body for an exempt handler', () => {
    const reply = createReply();
    const exception = new HttpException(
      { statusCode: 404, message: 'raw', error: 'Not Found' },
      404,
    );

    createFilter(true).catch(exception, createHost(reply, { exempt: true }));

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'raw',
      error: 'Not Found',
    });
    expect(reply.header).toHaveBeenCalledWith('X-Request-Id', 'req-1');
  });

  it('answers an unknown error on an exempt handler with the Nest default body', () => {
    const reply = createReply();

    createFilter(true).catch(
      new Error('boom'),
      createHost(reply, { exempt: true }),
    );

    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 500,
      message: INTERNAL_ERROR_MESSAGE,
    });
  });

  it('never answers a non-HTTP context', () => {
    const reply = createReply();

    createFilter().catch(
      new NotFoundAppError(NOT_FOUND_MESSAGE),
      createHost(reply, { exempt: false, type: 'rpc' }),
    );

    expect(reply.send).not.toHaveBeenCalled();
  });
});
