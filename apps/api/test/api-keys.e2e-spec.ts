import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { apiKeys } from '../src/db/schema.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the API-key endpoints **and of the envelope**.
 *
 * The story's DoD is “the row is persisted *and* the response follows the
 * contract”, which a mocked suite cannot prove, so this file runs against the
 * **real** `AppModule` and the **real** local Postgres (`DATABASE_URL` from
 * `apps/api/.env.local` / the dev stack). Each run uses a unique
 * `e2e-<uuid>` identifier and removes its own rows in `afterAll`, leaving the
 * table exactly as it was.
 *
 * Two environment caveats, both loud instead of silent:
 *
 * - `AppModule` pulls in the CommonJS-only `@nestjs/config`; Jest's ESM runner
 *   can only `require()` it on Node >= 24.9, so on older runtimes the suite
 *   self-skips with a warning (see `test/lib/app-module-gate.ts`).
 * - `main.ts` applies the `api` prefix and the global `ValidationPipe` itself,
 *   so both are re-applied here. The envelope filter comes from the real
 *   `HttpModule` inside `AppModule`, so nothing has to be re-registered for it —
 *   which is exactly what this suite verifies.
 */

interface ApiKeyBody {
  readonly id: string;
  readonly name: string;
  readonly identifier: string;
  readonly description: string | null;
  readonly apiKey: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ResponseMetaBody {
  readonly requestId: string;
  readonly timestamp: string;
}

interface SuccessEnvelopeBody<T> {
  readonly data: T;
  readonly meta: ResponseMetaBody;
}

interface ErrorDetailBody {
  readonly path: string;
  readonly message: string;
}

interface ErrorEnvelopeBody {
  readonly error: {
    readonly code: string;
    readonly status: number;
    readonly message: string;
    readonly details: readonly ErrorDetailBody[];
    readonly requestId: string;
    readonly timestamp: string;
    readonly path: string;
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isApiKeyBody(value: unknown): value is ApiKeyBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body['id'] === 'string' &&
    typeof body['name'] === 'string' &&
    typeof body['identifier'] === 'string' &&
    isNullableString(body['description']) &&
    typeof body['apiKey'] === 'string' &&
    isNullableString(body['expiresAt']) &&
    typeof body['createdAt'] === 'string' &&
    typeof body['updatedAt'] === 'string'
  );
}

function isApiKeyList(value: unknown): value is ApiKeyBody[] {
  return Array.isArray(value) && value.every(isApiKeyBody);
}

/** Reads a success body as the envelope (the assertions below prove the shape). */
function readEnvelope<T>(body: unknown): SuccessEnvelopeBody<T> {
  return body as SuccessEnvelopeBody<T>;
}

/** Reads an error body as the error envelope. */
function readError(body: unknown): ErrorEnvelopeBody {
  return body as ErrorEnvelopeBody;
}

async function bootApp(): Promise<NestFastifyApplication | null> {
  const AppModule = await loadAppModuleOrSkip();
  if (AppModule === null) return null;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  // Mirror src/main.ts — see the file docblock.
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

describe('ApiKeysController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;
  const identifier = `e2e-${randomUUID()}`;
  const otherIdentifier = `e2e-${randomUUID()}`;

  beforeAll(async () => {
    app = await bootApp();
    if (app === null) return;
    database = app.get<Database>(DATABASE);
  });

  afterAll(async () => {
    if (database !== null) {
      await database.delete(apiKeys).where(like(apiKeys.identifier, 'e2e-%'));
    }
    if (app !== null) {
      await app.close();
    }
  });

  it('POST /api/api-keys creates the row and answers 201 with the envelope', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E Vapi',
        identifier,
        description: 'created by the e2e suite',
        apiKey: 'tok_e2e_123',
        expiresAt: '2027-01-01T00:00:00.000Z',
      }),
    });

    expect(response.statusCode).toBe(201);

    const envelope = readEnvelope<unknown>(response.json());
    expect(envelope.meta.requestId.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(envelope.meta.timestamp))).toBe(false);
    expect(isApiKeyBody(envelope.data)).toBe(true);
    if (!isApiKeyBody(envelope.data)) return;

    expect(envelope.data.identifier).toBe(identifier);
    expect(envelope.data.name).toBe('E2E Vapi');
    expect(envelope.data.apiKey).toBe('tok_e2e_123');
    expect(envelope.data.expiresAt).toBe('2027-01-01T00:00:00.000Z');

    // The DoD is “the row is persisted”: read it back through the DB handle,
    // not through the API, so a cache cannot fake the success.
    const rows = await database
      ?.select()
      .from(apiKeys)
      .where(like(apiKeys.identifier, identifier));
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.name).toBe('E2E Vapi');
  });

  it('POST /api/api-keys without optional fields stores nulls', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E minimal',
        identifier: otherIdentifier,
        apiKey: 'tok_e2e_min',
      }),
    });

    expect(response.statusCode).toBe(201);

    const envelope = readEnvelope<unknown>(response.json());
    expect(isApiKeyBody(envelope.data)).toBe(true);
    if (!isApiKeyBody(envelope.data)) return;

    expect(envelope.data.description).toBeNull();
    expect(envelope.data.expiresAt).toBeNull();
  });

  it('GET /api/api-keys lists the created keys inside `data`', async () => {
    if (app === null) return;

    const response = await app.inject({ method: 'GET', url: '/api/api-keys' });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<unknown>(response.json());
    expect(isApiKeyList(envelope.data)).toBe(true);
    if (!isApiKeyList(envelope.data)) return;

    const identifiers = envelope.data.map((item) => item.identifier);
    expect(identifiers).toContain(identifier);
    expect(identifiers).toContain(otherIdentifier);
  });

  it('GET /api/api-keys/:identifier returns the key inside `data`', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys/${identifier}`,
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<unknown>(response.json());
    expect(isApiKeyBody(envelope.data)).toBe(true);
    if (!isApiKeyBody(envelope.data)) return;

    expect(envelope.data.identifier).toBe(identifier);
    expect(envelope.data.name).toBe('E2E Vapi');
  });

  it('GET /api/api-keys/:identifier answers 404 with a NOT_FOUND envelope', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys/e2e-does-not-exist-${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);

    const body = readError(response.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.status).toBe(404);
    expect(body.error.requestId.length).toBeGreaterThan(0);
    expect(body.error.path).toContain('/api/api-keys/');
  });

  it('POST /api/api-keys rejects a duplicate identifier with a coded 409', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E duplicate',
        identifier,
        apiKey: 'tok_conflict',
      }),
    });

    expect(response.statusCode).toBe(409);

    const body = readError(response.json());
    expect(body.error.code).toBe('API_KEY_IDENTIFIER_CONFLICT');
    expect(body.error.details[0]?.path).toBe('identifier');
  });

  it('POST /api/api-keys rejects a payload without apiKey with 400 + details', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E invalid',
        identifier: `${identifier}-bad`,
      }),
    });

    expect(response.statusCode).toBe(400);

    const body = readError(response.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details.map((detail) => detail.path)).toContain('apiKey');
  });

  it('POST /api/api-keys rejects server-managed fields with 400', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E inject',
        identifier: `${identifier}-inject`,
        apiKey: 'tok_inject',
        id: '3f8a1d2e-0000-4000-8000-00000000abcd',
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /api/api-keys rejects an identifier with a slash with 400', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'E2E slash',
        identifier: 'e2e/has/slash',
        apiKey: 'tok_slash',
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });
});
