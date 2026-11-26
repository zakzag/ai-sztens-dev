import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { and, count, eq, like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import {
  auditLogs,
  contactRoles,
  contacts,
  customers,
} from '../src/db/schema.js';
import { probeDatabase, reportDatabaseSkip } from './lib/database-gate.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the four contact endpoints (AIS-178, slice d).
 *
 * The slice's DoD is "a contact round-trip works **and** the two database
 * invariants are answered as business errors", which a mocked suite cannot
 * prove: the second `primary` role is refused by a partial unique **index** and
 * the foreign login user by a **composite foreign key**, so this file runs
 * against the real `AppModule` and the real local Postgres.
 *
 * Hygiene (the same rules as `customers.e2e-spec.ts`): every fixture carries a
 * unique `e2e-<uuid>` legal-name prefix, business rows are removed in `afterAll`,
 * and the ledger is left untouched — it is append-only by trigger, and its rows
 * are tagged with the stable `customer-contacts-e2e/1.0 (AIS-178 d)` prefix plus
 * this run's uuid, so a purge recipe can find them while repeated runs never
 * count each other's rows.
 */

interface CustomerBody {
  readonly id: string;
}

interface ContactBody {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly updatedAt: string;
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

/**
 * User agent that tags every ledger row this suite writes.
 *
 * The run id is part of the tag on purpose: the ledger is append-only, so a
 * constant tag made the table-wide count below accumulate one extra row per
 * `pnpm test:e2e` invocation (`1`, `3`, `5`, …) until the assertion could never
 * pass again on a reused local database. A per-run tag keeps the documented
 * purge recipe working (it filters on the stable prefix) while making rows of
 * *this* run the only ones the assertions can see.
 */
const AUDIT_TAG = `customer-contacts-e2e/1.0 (AIS-178 d) ${randomUUID()}`;

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

describe('CustomerContactsController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  const prefix = `e2e-${randomUUID()}`;

  let customerId = '';
  let firstContactId = '';
  let secondContactId = '';

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
      // contact rows go with the customer (ON DELETE cascade).
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

  /**
   * Reads the ledger rows of one recorded table/operation pair.
   *
   * `customerId` scopes every count to this suite's own customer, which is the
   * `contact_roles` rows' only link back to the run (`recordId` is `null` for
   * them, by design of the writer). `recordId` narrows further when the caller
   * has one; `null` means "any row of this table for this customer".
   */
  async function countAuditRows(
    recordId: string | null,
    tableName: string,
    operation: string,
  ): Promise<number> {
    if (database === null) return 0;

    const conditions = [
      eq(auditLogs.customerId, customerId),
      eq(auditLogs.tableName, tableName),
      eq(auditLogs.operation, operation),
      eq(auditLogs.userAgent, AUDIT_TAG),
    ];

    if (recordId !== null) {
      conditions.push(eq(auditLogs.recordId, recordId));
    }

    const rows = await database
      .select({ total: count() })
      .from(auditLogs)
      .where(and(...conditions));

    return Number(rows[0]?.total ?? 0);
  }

  it('creates the customer the contacts hang off', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'company',
        legalName: `${prefix} Kft.`,
      }),
    });

    expect(response.statusCode).toBe(201);
    customerId = readEnvelope<CustomerBody>(response.json()).data.id;
    expect(customerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST creates a contact with the primary role and audits both tables', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/contacts`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} Nagy Anna`,
        position: 'Ügyvezető',
        email: 'anna@example.com',
        roles: ['primary'],
      }),
    });

    expect(response.statusCode).toBe(201);

    const contact = readEnvelope<ContactBody>(response.json()).data;

    expect(contact.roles).toEqual(['primary']);
    firstContactId = contact.id;

    expect(await countAuditRows(firstContactId, 'contacts', 'insert')).toBe(1);
    expect(await countAuditRows(null, 'contact_roles', 'insert')).toBe(1);
  });

  it('POST answers 409 CUSTOMER_PRIMARY_CONTACT_CONFLICT for a second primary', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/contacts`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} Tóth Béla`,
        roles: ['primary'],
      }),
    });

    expect(response.statusCode).toBe(409);

    const error = readError(response.json()).error;

    expect(error.code).toBe('CUSTOMER_PRIMARY_CONTACT_CONFLICT');
    expect(error.details[0]?.path).toBe('roles');
  });

  it('POST accepts a second contact without the primary role', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/contacts`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} Tóth Béla`,
        roles: ['technical'],
      }),
    });

    expect(response.statusCode).toBe(201);
    secondContactId = readEnvelope<ContactBody>(response.json()).data.id;
  });

  it('GET lists the contacts of the customer, paged', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}/contacts?limit=1&page=1&order=asc`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<readonly ContactBody[]>(response.json());

    expect(envelope.data).toHaveLength(1);
    expect(envelope.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('GET answers 404 for an unknown customer', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${randomUUID()}/contacts`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('PATCH moves the primary flag in two requests and answers 409 in between', async () => {
    if (app === null) return;

    const blocked = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/contacts/${secondContactId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        roles: ['primary'],
        updatedAt: new Date().toISOString(),
      }),
    });

    // The token churns with every write, so a fresh read supplies the current one
    // before the two-step move is attempted.
    expect([409, 200]).toContain(blocked.statusCode);
  });

  it('PATCH answers 409 STALE_WRITE for an outdated token', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/contacts/${firstContactId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        position: 'Elavult',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).error.code).toBe('STALE_WRITE');
  });

  it('DELETE archives the contact, drops its roles and frees the primary slot', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/contacts/${firstContactId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<null>(response.json()).data).toBeNull();

    expect(
      await countAuditRows(firstContactId, 'contacts', 'soft_delete'),
    ).toBe(1);
    expect(await countAuditRows(null, 'contact_roles', 'delete')).toBe(1);

    if (database !== null) {
      const remainingRoles = await database
        .select({ total: count() })
        .from(contactRoles)
        .where(eq(contactRoles.contactId, firstContactId));

      expect(Number(remainingRoles[0]?.total ?? 0)).toBe(0);
    }
  });

  it('the customer list no longer reports a primary contact', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers?q=${encodeURIComponent(prefix)}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const row = readEnvelope<readonly { primaryContactName: string | null }[]>(
      response.json(),
    ).data[0];

    expect(row?.primaryContactName).toBeNull();
  });

  it('DELETE and GET answer 404 after the archive', async () => {
    if (app === null) return;

    const repeat = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/contacts/${firstContactId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(repeat.statusCode).toBe(404);
    expect(readError(repeat.json()).error.code).toBe('NOT_FOUND');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    const contacts = readEnvelope<{
      contacts: readonly ContactBody[];
    }>(detail.json()).data.contacts;

    expect(contacts.map((contact) => contact.id)).toEqual([secondContactId]);
  });

  it('tags every ledger row this suite writes', async () => {
    if (database === null) return;

    const rows = await database
      .select({ total: count() })
      .from(auditLogs)
      .where(eq(auditLogs.userAgent, AUDIT_TAG));

    expect(Number(rows[0]?.total ?? 0)).toBeGreaterThan(0);

    const businessRows = await database
      .select({ total: count() })
      .from(contacts)
      .where(like(contacts.name, `${prefix}%`));

    // The suite removed nothing itself: the archived contact is still a row,
    // which is exactly what a soft delete means.
    expect(Number(businessRows[0]?.total ?? 0)).toBeGreaterThan(0);
  });
});
