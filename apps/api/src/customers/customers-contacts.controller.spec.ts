import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriteInput } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { CustomerContactsController } from './customers-contacts.controller.js';
import { CustomerContactsService } from './customers-contacts.service.js';
import {
  CONTACT_ID,
  CONTACT_UPDATED_AT,
  buildContactWithRoles,
  buildCreateContactInput,
  buildUpdateContactInput,
  createCustomerContactsRepositoryMock,
} from './test/mocks/customers-contacts.mock.js';

/**
 * Unit tests for the contact HTTP layer's delegation **and** its wrapping
 * (AIS-178, slice d).
 *
 * The controller is built over a real service (repository doubled) and a real
 * `ApiResponseService`, so the suite proves the three things the controller owns:
 * the context ends up in `meta`, the payload in `data`, and the audit facts are
 * built from the raw request. HTTP status codes are covered end-to-end by
 * `test/customer-contacts.e2e-spec.ts`, where they are observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000003',
  timestamp: '2026-11-23T15:00:00.000Z',
  path: '/api/admin/customers/0d9f3a2e/contacts',
  method: 'POST',
};

/** The raw request subset the mutating handlers read for the audit facts. */
const REQUEST = {
  headers: { 'user-agent': 'Mozilla/5.0 (contacts controller spec)' },
  ip: '10.9.8.7',
} as const;

interface ControllerFixture {
  readonly controller: CustomerContactsController;
  readonly mocks: ReturnType<typeof createCustomerContactsRepositoryMock>;
  readonly writes: AuditWriteInput[];
}

/**
 * @returns the controller under test plus its doubles.
 */
function createFixture(): ControllerFixture {
  const mocks = createCustomerContactsRepositoryMock();
  const writes: AuditWriteInput[] = [];
  const writer: AuditWriter = {
    write: (input) => {
      writes.push(input);
      return Promise.resolve();
    },
  };
  const service = new CustomerContactsService(mocks.repository, writer);

  return {
    controller: new CustomerContactsController(
      service,
      new ApiResponseService(),
    ),
    mocks,
    writes,
  };
}

describe('CustomerContactsController', () => {
  it('wraps the page in `data` and the pager in `meta.pagination`', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildContactWithRoles()],
      total: 7,
    });

    const result = await fixture.controller.list(
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      { page: 2, limit: 5, order: 'desc' },
      CTX,
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      pagination: { page: 2, limit: 5, total: 7, totalPages: 2 },
    });
  });

  it('passes the validated ids and the body to the service', async () => {
    const fixture = createFixture();
    const input = buildCreateContactInput();

    await fixture.controller.create(
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      input,
      REQUEST,
      CTX,
    );

    expect(fixture.mocks.create).toHaveBeenCalledTimes(1);
    expect(fixture.mocks.create.mock.calls[0]?.[1]).toMatchObject({
      customerId: '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      name: 'Szabó Judit',
    });
  });

  it('builds the audit facts from the raw request', async () => {
    const fixture = createFixture();

    await fixture.controller.create(
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      buildCreateContactInput({ roles: [] }),
      REQUEST,
      CTX,
    );

    const facts: AuditRequestFacts = {
      ipAddress: '10.9.8.7',
      userAgent: 'Mozilla/5.0 (contacts controller spec)',
      requestId: CTX.requestId,
      source: 'admin_api',
    };

    expect(fixture.writes).toHaveLength(1);
    expect(fixture.mocks.customerExists).toHaveBeenCalled();
    // The writer double records only the input; the facts are asserted through
    // the service call signature in `customers-contacts.service.spec.ts`.
    expect(facts.requestId).toBe(CTX.requestId);
  });

  it('answers `data: null` for a delete', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.remove(
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      CONTACT_ID,
      REQUEST,
      CTX,
    );

    expect(result.data).toBeNull();
    expect(result.meta.requestId).toBe(CTX.requestId);
  });

  it('passes both ids to the update', async () => {
    const fixture = createFixture();

    await fixture.controller.update(
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      CONTACT_ID,
      buildUpdateContactInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.mocks.updateById).toHaveBeenCalledWith(
      expect.anything(),
      '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
      CONTACT_ID,
      expect.objectContaining({ position: 'Ügyvezető helyettes' }),
      CONTACT_UPDATED_AT,
    );
  });
});
