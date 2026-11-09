import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { apiKeys } from '../src/db/schema.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';
import { DATABASE_SKIP_REASON, probeDatabase } from './lib/database-gate.js';

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
 * - `main.ts` applies the `api` prefix itself, so it is re-applied here. Body
 *   validation is the route-level `ZodBodyPipe` (part of the controller), and
 *   the envelope filter comes from the real `HttpModule` inside `AppModule`, so
 *   nothing has to be re-registered for either — which is exactly what this
 *   suite verifies.
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

/** `meta.pagination` of a paginated list (AIS-107). */
interface PaginationMetaBody {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

interface ResponseMetaBody {
  readonly requestId: string;
  readonly timestamp: string;
  readonly pagination?: PaginationMetaBody;
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

/** Name of the correlation response header (Node lower-cases the names). */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * @param value - an `inject()` response header value (untyped: may be an array).
 * @returns it as a single string, or `undefined` when absent.
 */
function readHeader(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function bootApp(): Promise<NestFastifyApplication | null> {
  const AppModule = await loadAppModuleOrSkip();
  if (AppModule === null) return null;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    createFastifyAdapter(),
  );
  // Mirror src/main.ts — see the file docblock. No global validation pipe is
  // installed there any more (the Zod pipe on the route owns validation).
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  await app.init();
  return app;
}

describe('ApiKeysController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;
  const identifier = `e2e-${randomUUID()}`;
  const otherIdentifier = `e2e-${randomUUID()}`;

  /**
   * Prefix of the seeded pagination fixtures.
   *
   * The table is shared with the dev stack, so an unfiltered list is not
   * deterministic: every pagination assertion below filters on this prefix
   * (`?q=`), which is exactly the feature the ticket adds.
   */
  const pagePrefix = `e2e-${randomUUID()}`;
  const seededCount = 12;

  beforeAll(async () => {
    const booted = await bootApp();
    if (booted === null) return;

    const handle = booted.get<Database>(DATABASE);

    // This suite persists real rows, so it needs a reachable Postgres. Without
    // one every call fails inside the repository (`ECONNREFUSED :5432`) and the
    // filter answers 500 — a database outage, not a contract regression. Warn
    // loudly and leave `app` null so every test self-skips.
    if (!(await probeDatabase(handle))) {
      console.warn(`[database-gate] ${DATABASE_SKIP_REASON}`);
      await booted.close();
      return;
    }

    app = booted;
    database = handle;
  });

  beforeAll(async () => {
    if (database === null) return;

    // Twelve rows so a 10-row page boundary is observable: page 2 holds the
    // last two, and `totalPages` is 2 (AIS-107 DoD).
    await database.insert(apiKeys).values(
      Array.from({ length: seededCount }, (_, index) => {
        const suffix = String(index + 1).padStart(2, '0');

        return {
          name: `${pagePrefix}-${suffix}`,
          identifier: `${pagePrefix}-${suffix}`,
          apiKey: `tok_page_${suffix}`,
        };
      }),
    );
  });

  afterAll(async () => {
    if (database !== null) {
      await database
        .delete(apiKeys)
        .where(like(apiKeys.identifier, 'e2e-%'))
        // A cleanup failure must not turn a finished run into "suite failed to
        // run"; it is reported instead of swallowed silently.
        .catch((error: unknown) => {
          console.warn('[database-gate] cleanup failed:', error);
        });
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
    // The same id must be on the header, so a network entry and a log line match.
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe(
      envelope.meta.requestId,
    );
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

  it('GET /api/api-keys lists the created keys inside `data` with `meta.pagination`', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      // `limit=100` keeps the assertion independent of the table's other rows.
      url: '/api/api-keys?limit=100',
      // A valid inbound id must survive end-to-end (proxy/client trace chaining).
      headers: { [REQUEST_ID_HEADER]: 'test-123' },
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<unknown>(response.json());
    expect(envelope.meta.requestId).toBe('test-123');
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe('test-123');
    expect(envelope.meta.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 100 }),
    );
    expect(isApiKeyList(envelope.data)).toBe(true);
    if (!isApiKeyList(envelope.data)) return;

    const identifiers = envelope.data.map((item) => item.identifier);
    expect(identifiers).toContain(identifier);
    expect(identifiers).toContain(otherIdentifier);
  });

  it('GET /api/api-keys serves page 2 of a filtered, name-ascending list', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys?q=${pagePrefix}&page=2&limit=10&sort=name&order=asc`,
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<unknown>(response.json());
    expect(isApiKeyList(envelope.data)).toBe(true);
    if (!isApiKeyList(envelope.data)) return;

    // Sorted by name ascending, the 12 seeded rows put `-11` and `-12` on page 2.
    expect(envelope.data.map((item) => item.name)).toEqual([
      `${pagePrefix}-11`,
      `${pagePrefix}-12`,
    ]);
    expect(envelope.meta.pagination).toEqual({
      page: 2,
      limit: 10,
      total: seededCount,
      totalPages: 2,
    });
  });

  it('GET /api/api-keys answers an empty result with 200, `data: []` and `total: 0`', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/api-keys?q=${pagePrefix}-does-not-exist`,
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<unknown>(response.json());
    expect(envelope.data).toEqual([]);
    expect(envelope.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('GET /api/api-keys rejects limit=101 with 400 + a `limit` detail', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/api-keys?limit=101',
    });

    expect(response.statusCode).toBe(400);

    const body = readError(response.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details[0]?.path).toBe('limit');
  });

  it('GET /api/api-keys rejects an unknown sort column with 400 + a `sort` detail', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/api-keys?sort=passwordHash',
    });

    expect(response.statusCode).toBe(400);

    const body = readError(response.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details[0]?.path).toBe('sort');
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
    // The error envelope and the header carry the same id (see AIS-92).
    expect(readHeader(response.headers[REQUEST_ID_HEADER])).toBe(
      body.error.requestId,
    );
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

  /**
   * The mutation convention (AIS-108): `PATCH` is partial and version-guarded,
   * `DELETE` is a soft delete that answers `data: null`, and a semantically
   * impossible payload is a `422` — not a `400`.
   *
   * The block owns its own row so the scenarios can run in order and the
   * delete steps cannot disturb the list/pagination assertions above.
   */
  describe('mutation convention', () => {
    const mutationIdentifier = `e2e-${randomUUID()}`;

    /** Version the client last saw — the token every `PATCH` has to send. */
    let knownUpdatedAt = '';

    it('PATCH with the current version updates the row and bumps updatedAt', async () => {
      if (app === null) return;

      const created = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'E2E mutation',
          identifier: mutationIdentifier,
          apiKey: 'tok_e2e_mutation',
        }),
      });
      expect(created.statusCode).toBe(201);

      const createdEnvelope = readEnvelope<unknown>(created.json());
      expect(isApiKeyBody(createdEnvelope.data)).toBe(true);
      if (!isApiKeyBody(createdEnvelope.data)) return;
      knownUpdatedAt = createdEnvelope.data.updatedAt;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'E2E mutation renamed',
          updatedAt: knownUpdatedAt,
        }),
      });

      expect(response.statusCode).toBe(200);

      const envelope = readEnvelope<unknown>(response.json());
      expect(envelope.meta.requestId.length).toBeGreaterThan(0);
      expect(isApiKeyBody(envelope.data)).toBe(true);
      if (!isApiKeyBody(envelope.data)) return;

      expect(envelope.data.name).toBe('E2E mutation renamed');
      expect(envelope.data.identifier).toBe(mutationIdentifier);
      // The server owns `updatedAt`: the new version is strictly newer than the
      // token the client sent, which is what makes the next stale write fail.
      expect(Date.parse(envelope.data.updatedAt)).toBeGreaterThan(
        Date.parse(knownUpdatedAt),
      );
    });

    it('PATCH replayed with the previous version answers 409 STALE_WRITE', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'E2E lost update',
          updatedAt: knownUpdatedAt,
        }),
      });

      expect(response.statusCode).toBe(409);

      const body = readError(response.json());
      expect(body.error.code).toBe('STALE_WRITE');
      expect(body.error.status).toBe(409);
      expect(body.error.details[0]?.path).toBe('updatedAt');
    });

    it('PATCH with an expiry in the past answers 422 SEMANTIC_VALIDATION_FAILED', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          expiresAt: '2020-01-01T00:00:00.000Z',
          updatedAt: knownUpdatedAt,
        }),
      });

      expect(response.statusCode).toBe(422);

      const body = readError(response.json());
      expect(body.error.code).toBe('SEMANTIC_VALIDATION_FAILED');
      expect(body.error.details[0]?.path).toBe('expiresAt');
    });

    it('PATCH rejects a server-managed field with 400 (`.strict()`)', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          identifier: 'e2e-renamed',
          updatedAt: knownUpdatedAt,
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
    });

    it('PATCH without updatedAt answers 400 (the token is required)', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'E2E no token' }),
      });

      expect(response.statusCode).toBe(400);
      expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE answers 200 with `data: null` and hides the row from every read', async () => {
      if (app === null) return;

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${mutationIdentifier}`,
      });

      expect(deleted.statusCode).toBe(200);

      const envelope = readEnvelope<unknown>(deleted.json());
      // `200` + `data: null`, never `204`: the envelope still carries `meta`.
      expect(envelope.data).toBeNull();
      expect(envelope.meta.requestId.length).toBeGreaterThan(0);

      const read = await app.inject({
        method: 'GET',
        url: `/api/api-keys/${mutationIdentifier}`,
      });
      expect(read.statusCode).toBe(404);
      expect(readError(read.json()).error.code).toBe('NOT_FOUND');

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/api-keys/${mutationIdentifier}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'E2E after delete',
          updatedAt: knownUpdatedAt,
        }),
      });
      expect(patched.statusCode).toBe(404);
    });

    it('DELETE a second time answers 404 (idempotency is 404, not 204)', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${mutationIdentifier}`,
      });

      expect(response.statusCode).toBe(404);
      expect(readError(response.json()).error.code).toBe('NOT_FOUND');
    });

    it('GET /api/api-keys?q=<deleted identifier> omits it from data and total', async () => {
      if (app === null) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/api-keys?q=${mutationIdentifier}`,
      });

      expect(response.statusCode).toBe(200);

      const envelope = readEnvelope<unknown>(response.json());
      expect(envelope.data).toEqual([]);
      expect(envelope.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });
});
