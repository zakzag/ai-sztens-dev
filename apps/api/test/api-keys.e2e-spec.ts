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
 * End-to-end coverage of the API-key endpoints.
 *
 * The story's DoD is “the row is persisted”, which a mocked suite cannot prove,
 * so this file runs against the **real** `AppModule` and the **real** local
 * Postgres (`DATABASE_URL` from `apps/api/.env.local` / the dev stack). Each run
 * uses a unique `e2e-<uuid>` identifier and removes its own rows in `afterAll`,
 * leaving the table exactly as it was.
 *
 * Two environment caveats, both loud instead of silent:
 *
 * - `AppModule` pulls in the CommonJS-only `@nestjs/config`; Jest's ESM runner
 *   can only `require()` it on Node >= 24.9, so on older runtimes the suite
 *   self-skips with a warning (see `test/lib/app-module-gate.ts`). The same
 *   behaviour is then verified manually with `pnpm start` + curl.
 * - `main.ts` applies the `api` prefix and the `ValidationPipe` itself, so both
 *   are re-applied here. Without them the validation cases would pass while
 *   production behaved differently (plan D11).
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

async function bootApp(): Promise<NestFastifyApplication | null> {
  const AppModule = await loadAppModuleOrSkip();
  if (AppModule === null) return null;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  // Mirror src/main.ts — see the file docblock (plan D11).
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

  it('POST /api/api-keys creates the row and answers 201 with ISO timestamps', async () => {
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

    const body: unknown = response.json();
    expect(isApiKeyBody(body)).toBe(true);
    if (!isApiKeyBody(body)) return;

    expect(body.identifier).toBe(identifier);
    expect(body.name).toBe('E2E Vapi');
    expect(body.apiKey).toBe('tok_e2e_123');
    expect(body.expiresAt).toBe('2027-01-01T00:00:00.000Z');
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);

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

    const body: unknown = response.json();
    expect(isApiKeyBody(body)).toBe(true);
    if (!isApiKeyBody(body)) return;

    expect(body.description).toBeNull();
    expect(body.expiresAt).toBeNull();
  });

  it('GET /api/api-keys lists the created keys', async () => {
    if (app === null) return;

    const response = await app.inject({ method: 'GET', url: '/api/api-keys' });

    expect(response.statusCode).toBe(200);

    const body: unknown = response.json();
    expect(isApiKeyList(body)).toBe(true);
    if (!isApiKeyList(body)) return;

    const identifiers = body.map((item) => item.identifier);
    expect(identifiers).toContain(identifier);
    expect(identifiers).toContain(otherIdentifier);
  });

  it('GET /api/api-keys/:identifier returns the key', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys/${identifier}`,
    });

    expect(response.statusCode).toBe(200);

    const body: unknown = response.json();
    expect(isApiKeyBody(body)).toBe(true);
    if (!isApiKeyBody(body)) return;

    expect(body.identifier).toBe(identifier);
    expect(body.name).toBe('E2E Vapi');
  });

  it('GET /api/api-keys/:identifier answers 404 for an unknown identifier', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys/e2e-does-not-exist-${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/api-keys rejects a duplicate identifier with 409', async () => {
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
  });

  it('POST /api/api-keys rejects a payload without apiKey with 400', async () => {
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
  });
});
