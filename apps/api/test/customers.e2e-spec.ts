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
 * End-to-end coverage of the six `customers` endpoints (AIS-178).
 *
 * The story's DoD is “the row is persisted **and** the response follows the
 * contract **and** every mutation leaves exactly one audit row”, which a mocked
 * suite cannot prove, so this file runs against the **real** `AppModule` and the
 * **real** local Postgres (`DATABASE_URL` from `apps/api/.env.local` / the dev
 * stack).
 *
 * Hygiene (plan `F10`):
 *
 * - every fixture carries a unique `e2e-<uuid>` legal-name prefix, so the suite
 *   never depends on what else is in the table, and it removes its own business
 *   rows in `afterAll`;
 * - the ledger rows are **kept** — `audit.audit_logs` is append-only (trigger in
 *   migration `0007`), so a `DELETE` would fail the run. They are tagged with a
 *   fixed user agent, which is what a future purge recipe can filter on.
 *
 * Two environment caveats, both loud instead of silent: `AppModule` pulls in the
 * CommonJS-only `@nestjs/config` (self-skip below Node 24.9, see
 * `test/lib/app-module-gate.ts`) and the suite needs a reachable Postgres
 * (`test/lib/database-gate.ts`).
 */

interface CustomerBody {
  readonly id: string;
  readonly customerNumber: string;
  readonly type: string;
  readonly legalName: string;
  readonly taxNumber: string | null;
  readonly status: string;
  readonly statusChangedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastActivityAt: string | null;
  readonly hasMissingData: boolean;
  readonly primaryContactName: string | null;
}

interface CustomerDetailBody extends CustomerBody {
  readonly tags: readonly unknown[];
  readonly contacts: readonly unknown[];
  readonly customerUsers: readonly unknown[];
}

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

interface ErrorEnvelopeBody {
  readonly error: {
    readonly code: string;
    readonly status: number;
    readonly message: string;
    readonly details: readonly { readonly path: string }[];
    readonly requestId: string;
  };
}

/** User agent that tags every ledger row this suite writes. */
const AUDIT_TAG = 'customers-e2e/1.0 (AIS-178)';

/** Weights of the Hungarian tax-number check digit (AIS-112). */
const TAX_NUMBER_CHECK_DIGIT_WEIGHTS = [9, 7, 3, 1, 9, 7, 3] as const;

/** Matches the generated `AIS-YYYYMM-NNN` customer number. */
const CUSTOMER_NUMBER_PATTERN = /^AIS-\d{6}-\d{3}$/;

/**
 * Builds a checksum-valid Hungarian tax number, so the suite never collides with
 * a fixture another run left behind.
 *
 * @param seed - any number; only its last seven digits are used.
 * @returns a number of the form `XXXXXXXX-Y-ZZ`.
 */
function toValidTaxNumber(seed: number): string {
  const digits = String(seed).padStart(7, '0').slice(-7);

  const weighted = [...digits].reduce(
    (sum, digit, index) =>
      sum + Number(digit) * (TAX_NUMBER_CHECK_DIGIT_WEIGHTS[index] ?? 0),
    0,
  );
  const checkDigit = (10 - (weighted % 10)) % 10;

  return `${digits}${checkDigit}-2-44`;
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
    createFastifyAdapter(),
  );
  // Mirror src/main.ts: the Zod pipes live on the routes, the envelope filter
  // comes from the real `HttpModule`.
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  await app.init();
  return app;
}

describe('CustomersController (e2e)', () => {
  let app: NestFastifyApplication | null = null;
  let database: Database | null = null;

  /** Unique name prefix, so the suite is independent of existing rows. */
  const prefix = `e2e-${randomUUID()}`;

  /** Tax number of the main fixture (unique per run). */
  const taxNumber = toValidTaxNumber(
    Number.parseInt(randomUUID().replace(/\D/g, '').slice(0, 7), 10) || 424242,
  );

  // State carried between the ordered tests (they form one scenario).
  let customerId = '';
  let createdUpdatedAt = '';

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
      // Business rows only: the ledger is append-only, so `audit.audit_logs` is
      // deliberately left untouched (it is tagged by the user agent instead).
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

  /** Reads the ledger rows of one record. */
  async function countAuditRows(recordId: string): Promise<number> {
    if (database === null) return 0;

    const rows = await database
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.recordId, recordId),
          eq(auditLogs.tableName, 'customers'),
        ),
      );

    return Number(rows[0]?.total ?? 0);
  }

  it('POST /api/admin/customers creates a customer with a server number and one audit row', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'company',
        legalName: `${prefix} Kft.`,
        taxNumber,
        registeredAddressZip: '1051',
        registeredAddressCity: 'Budapest',
      }),
    });

    expect(response.statusCode).toBe(201);

    const envelope = readEnvelope<CustomerBody>(response.json());

    expect(envelope.data.legalName).toBe(`${prefix} Kft.`);
    expect(envelope.data.customerNumber).toMatch(CUSTOMER_NUMBER_PATTERN);
    // `status` defaults to the published `prospect` value (plan `D3`).
    expect(envelope.data.status).toBe('prospect');
    expect(envelope.data.hasMissingData).toBe(false);
    // No contacts yet, so the derived column is `null`.
    expect(envelope.data.primaryContactName).toBeNull();
    expect(envelope.data.lastActivityAt).toBeNull();
    expect(Date.parse(envelope.data.statusChangedAt)).toBe(
      Date.parse(envelope.data.createdAt),
    );

    customerId = envelope.data.id;
    createdUpdatedAt = envelope.data.updatedAt;

    expect(await countAuditRows(customerId)).toBe(1);
  });

  it('POST stores the derived missing-data flag for a minimal customer', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'sole_proprietor',
        legalName: `${prefix} Egyéni`,
      }),
    });

    expect(response.statusCode).toBe(201);

    const envelope = readEnvelope<CustomerBody>(response.json());

    expect(envelope.data.taxNumber).toBeNull();
    expect(envelope.data.hasMissingData).toBe(true);
  });

  it('GET /api/admin/customers searches by name and paginates', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers?q=${encodeURIComponent(prefix)}&limit=1&page=1`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<readonly CustomerBody[]>(response.json());

    expect(envelope.data).toHaveLength(1);
    expect(envelope.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('GET /api/admin/customers applies the status filter', async () => {
    if (app === null) return;

    const prospects = await app.inject({
      method: 'GET',
      url: `/api/admin/customers?q=${encodeURIComponent(prefix)}&status=prospect`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(
      readEnvelope<readonly CustomerBody[]>(prospects.json()).data,
    ).toHaveLength(2);

    const actives = await app.inject({
      method: 'GET',
      url: `/api/admin/customers?q=${encodeURIComponent(prefix)}&status=active`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(
      readEnvelope<readonly CustomerBody[]>(actives.json()).data,
    ).toHaveLength(0);
  });

  it('GET /api/admin/customers/:id returns the detail with empty children', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<CustomerDetailBody>(response.json());

    expect(envelope.data.id).toBe(customerId);
    expect(envelope.data.tags).toEqual([]);
    expect(envelope.data.contacts).toEqual([]);
    expect(envelope.data.customerUsers).toEqual([]);
  });

  it('PATCH /api/admin/customers/:id updates the row and audits only the changed key', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        legalName: `${prefix} Zrt.`,
        updatedAt: createdUpdatedAt,
      }),
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<CustomerBody>(response.json());

    expect(envelope.data.legalName).toBe(`${prefix} Zrt.`);
    expect(envelope.data.updatedAt).not.toBe(createdUpdatedAt);

    expect(await countAuditRows(customerId)).toBe(2);

    const rows = await database
      ?.select({
        afterData: auditLogs.afterData,
        operation: auditLogs.operation,
      })
      .from(auditLogs)
      .where(eq(auditLogs.recordId, customerId));

    const update = rows?.find((row) => row.operation === 'update');

    expect(Object.keys(update?.afterData ?? {})).toEqual(['legalName']);
  });

  it('PATCH /api/admin/customers/:id/status writes statusChangedAt too', async () => {
    if (app === null) return;

    const before = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });
    const beforeBody = readEnvelope<CustomerBody>(before.json()).data;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}/status`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        status: 'active',
        updatedAt: beforeBody.updatedAt,
      }),
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<CustomerBody>(response.json());

    expect(envelope.data.status).toBe('active');
    expect(Date.parse(envelope.data.statusChangedAt)).toBeGreaterThanOrEqual(
      Date.parse(beforeBody.statusChangedAt),
    );

    expect(await countAuditRows(customerId)).toBe(3);
  });

  it('PATCH answers 409 STALE_WRITE for an outdated token', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        legalName: `${prefix} Elavult`,
        updatedAt: createdUpdatedAt,
      }),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).error.code).toBe('STALE_WRITE');

    // A rejected write must not reach the ledger.
    expect(await countAuditRows(customerId)).toBe(3);
  });

  it('POST answers 409 CUSTOMER_TAX_NUMBER_CONFLICT for a live duplicate', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'company',
        legalName: `${prefix} Duplikátum Kft.`,
        taxNumber,
      }),
    });

    expect(response.statusCode).toBe(409);

    const error = readError(response.json()).error;

    expect(error.code).toBe('CUSTOMER_TAX_NUMBER_CONFLICT');
    expect(error.details[0]?.path).toBe('taxNumber');
  });

  it('GET /api/admin/customers/:id answers 400 for a malformed uuid', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/customers/not-a-uuid',
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('DELETE /api/admin/customers/:id archives the row and audits the soft delete', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(response.statusCode).toBe(200);

    const envelope = readEnvelope<null>(response.json());

    expect(envelope.data).toBeNull();
    expect(envelope.meta.requestId.length).toBeGreaterThan(0);

    expect(await countAuditRows(customerId)).toBe(4);

    const rows = await database
      ?.select({ operation: auditLogs.operation })
      .from(auditLogs)
      .where(eq(auditLogs.recordId, customerId));

    expect(rows?.map((row) => row.operation).sort()).toEqual([
      'insert',
      'soft_delete',
      'update',
      'update',
    ]);
  });

  it('DELETE and GET answer 404 after the archive', async () => {
    if (app === null) return;

    const repeat = await app.inject({
      method: 'DELETE',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(repeat.statusCode).toBe(404);
    expect(readError(repeat.json()).error.code).toBe('NOT_FOUND');

    const read = await app.inject({
      method: 'GET',
      url: `/api/admin/customers/${customerId}`,
      headers: { 'user-agent': AUDIT_TAG },
    });

    expect(read.statusCode).toBe(404);
    // The repeat delete found nothing to hide, so it added no ledger row.
    expect(await countAuditRows(customerId)).toBe(4);
  });

  it('frees the tax number after the archive', async () => {
    if (app === null) return;

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/customers',
      headers: { 'content-type': 'application/json', 'user-agent': AUDIT_TAG },
      payload: JSON.stringify({
        type: 'company',
        legalName: `${prefix} Újrahasznosított Kft.`,
        taxNumber,
      }),
    });

    // `customers_tax_number_key` is partial on `deleted_at IS NULL`, so an
    // archived customer no longer blocks the number.
    expect(response.statusCode).toBe(201);
    expect(readEnvelope<CustomerBody>(response.json()).data.taxNumber).toBe(
      taxNumber,
    );
  });

  it('tags every ledger row this suite writes', async () => {
    if (app === null) return;

    const rows = await database
      ?.select({ userAgent: auditLogs.userAgent, source: auditLogs.source })
      .from(auditLogs)
      .where(eq(auditLogs.userAgent, AUDIT_TAG));

    // The tagged user agent is what a future purge recipe filters on, and
    // `admin_api` is the source the controller records.
    expect(rows?.length).toBeGreaterThan(0);
    expect(rows?.every((row) => row.source === 'admin_api')).toBe(true);
  });
});
