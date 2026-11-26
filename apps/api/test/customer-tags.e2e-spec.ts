import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { and, count, eq, like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { auditLogs, customers, tags } from '../src/db/schema.js';
import { probeDatabase, reportDatabaseSkip } from './lib/database-gate.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the three tag endpoints (AIS-178, slice e).
 *
 * The slice's point is "a label can be attached without ever duplicating the
 * catalogue", which a mocked suite cannot prove: the reuse depends on a real
 * `23505` on `tags_name_key`, the idempotent attach on a real composite primary
 * key, and the ledger assertions on real `audit_logs` rows. So this file runs
 * against the real `AppModule` and the real local Postgres.
 *
 * Hygiene (the same rules as `customers.e2e-spec.ts`): every fixture carries a
 * unique `e2e-<uuid>` prefix, business rows are removed in `afterAll` — the
 * customer cascade takes the `customer_tags` links with it, the `tags` rows are
 * deleted explicitly — and the ledger is left untouched, tagged with a fixed user
 * agent so a future purge recipe can find it.
 */

interface CustomerBody {
  readonly id: string;
}

interface TagBody {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

interface DetailBody {
  readonly tags: readonly TagBody[];
}

interface SuccessEnvelopeBody<T> {
  readonly data: T;
  readonly meta: { readonly requestId: string };
}

interface ErrorEnvelopeBody {
  readonly error: {
    readonly code: string;
    readonly status: number;
    readonly details: readonly { readonly path: string }[];
  };
}

/** User agent that tags every ledger row this suite writes. */
const AUDIT_TAG = 'customer-tags-e2e/1.0 (AIS-178 e)';

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

describe('CustomerTagsController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  const prefix = `e2e-${randomUUID()}`;

  let customerId = '';
  let firstTagId = '';
  let secondTagId = '';

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
      // The ledger is append-only: only business rows are removed. The links go
      // with the customer; the catalogue rows are global, so they are deleted by
      // the unique name prefix this suite used.
      await database
        .delete(customers)
        .where(like(customers.legalName, `${prefix}%`))
        .catch((error: unknown) => {
          console.warn('[database-gate] customer cleanup failed:', error);
        });
      await database
        .delete(tags)
        .where(like(tags.name, `${prefix}%`))
        .catch((error: unknown) => {
          console.warn('[database-gate] tag cleanup failed:', error);
        });
    }
    if (app !== null) {
      await app.close();
    }
  });

  /** Reads the ledger rows of one customer, table and operation. */
  async function countAuditRows(
    tableName: string,
    operation: string,
  ): Promise<number> {
    if (database === null) return 0;

    const rows = await database
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.customerId, customerId),
          eq(auditLogs.tableName, tableName),
          eq(auditLogs.operation, operation),
          eq(auditLogs.userAgent, AUDIT_TAG),
        ),
      );

    return Number(rows[0]?.total ?? 0);
  }

  it('creates the customer the tags hang off', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ type: 'company', legalName: `${prefix} Kft.` }),
    });

    expect(response.statusCode).toBe(201);
    customerId = readEnvelope<CustomerBody>(response.json()).data.id;
  });

  it('POST creates the label and the link, one ledger row per table', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ name: `${prefix}-premium` }),
    });

    expect(response.statusCode).toBe(201);

    const tag = readEnvelope<TagBody>(response.json()).data;

    expect(tag.name).toBe(`${prefix}-premium`);
    expect(tag.isActive).toBe(true);
    firstTagId = tag.id;

    expect(await countAuditRows('tags', 'insert')).toBe(1);
    expect(await countAuditRows('customer_tags', 'insert')).toBe(1);
  });

  it('POST with the same name reuses the label and audits nothing new', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ name: `${prefix}-premium` }),
    });

    expect(response.statusCode).toBe(201);
    expect(readEnvelope<TagBody>(response.json()).data.id).toBe(firstTagId);

    // The catalogue was not duplicated and the link already existed.
    expect(await countAuditRows('tags', 'insert')).toBe(1);
    expect(await countAuditRows('customer_tags', 'insert')).toBe(1);
  });

  it('the detail response carries the attached label', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const detail = readEnvelope<DetailBody>(response.json()).data;

    expect(detail.tags.map((tag) => tag.id)).toContain(firstTagId);
  });

  it('PATCH attaches a second, existing label', async () => {
    if (app === null) return;

    const created = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ name: `${prefix}-vip` }),
    });

    expect(created.statusCode).toBe(201);
    secondTagId = readEnvelope<TagBody>(created.json()).data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ tagId: secondTagId }),
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<TagBody>(response.json()).data.id).toBe(secondTagId);
    expect(await countAuditRows('tags', 'insert')).toBe(2);
  });

  it('PATCH on an already attached label is a no-op', async () => {
    if (app === null) return;

    const before = await countAuditRows('customer_tags', 'insert');

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ tagId: firstTagId }),
    });

    expect(response.statusCode).toBe(200);
    expect(await countAuditRows('customer_tags', 'insert')).toBe(before);
  });

  it('PATCH answers 422 for a tag id that is not in the catalogue', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ tagId: randomUUID() }),
    });

    expect(response.statusCode).toBe(422);

    const error = readError(response.json()).error;

    expect(error.code).toBe('SEMANTIC_VALIDATION_FAILED');
    expect(error.details[0]?.path).toBe('tagId');
  });

  it('DELETE detaches the label and keeps the catalogue row', async () => {
    if (app === null) return;

    const detached = await countAuditRows('customer_tags', 'delete');

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/tags/${secondTagId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<null>(response.json()).data).toBeNull();
    expect(await countAuditRows('customer_tags', 'delete')).toBe(detached + 1);

    // The label survived: re-attaching it by name finds the same catalogue row.
    const reattached = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/tags`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ name: `${prefix}-vip` }),
    });

    expect(readEnvelope<TagBody>(reattached.json()).data.id).toBe(secondTagId);
    expect(await countAuditRows('tags', 'insert')).toBe(2);
  });

  it('DELETE of a link that does not exist is a 404', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/tags/${firstTagId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const repeat = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/tags/${firstTagId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(repeat.statusCode).toBe(404);
  });

  it('answers 400 for a malformed tag id', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/tags/not-a-uuid`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });
});
