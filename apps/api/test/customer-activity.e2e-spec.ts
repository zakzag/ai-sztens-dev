import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { and, count, eq, like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { auditLogs, customers } from '../src/db/schema.js';
import { probeDatabase, reportDatabaseSkip } from './lib/database-gate.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the four activity endpoints (AIS-178, slice f).
 *
 * The slice's DoD is "an entry can be created, listed, edited with a **moving**
 * token and soft-deleted, and `customers.lastActivityAt` follows all four" — which
 * only the real database can prove, because the token is a nullable
 * `updated_at` compared through `coalesce(updated_at, created_at)` and the
 * `lastActivityAt` projection is a `max(created_at) WHERE deleted_at IS NULL`
 * subquery. A mocked repository can only confirm what the mock was told.
 *
 * Hygiene (the same rules as the contacts suite): the fixture carries a unique
 * `e2e-<uuid>` legal-name prefix, the business rows are removed in `afterAll` (the
 * customer cascade takes the activities), and the ledger is left untouched — it is
 * append-only by trigger, and its rows are tagged with a fixed user agent so the
 * documented purge recipe can find them.
 */

interface CustomerBody {
  readonly id: string;
  readonly lastActivityAt: string | null;
}

interface ActivityBody {
  readonly id: string;
  readonly customerId: string;
  readonly type: string;
  readonly body: string;
  readonly authorType: string;
  readonly authorName: string;
  readonly metadata: unknown;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

interface SuccessEnvelopeBody<T> {
  readonly data: T;
  readonly meta: {
    readonly requestId: string;
    readonly pagination?: {
      readonly page: number;
      readonly limit: number;
      readonly total: number;
      readonly totalPages: number;
    };
  };
}

interface ErrorEnvelopeBody {
  readonly error: {
    readonly code: string;
    readonly status: number;
    readonly details: readonly { readonly path: string }[];
  };
}

/** User agent that tags every ledger row this suite writes. */
const AUDIT_TAG = 'customer-activity-e2e/1.0 (AIS-178 f)';

/** Unknown but valid uuid, for the "no such customer" case. */
const UNKNOWN_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

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
    createFastifyAdapter(),
  );
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  await app.init();
  return app;
}

describe('CustomerActivitiesController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  const prefix = `e2e-${randomUUID()}`;

  let customerId = '';
  let olderActivityId = '';
  let olderCreatedAt = '';
  let newerActivityId = '';
  let newerCreatedAt = '';

  beforeAll(async () => {
    const booted = await bootApp();
    if (booted === null) return;

    const handle = booted.get<Database>(DATABASE);

    if (!(await probeDatabase(handle))) {
      await booted.close();
      reportDatabaseSkip();
      return;
    }

    app = booted;
    database = handle;
  });

  afterAll(async () => {
    if (database !== null) {
      // The ledger is append-only, so only the business rows are removed; the
      // activities go with the customer (ON DELETE cascade).
      await database
        .delete(customers)
        .where(like(customers.legalName, `${prefix}%`))
        .catch((error: unknown) => {
          console.warn('[database-gate] cleanup failed:', error);
        });
    }
    if (app !== null) {
      await app.close();
    }
  });

  /** Reads the ledger rows of one recorded table/operation pair. */
  async function countAuditRows(
    recordId: string,
    tableName: string,
    operation: string,
  ): Promise<number> {
    if (database === null) return 0;

    const rows = await database
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.recordId, recordId),
          eq(auditLogs.tableName, tableName),
          eq(auditLogs.operation, operation),
          eq(auditLogs.userAgent, AUDIT_TAG),
        ),
      );

    return Number(rows[0]?.total ?? 0);
  }

  /** Reads the parent customer, to observe `lastActivityAt`. */
  async function readCustomer(id: string): Promise<CustomerBody> {
    if (app === null) throw new Error('the app was not booted');

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${id}`,
    });

    expect(response.statusCode).toBe(200);

    return readEnvelope<CustomerBody>(response.json()).data;
  }

  it('creates the customer the feed hangs off, with no activity yet', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ type: 'company', legalName: `${prefix} Kft.` }),
    });

    expect(response.statusCode).toBe(201);
    customerId = readEnvelope<CustomerBody>(response.json()).data.id;
    expect(customerId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await readCustomer(customerId)).lastActivityAt).toBeNull();
  });

  it('POST records the first entry in the system author name', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/activities`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'note',
        body: 'Called the owner about the missing invoice.',
      }),
    });

    expect(response.statusCode).toBe(201);

    const activity = readEnvelope<ActivityBody>(response.json()).data;

    expect(activity.customerId).toBe(customerId);
    expect(activity.body).toBe('Called the owner about the missing invoice.');
    // The author is a server decision: the body cannot carry it (`F3`).
    expect(activity.authorType).toBe('system');
    expect(activity.authorName).toBe('system');
    expect(activity.updatedAt).toBeNull();

    olderActivityId = activity.id;
    olderCreatedAt = activity.createdAt;

    expect(await countAuditRows(olderActivityId, 'activities', 'insert')).toBe(
      1,
    );
  });

  it('POST rejects an author in the body', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/activities`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'note',
        body: 'Trying to sign in someone else name.',
        authorName: 'Someone Else',
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('POST records a second, newer entry', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/activities`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'call',
        body: 'Discussed the payment schedule.',
        metadata: { durationSeconds: 92 },
      }),
    });

    expect(response.statusCode).toBe(201);

    const activity = readEnvelope<ActivityBody>(response.json()).data;

    newerActivityId = activity.id;
    newerCreatedAt = activity.createdAt;
    expect(activity.metadata).toEqual({ durationSeconds: 92 });
  });

  it('GET lists the feed newest first with a pager block', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/activities`,
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<readonly ActivityBody[]>(response.json());

    expect(envelope.data.map((row) => row.id)).toEqual([
      newerActivityId,
      olderActivityId,
    ]);
    expect(envelope.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('GET honours order=asc', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/activities?order=asc`,
    });

    expect(response.statusCode).toBe(200);
    expect(
      readEnvelope<readonly ActivityBody[]>(response.json()).data.map(
        (row) => row.id,
      ),
    ).toEqual([olderActivityId, newerActivityId]);
  });

  it('the customer detail reports the newest entry as lastActivityAt', async () => {
    if (app === null) return;

    expect((await readCustomer(customerId)).lastActivityAt).toBe(
      newerCreatedAt,
    );
  });

  it('PATCH answers 409 STALE_WRITE for a token that never matched', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/activities/${olderActivityId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        body: 'Edited with a wrong token.',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).error.code).toBe('STALE_WRITE');
  });

  it('PATCH accepts the first edit with the createdAt token and moves it', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/activities/${olderActivityId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        body: 'Called again; the invoice was sent.',
        updatedAt: olderCreatedAt,
      }),
    });

    expect(response.statusCode).toBe(200);

    const activity = readEnvelope<ActivityBody>(response.json()).data;

    expect(activity.body).toBe('Called again; the invoice was sent.');
    expect(activity.updatedAt).not.toBeNull();
    // The token moved, so the second edit must not accept `createdAt` any more.
    expect(activity.updatedAt).not.toBe(olderCreatedAt);

    expect(await countAuditRows(olderActivityId, 'activities', 'update')).toBe(
      1,
    );

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/activities/${olderActivityId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        body: 'Second edit with the old token.',
        updatedAt: olderCreatedAt,
      }),
    });

    expect(stale.statusCode).toBe(409);
  });

  it('PATCH with only the token is a no-op, not a write', async () => {
    if (app === null) return;

    const list = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/activities?order=asc`,
    });
    const [first] = readEnvelope<readonly ActivityBody[]>(list.json()).data;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/activities/${olderActivityId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ updatedAt: first?.updatedAt }),
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<ActivityBody>(response.json()).data.body).toBe(
      'Called again; the invoice was sent.',
    );
    // Nothing changed, so the ledger must not grow (the b-plan `D7` rule).
    expect(await countAuditRows(olderActivityId, 'activities', 'update')).toBe(
      1,
    );
  });

  it('DELETE hides the entry and moves lastActivityAt to the previous one', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/activities/${newerActivityId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<null>(response.json()).data).toBeNull();

    expect(
      await countAuditRows(newerActivityId, 'activities', 'soft_delete'),
    ).toBe(1);
    expect((await readCustomer(customerId)).lastActivityAt).toBe(
      olderCreatedAt,
    );
  });

  it('the feed no longer contains the hidden entry', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/activities`,
    });

    const envelope = readEnvelope<readonly ActivityBody[]>(response.json());

    expect(envelope.data.map((row) => row.id)).toEqual([olderActivityId]);
    expect(envelope.meta.pagination?.total).toBe(1);
  });

  it('DELETE answers 404 on a repeat', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/activities/${newerActivityId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for an unknown customer and 400 for a malformed uuid', async () => {
    if (app === null) return;

    const unknown = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${UNKNOWN_ID}/activities`,
    });
    const malformed = await app.inject({
      method: 'GET',
      url: '/api/admin/customers/not-a-uuid/activities',
    });
    // There is deliberately no single-entry read: the feed is the only read, so a
    // `GET …/activities/:activityId` stays a `404`.
    const single = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/activities/${olderActivityId}`,
    });

    expect(unknown.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
    expect(single.statusCode).toBe(404);
  });

  it('answers 404 for an unknown activity of a live customer', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/activities/${UNKNOWN_ID}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        body: 'Edit of a phantom entry.',
        updatedAt: olderCreatedAt,
      }),
    });

    expect(response.statusCode).toBe(404);
  });
});
