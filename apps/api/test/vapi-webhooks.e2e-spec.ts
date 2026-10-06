import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import { VAPI_WEBHOOK_CONFIG } from '../src/vapi-webhooks/vapi-webhook-config.js';
import { VapiSignatureGuard } from '../src/vapi-webhooks/vapi-signature.guard.js';
import { VapiWebhooksController } from '../src/vapi-webhooks/vapi-webhooks.controller.js';
import { VapiWebhooksService } from '../src/vapi-webhooks/vapi-webhooks.service.js';

/**
 * E2E for the VAPI inbound webhook surface.
 *
 * The application is assembled from the real controller/guard/service plus a
 * stubbed `VAPI_WEBHOOK_CONFIG`, and bootstrapped exactly like `main.ts`
 * (Fastify + `rawBody: true` + global `api` prefix + the same ValidationPipe).
 * That is deliberate:
 *
 *   * `rawBody` must be passed as a **Nest application option**. The original
 *     version of this file (and of `main.ts`) passed it to `FastifyAdapter`,
 *     where it does not exist: the request never got a `rawBody`, and the
 *     happy path below — which is exactly the request VAPI sends — would have
 *     answered 401 in production.
 *   * Nest's Fastify adapter hands the guard a **Buffer** raw body, so the
 *     happy path here also proves the guard's Buffer handling.
 *
 * `AppModule` is intentionally NOT imported: it pulls in `@nestjs/config`,
 * which ships CommonJS only and `require()`s the ESM-only `@nestjs/common`.
 * Jest's ESM runner refuses that on Node < 24.9, which would make this suite
 * unloadable on the versions CI/dev machines use today. The full `AppModule`
 * graph is exercised by `app-boot.e2e-spec.ts` (gated on that Node version).
 *
 * Caddy's 405 pre-filter is not tested here because it lives outside the
 * NestJS process; it is covered by `scripts/test/lib/10-services.sh`.
 */

const SECRET = 'e2e-vapi-secret';
const RAW_BODY =
  '{"message":{"id":"evt-e2e-1","type":"tool-calls","call":{"id":"call-e2e-1"}}}';

function sign(secret: string, ts: string, body: string): string {
  const hex = createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');
  return `sha256=${hex}`;
}

interface JsonBody {
  received: boolean;
  id: string;
}

function isJsonBody(value: unknown): value is JsonBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['received'] === true && typeof v['id'] === 'string';
}

async function createApp(options?: {
  secret?: string;
  toleranceSeconds?: number;
  rawBody?: boolean;
}): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [VapiWebhooksController],
    providers: [
      VapiWebhooksService,
      VapiSignatureGuard,
      {
        provide: VAPI_WEBHOOK_CONFIG,
        useValue: {
          secret: options?.secret === undefined ? SECRET : options.secret,
          toleranceSeconds: options?.toleranceSeconds,
        },
      },
    ],
  }).compile();

  // Mirror src/main.ts: `rawBody` is the SECOND argument of
  // `createNestApplication` (Nest application options), not an adapter option.
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { rawBody: options?.rawBody ?? true },
  );
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

function signedRequest(
  body: string,
  overrides: {
    timestamp?: string;
    signature?: string | null;
    omitTimestamp?: boolean;
  } = {},
): {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  payload: string;
} {
  const ts = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (overrides.omitTimestamp !== true) headers['x-vapi-timestamp'] = ts;
  if (overrides.signature !== null) {
    headers['x-vapi-signature'] = overrides.signature ?? sign(SECRET, ts, body);
  }
  return {
    method: 'POST',
    url: '/api/vapi/webhooks/tool-calls',
    headers,
    payload: body,
  };
}

describe('VapiWebhooks (e2e)', () => {
  let app: NestFastifyApplication;

  afterEach(async () => {
    await app.close();
  });

  it('accepts a correctly signed POST to /api/vapi/webhooks/tool-calls', async () => {
    app = await createApp();

    const response = await app.inject(signedRequest(RAW_BODY));

    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    if (!isJsonBody(body)) throw new Error('webhook body shape mismatch');
    expect(body.received).toBe(true);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/i); // uuid v4
  });

  it('accepts a correctly signed POST to /api/vapi/webhooks/end-of-call-report', async () => {
    app = await createApp();

    const response = await app.inject({
      ...signedRequest(RAW_BODY),
      url: '/api/vapi/webhooks/end-of-call-report',
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects the request when raw body capture is disabled (regression guard)', async () => {
    // This is what production did while `rawBody: true` was passed to
    // `new FastifyAdapter(...)`: the HMAC cannot be recomputed, so the guard
    // must fail closed instead of accepting the request.
    app = await createApp({ rawBody: false });

    const response = await app.inject(signedRequest(RAW_BODY));

    expect(response.statusCode).toBe(401);
    expect(response.json<{ message: string }>().message).toContain(
      'raw body missing',
    );
  });

  it('rejects an invalid signature with 401', async () => {
    app = await createApp();

    const response = await app.inject(
      signedRequest(RAW_BODY, { signature: 'sha256=deadbeef' }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('rejects a tampered payload signed with the original body', async () => {
    app = await createApp();

    const ts = String(Math.floor(Date.now() / 1000));
    // Signature is valid for RAW_BODY, but the request carries RAW_BODY+" ":
    // the guard must verify the bytes on the wire, not a re-serialised body.
    const response = await app.inject(
      signedRequest(`${RAW_BODY} `, { signature: sign(SECRET, ts, RAW_BODY) }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('rejects a missing signature header with 401', async () => {
    app = await createApp();

    const response = await app.inject(
      signedRequest(RAW_BODY, { signature: null }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('rejects a missing timestamp header with 401', async () => {
    app = await createApp();

    const response = await app.inject(
      signedRequest(RAW_BODY, { omitTimestamp: true }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('rejects a stale timestamp with 401', async () => {
    app = await createApp();

    const response = await app.inject(
      signedRequest(RAW_BODY, {
        timestamp: String(Math.floor(Date.now() / 1000) - 10_000),
      }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('honours a narrowed tolerance window', async () => {
    app = await createApp({ toleranceSeconds: 30 });

    const response = await app.inject(
      signedRequest(RAW_BODY, {
        timestamp: String(Math.floor(Date.now() / 1000) - 60),
      }),
    );

    expect(response.statusCode).toBe(401);
  });

  it('fails closed with 500 when no secret is configured', async () => {
    app = await createApp({ secret: '' });

    const response = await app.inject(signedRequest(RAW_BODY));

    expect(response.statusCode).toBe(500);
  });
});
