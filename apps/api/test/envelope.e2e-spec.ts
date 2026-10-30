import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  API_ERROR_CODE,
  HTTP_STATUS,
  apiKeyListSchema,
} from '@callback/shared';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { HttpModule } from '../src/common/http/http.module.js';
import {
  EnvelopeProbeModule,
  PROBE_FAILURE_TEXT,
} from './lib/envelope-probe.js';
import {
  expectErrorEnvelope,
  expectRequestIdHeaderEcho,
  expectSuccessEnvelope,
} from './lib/envelope.matchers.js';

/**
 * The envelope's **behaviour**, branch by branch (AIS-97, DoD 1).
 *
 * Deliberately built from `HttpModule` + a probe module instead of `AppModule`:
 *
 * - `HttpModule` *is* the production HTTP edge — the global `ApiExceptionFilter`,
 *   the `RequestIdInterceptor`, `ApiResponseService` and the `@SkipEnvelope()`
 *   machinery all come from it, unmodified;
 * - leaving out `ConfigModule` and `DatabaseModule` means this suite needs **no
 *   database and no Node >= 24.9**, so it runs on every developer machine and in
 *   CI. (The `AppModule` graph is exercised by `request-id`, `health`, `app`,
 *   `vapi-webhooks`, `openapi` and `envelope-exemptions`.)
 *
 * | branch | request | assertion |
 * |---|---|---|
 * | success | `GET /api/probe/envelope` | `{ data, meta }` + `X-Request-Id` echo |
 * | empty collection | `GET /api/probe/empty` | `data` is `[]`, never `null` |
 * | `500` | `GET /api/probe/boom` (throws) | `INTERNAL_ERROR`, sanitised message, `details: []`, requestId — and the text is in the **log** |
 * | `404` | unknown route | `NOT_FOUND` envelope, not a bare Nest body |
 */

describe('Envelope branches (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule, EnvelopeProbeModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a success with { data, meta } and echoes the requestId', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/probe/envelope',
    });

    expect(response.statusCode).toBe(HTTP_STATUS.OK);

    const body = expectSuccessEnvelope<{ probe: string }>(response.json());

    expect(body.data).toEqual({ probe: 'ok' });
    expectRequestIdHeaderEcho(body, response.headers);
  });

  it('answers an empty collection with [], never null', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/probe/empty',
    });

    expect(response.statusCode).toBe(HTTP_STATUS.OK);

    const body = expectSuccessEnvelope<readonly unknown[]>(response.json());

    expect(body.data).toEqual([]);
    expect(body.data).not.toBeNull();
    // The other half of the rule: `null` is not an acceptable empty list.
    expect(apiKeyListSchema.safeParse(null).success).toBe(false);
    expect(apiKeyListSchema.safeParse([]).success).toBe(true);
  });

  it('sanitises a 500 while keeping the detail in the log', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error');

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/probe/boom',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      const body = expectErrorEnvelope(response.json(), {
        code: API_ERROR_CODE.INTERNAL_ERROR,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      });

      expect(body.error.details).toEqual([]);
      expect(body.error.message).not.toContain('boom');
      expect(body.error.message).not.toContain('sk-live-secret');
      expect(body.error.path).toBe('/api/probe/boom');
      expect(response.headers['x-request-id']).toBe(body.error.requestId);

      // Without this the sanitisation would be indistinguishable from losing
      // the information: the operator must still find it in the log.
      const logged = errorSpy.mock.calls
        .map((call) => String(call[0]))
        .join('\n');

      expect(logged).toContain(PROBE_FAILURE_TEXT);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('answers an unknown route with the error envelope, not a bare 404 body', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/definitely-not-a-route',
    });

    expect(response.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expectErrorEnvelope(response.json(), {
      code: API_ERROR_CODE.NOT_FOUND,
      status: HTTP_STATUS.NOT_FOUND,
    });
  });
});
