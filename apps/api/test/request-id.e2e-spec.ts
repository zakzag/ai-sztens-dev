import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { ApiEnvelope } from '@callback/shared';
import { ApiResponseService } from '../src/common/http/api-response.service.js';
import { NotFoundAppError } from '../src/common/http/app-error.js';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { ReqCtx } from '../src/common/http/request-context.decorator.js';
import type { RequestContext } from '../src/common/http/request-context.interface.js';
import { HttpModule } from '../src/common/http/http.module.js';
import { HealthController } from '../src/health/health.controller.js';

/**
 * End-to-end proof of the correlation contract (AIS-92, plan `D10`).
 *
 * Deliberately **not** built on `AppModule`: it needs only `HttpModule` (the
 * global filter + interceptor) plus the real `HealthController`, so it runs on
 * every Node version instead of self-skipping like the `AppModule` suites. What
 * it pins is the whole DoD of the ticket:
 *
 *   * every enveloped response carries `meta.requestId`, and the same value is
 *     on the `X-Request-Id` response header;
 *   * a valid inbound `X-Request-Id` is preserved (a proxy or client can chain
 *     the trace);
 *   * an invalid inbound id is replaced, never echoed;
 *   * the exempt `/healthz` route stays byte-identical (no `meta`) while still
 *     getting the header.
 */

/** Canonical lowercase UUID shape; version/variant nibbles are not asserted. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Value of the `X-Request-Id` response header (Node lower-cases the names). */
const REQUEST_ID_HEADER = 'x-request-id';

/** Enveloped success body as the specs assert it. */
interface EnvelopeBody {
  readonly data: unknown;
  readonly meta: { readonly requestId: string; readonly timestamp: string };
}

/** Enveloped error body as the specs assert it. */
interface ErrorEnvelopeBody {
  readonly error: { readonly status: number; readonly requestId: string };
}

/** `/healthz` payload, unchanged by the envelope work. */
interface HealthBody {
  readonly status: string;
  readonly deployDate: string | null;
  readonly commitHash: string | null;
  readonly uptime: number;
  readonly timestamp: string;
}

/**
 * Route probe: the smallest controller that produces one enveloped success and
 * one enveloped failure through the real `ApiResponseService` / filter.
 */
@Controller('probe')
class ProbeController {
  constructor(private readonly responses: ApiResponseService) {}

  /** `GET /api/probe` — enveloped success. */
  @Get()
  ping(@ReqCtx() ctx: RequestContext): ApiEnvelope<{ ping: true }> {
    return this.responses.ok({ ping: true }, ctx);
  }

  /** `GET /api/probe/boom` — enveloped `404`. */
  @Get('boom')
  boom(): never {
    throw new NotFoundAppError('probe route');
  }
}

/**
 * @param value - an `inject()` response header value (untyped: might be an array).
 * @returns it as a single string, or `undefined` when absent.
 */
function readHeader(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

describe('requestId correlation (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [HealthController, ProbeController],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    // Mirror src/main.ts: the global prefix, with the probe excluded from it.
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a UUID requestId and echoes it on the envelope and the header', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/probe' });

    expect(response.statusCode).toBe(200);

    const body = response.json<EnvelopeBody>();

    expect(body.meta.requestId).toMatch(UUID_PATTERN);
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe(
      body.meta.requestId,
    );
  });

  it('reuses a valid inbound X-Request-Id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/probe',
      headers: { [REQUEST_ID_HEADER]: 'test-123' },
    });

    const body = response.json<EnvelopeBody>();

    expect(body.meta.requestId).toBe('test-123');
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe('test-123');
  });

  it('replaces an invalid inbound X-Request-Id instead of echoing it', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/probe',
      headers: { [REQUEST_ID_HEADER]: 'not a valid id' },
    });

    const body = response.json<EnvelopeBody>();
    const headerId = readHeader(response.headers[REQUEST_ID_HEADER]);

    expect(body.meta.requestId).not.toBe('not a valid id');
    expect(body.meta.requestId).toMatch(UUID_PATTERN);
    expect(headerId).toBe(body.meta.requestId);
  });

  it('echoes the requestId on an error envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/probe/boom',
      headers: { [REQUEST_ID_HEADER]: 'test-error-1' },
    });

    expect(response.statusCode).toBe(404);

    const body = response.json<ErrorEnvelopeBody>();

    expect(body.error.status).toBe(404);
    expect(body.error.requestId).toBe('test-error-1');
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe(
      'test-error-1',
    );
  });

  it('answers an unknown route with the error envelope, not a bare 500', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/does-not-exist',
    });

    expect(response.statusCode).toBe(404);

    const body = response.json<ErrorEnvelopeBody>();

    // The filter host has no handler/class for an unmatched URL; the envelope
    // must survive that instead of collapsing into a Fastify 500.
    expect(body.error.status).toBe(404);
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe(
      body.error.requestId,
    );
  });

  it('keeps /healthz raw while still setting the header', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);

    const body = response.json<HealthBody>();

    // Byte-identical payload for the Docker healthcheck / watchdog: no metadata.
    expect(Object.keys(body).sort()).toEqual([
      'commitHash',
      'deployDate',
      'status',
      'timestamp',
      'uptime',
    ]);
    expect(body.status).toBe('oks');
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toMatch(
      UUID_PATTERN,
    );
  });
});
