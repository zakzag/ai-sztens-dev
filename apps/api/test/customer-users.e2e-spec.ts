import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { and, count, eq, like } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { DATABASE } from '../src/db/database.const.js';
import type { Database } from '../src/db/database.interface.js';
import { auditLogs, customers } from '../src/db/schema.js';
import { DATABASE_SKIP_REASON, probeDatabase } from './lib/database-gate.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * End-to-end coverage of the three customer-user endpoints (AIS-178, slice e).
 *
 * Three things here can only be proven against a real database:
 *
 * 1. the **global** e-mail index refuses the second invitation of an address;
 * 2. the **partial** owner index refuses a second **active** owner — and does so
 *    at activation, because a pending invitation is not a privilege (`E5`);
 * 3. revoking is limited to a pending invitation, and a referenced user answers
 *    `409` instead of breaking the contact/activity history.
 *
 * Hygiene matches the other `customers` e2e suites: unique `e2e-<uuid>` values,
 * business rows removed in `afterAll` (the customer cascade takes the users and
 * contacts with it), the append-only ledger untouched and tagged with a fixed user
 * agent.
 */

interface CustomerBody {
  readonly id: string;
}

interface CustomerUserBody {
  readonly id: string;
  readonly status: string;
  readonly invitedAt: string | null;
  readonly invitedByOperatorId: string | null;
  readonly updatedAt: string;
}

interface ContactBody {
  readonly id: string;
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
const AUDIT_TAG = 'customer-users-e2e/1.0 (AIS-178 e)';

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

describe('CustomerUsersController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  const prefix = `e2e-${randomUUID()}`;

  let customerId = '';
  let activeOwner: CustomerUserBody | null = null;
  let activeOwnerId = '';
  let pendingOwnerId = '';

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
      // The ledger is append-only; the user and contact rows go with the customer.
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

  /** Invites one login user and returns its body. */
  async function invite(
    email: string,
    role: string,
  ): Promise<CustomerUserBody> {
    if (app === null) throw new Error('the app is not booted');

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/customer-users`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({ name: `${prefix} ${role}`, email, role }),
    });

    expect(response.statusCode).toBe(201);

    return readEnvelope<CustomerUserBody>(response.json()).data;
  }

  /** Activates one login user. */
  async function activate(user: CustomerUserBody): Promise<number> {
    if (app === null) throw new Error('the app is not booted');

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/customer-users/${user.id}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        status: 'active',
        updatedAt: user.updatedAt,
      }),
    });

    return response.statusCode;
  }

  it('creates the customer the users hang off', async () => {
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

  it('POST invites a user in the `invited` state and audits the insert', async () => {
    if (app === null) return;

    const user = await invite(`${prefix}-owner@example.com`, 'owner');

    expect(user.status).toBe('invited');
    expect(user.invitedAt).not.toBeNull();
    // No session exists yet, so the invitation cannot name an operator (E9).
    expect(user.invitedByOperatorId).toBeNull();

    activeOwner = user;
    activeOwnerId = user.id;
    expect(await countAuditRows('customer_users', 'insert')).toBe(1);
  });

  it('POST answers 409 CUSTOMER_USER_EMAIL_CONFLICT for a taken address', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/customer-users`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} duplicate`,
        email: `${prefix}-owner@example.com`,
      }),
    });

    expect(response.statusCode).toBe(409);

    const error = readError(response.json()).error;

    expect(error.code).toBe('CUSTOMER_USER_EMAIL_CONFLICT');
    expect(error.details[0]?.path).toBe('email');
  });

  it('PATCH activates the owner and audits the update', async () => {
    if (app === null) return;

    expect(activeOwner).not.toBeNull();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/customer-users/${activeOwnerId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        status: 'active',
        updatedAt: activeOwner?.updatedAt,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<CustomerUserBody>(response.json()).data.status).toBe(
      'active',
    );
    expect(await countAuditRows('customer_users', 'update')).toBe(1);
  });

  it('PATCH answers 409 CUSTOMER_OWNER_CONFLICT when a second owner is activated', async () => {
    if (app === null) return;

    const second = await invite(`${prefix}-owner2@example.com`, 'owner');

    pendingOwnerId = second.id;
    expect(second.status).toBe('invited');

    expect(await activate(second)).toBe(409);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(detail.statusCode).toBe(200);
  });

  it('PATCH answers 409 STALE_WRITE for an outdated token', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/customer-users/${pendingOwnerId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} renamed`,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).error.code).toBe('STALE_WRITE');
  });

  it('DELETE answers 422 for a user that is not a pending invitation', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/customer-users/${activeOwnerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(422);
    expect(readError(response.json()).error.code).toBe(
      'SEMANTIC_VALIDATION_FAILED',
    );
  });

  it('DELETE answers 409 CUSTOMER_USER_IN_USE_CONFLICT for a referenced user', async () => {
    if (app === null) return;

    const linked = await invite(`${prefix}-linked@example.com`, 'member');

    const contact = await app.inject({
      method: 'POST',
      url: `/api/admin/customers/${customerId}/contacts`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: `${prefix} Linked Contact`,
        customerUserId: linked.id,
      }),
    });

    expect(contact.statusCode).toBe(201);
    expect(readEnvelope<ContactBody>(contact.json()).data.id).toMatch(
      /^[0-9a-f-]{36}$/,
    );

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/customer-users/${linked.id}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).error.code).toBe(
      'CUSTOMER_USER_IN_USE_CONFLICT',
    );
  });

  it('DELETE revokes a pending invitation and audits the delete', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/customer-users/${pendingOwnerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);
    expect(readEnvelope<null>(response.json()).data).toBeNull();
    expect(await countAuditRows('customer_users', 'delete')).toBe(1);

    const repeat = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/customer-users/${pendingOwnerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(repeat.statusCode).toBe(404);
  });

  it('answers 404 for an unknown user and 400 for a malformed id', async () => {
    if (app === null) return;

    const unknown = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/customer-users/${randomUUID()}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        name: 'x',
        updatedAt: new Date().toISOString(),
      }),
    });

    expect(unknown.statusCode).toBe(404);

    const malformed = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}/customer-users/not-a-uuid`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(malformed.statusCode).toBe(400);
  });
});
