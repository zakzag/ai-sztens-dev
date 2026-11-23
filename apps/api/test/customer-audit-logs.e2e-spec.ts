import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { customers } from '../src/db/schema.js';
import { DATABASE_SKIP_REASON, probeDatabase } from './lib/database-gate.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the read-only audit log (AIS-178, slice f) — and the
 * AIS-14 DoD chain itself.
 *
 * The chain the ticket asks for is **create → list → detail → activity → the entry
 * appears in the audit log**, and it can only be verified against the real ledger:
 * every mutation writes its row from inside the same transaction, through
 * `AuditWriter`, with the actor the provider resolves. A mocked suite would have to
 * assume all of that.
 *
 * What this suite deliberately does **not** do: mutate the ledger. `0007` makes it
 * append-only by trigger, so the suite leaves its rows behind (they carry a fixed
 * user agent) and `docs/Specs/Database-Local.md` documents the purge recipe.
 */

interface CustomerBody {
  readonly id: string;
}

interface ActivityBody {
  readonly id: string;
}

interface AuditLogBody {
  readonly id: number;
  readonly customerId: string | null;
  readonly tableName: string;
  readonly recordId: string | null;
  readonly operation: string;
  readonly actorType: string;
  readonly actorName: string;
  readonly occurredAt: string;
  readonly userAgent: string | null;
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
const AUDIT_TAG = 'customer-audit-logs-e2e/1.0 (AIS-178 f)';

/** Unknown but valid uuid, for the "no such customer" case. */
const UNKNOWN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/** An actor id no row can carry while the API has no authentication. */
const UNKNOWN_ACTOR_ID = '2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d';

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

describe('CustomerAuditLogsController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  const prefix = `e2e-${randomUUID()}`;

  let customerId = '';
  let activityId = '';

  beforeAll(async () => {
    const booted = await bootApp();
    if (booted === null) return;

    const handle = booted.get<Database>(DATABASE);

    if (!(await probeDatabase(handle))) {
      console.warn(`[database-gate] ${DATABASE_SKIP_REASON}`);
      await booted.close();
      return;
    }

    app = booted;
    database = handle;
  });

  afterAll(async () => {
    if (database !== null) {
      // The ledger is append-only: only the business rows are removed, and its
      // rows stay behind tagged with `AUDIT_TAG` for the documented purge recipe.
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

  /** Reads one page of the ledger of the fixture customer. */
  async function readLedger(
    query = '',
  ): Promise<SuccessEnvelopeBody<readonly AuditLogBody[]>> {
    if (app === null) throw new Error('the app was not booted');

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/audit-logs${query}`,
    });

    expect(response.statusCode).toBe(200);

    return readEnvelope<readonly AuditLogBody[]>(response.json());
  }

  it('the DoD chain: create the customer, then add an activity', async () => {
    if (app === null) return;

    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ type: 'company', legalName: `${prefix} Kft.` }),
    });

    expect(created.statusCode).toBe(201);
    customerId = readEnvelope<CustomerBody>(created.json()).data.id;

    const listed = await app.inject({
      method: 'GET',
      url: `/api/admin/customers?q=${prefix}`,
    });
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
    });
    const activity = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/activities`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'note',
        body: 'Recorded after the customer existed.',
      }),
    });

    expect(listed.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    expect(activity.statusCode).toBe(201);

    activityId = readEnvelope<ActivityBody>(activity.json()).data.id;
  });

  it('the ledger contains the creation and the activity, newest first', async () => {
    if (app === null) return;

    const envelope = await readLedger();

    expect(envelope.data).toHaveLength(2);

    const [newest, oldest] = envelope.data;

    expect(newest?.tableName).toBe('activities');
    expect(newest?.recordId).toBe(activityId);
    expect(newest?.operation).toBe('insert');
    expect(oldest?.tableName).toBe('customers');
    expect(oldest?.recordId).toBe(customerId);
    expect(oldest?.operation).toBe('insert');
    // The append order is the id order, so the tie-breaker of `F9` is observable.
    expect(newest?.id).toBeGreaterThan(oldest?.id ?? 0);
    expect(newest?.occurredAt >= (oldest?.occurredAt ?? '')).toBe(true);
  });

  it('every row belongs to this customer and was written by this suite', async () => {
    if (app === null) return;

    const envelope = await readLedger();

    expect(envelope.data.every((row) => row.customerId === customerId)).toBe(
      true,
    );
    expect(envelope.data.every((row) => row.userAgent === AUDIT_TAG)).toBe(
      true,
    );
    expect(envelope.data.every((row) => row.actorType === 'system')).toBe(true);
    expect(envelope.meta.pagination?.total).toBe(2);
  });

  it('filters by tableName', async () => {
    if (app === null) return;

    const envelope = await readLedger('?tableName=activities');

    expect(envelope.data).toHaveLength(1);
    expect(envelope.data[0]?.tableName).toBe('activities');
    expect(envelope.meta.pagination?.total).toBe(1);
  });

  it('filters by operation', async () => {
    if (app === null) return;

    const inserts = await readLedger('?operation=insert');
    const updates = await readLedger('?operation=update');

    expect(inserts.data).toHaveLength(2);
    expect(updates.data).toHaveLength(0);
  });

  it('filters by actorId, which no row carries while the API is unauthenticated', async () => {
    if (app === null) return;

    const envelope = await readLedger(`?actorId=${UNKNOWN_ACTOR_ID}`);

    expect(envelope.data).toHaveLength(0);
    expect(envelope.meta.pagination?.total).toBe(0);
  });

  it('filters by the occurredAt window', async () => {
    if (app === null) return;

    const all = await readLedger();
    const lastOccurredAt = all.data[all.data.length - 1]?.occurredAt ?? '';

    const inclusive = await readLedger(
      `?from=${encodeURIComponent(lastOccurredAt)}`,
    );
    const empty = await readLedger(
      `?to=${encodeURIComponent('2000-01-01T00:00:00.000Z')}`,
    );

    expect(inclusive.data).toHaveLength(2);
    expect(empty.data).toHaveLength(0);
  });

  it('honours order=asc', async () => {
    if (app === null) return;

    const envelope = await readLedger('?order=asc');

    expect(envelope.data[0]?.tableName).toBe('customers');
    expect(envelope.data[1]?.tableName).toBe('activities');
  });

  it('answers 422 for an inverted window, with the field to fix', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url:
        `/api/admin/customers/${customerId}/audit-logs` +
        '?from=2026-11-30T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z',
    });

    expect(response.statusCode).toBe(422);

    const error = readError(response.json()).error;

    expect(error.code).toBe('SEMANTIC_VALIDATION_FAILED');
    expect(error.details[0]?.path).toBe('from');
  });

  it('answers 400 for an unknown tableName', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/audit-logs?tableName=payroll`,
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 404 for an unknown customer and 400 for a malformed uuid', async () => {
    if (app === null) return;

    const unknown = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${UNKNOWN_ID}/audit-logs`,
    });
    const malformed = await app.inject({
      method: 'GET',
      url: '/api/admin/customers/not-a-uuid/audit-logs',
    });

    expect(unknown.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
  });

  it('offers no write on the ledger', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/audit-logs`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ tableName: 'customers', operation: 'insert' }),
    });

    expect(response.statusCode).toBe(404);
  });
});
