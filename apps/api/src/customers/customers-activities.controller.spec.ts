import type {
  AuditRequestFacts,
  AuditWriteInput,
} from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { CustomerActivitiesController } from './customers-activities.controller.js';
import { CustomerActivitiesService } from './customers-activities.service.js';
import {
  ACTIVITY_CREATED_AT,
  ACTIVITY_CUSTOMER_ID,
  ACTIVITY_ID,
  buildActivityListQuery,
  buildActivityRowFixture,
  buildCreateActivityInput,
  buildUpdateActivityInput,
  createAuditActorProviderMock,
  createCustomerActivitiesRepositoryMock,
} from './test/mocks/customers-activities.mock.js';

/**
 * Unit tests for the activity HTTP layer's delegation **and** its wrapping
 * (AIS-178, slice f).
 *
 * The controller is built over a real service (repository doubled) and a real
 * `ApiResponseService`, so the suite proves the three things the controller owns:
 * the context ends up in `meta`, the payload in `data`, and the audit facts are
 * built from the raw request. HTTP status codes are covered end-to-end by
 * `test/customer-activity.e2e-spec.ts`, where they are observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000005',
  timestamp: '2026-11-23T15:00:00.000Z',
  path: '/api/admin/customers/5c7e1b90/activities',
  method: 'POST',
};

/** The raw request subset the mutating handlers read for the audit facts. */
const REQUEST = {
  headers: { 'user-agent': 'Mozilla/5.0 (activities controller spec)' },
  ip: '10.9.8.7',
} as const;

/** One recorded ledger write, with the facts it was given. */
interface RecordedWrite {
  readonly input: AuditWriteInput;
  readonly facts: AuditRequestFacts;
}

interface ControllerFixture {
  readonly controller: CustomerActivitiesController;
  readonly mocks: ReturnType<typeof createCustomerActivitiesRepositoryMock>;
  readonly writes: RecordedWrite[];
}

/**
 * @returns the controller under test plus its doubles.
 */
function createFixture(): ControllerFixture {
  const mocks = createCustomerActivitiesRepositoryMock();
  const writes: RecordedWrite[] = [];
  const writer: AuditWriter = {
    write: (input, _tx, facts) => {
      writes.push({ input, facts });
      return Promise.resolve();
    },
  };
  const service = new CustomerActivitiesService(
    mocks.repository,
    writer,
    createAuditActorProviderMock().provider,
  );

  return {
    controller: new CustomerActivitiesController(
      service,
      new ApiResponseService(),
    ),
    mocks,
    writes,
  };
}

describe('CustomerActivitiesController', () => {
  it('wraps the feed in `data` and the pager in `meta.pagination`', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildActivityRowFixture()],
      total: 3,
    });

    const result = await fixture.controller.list(
      ACTIVITY_CUSTOMER_ID,
      buildActivityListQuery({ page: 1, limit: 2 }),
      CTX,
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      pagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
    });
  });

  it('passes the customer id and the body to the create', async () => {
    const fixture = createFixture();
    const input = buildCreateActivityInput({ metadata: { channel: 'phone' } });

    const result = await fixture.controller.create(
      ACTIVITY_CUSTOMER_ID,
      input,
      REQUEST,
      CTX,
    );

    expect(result.data.id).toBe(ACTIVITY_ID);
    expect(fixture.mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: ACTIVITY_CUSTOMER_ID,
        metadata: { channel: 'phone' },
      }),
    );
  });

  it('builds the audit facts from the raw request', async () => {
    const fixture = createFixture();

    await fixture.controller.create(
      ACTIVITY_CUSTOMER_ID,
      buildCreateActivityInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.writes[0]?.facts).toEqual({
      ipAddress: '10.9.8.7',
      userAgent: 'Mozilla/5.0 (activities controller spec)',
      requestId: CTX.requestId,
      source: 'admin_api',
    });
  });

  it('passes both ids to the update', async () => {
    const fixture = createFixture();

    await fixture.controller.update(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      buildUpdateActivityInput({
        body: 'Edited.',
        updatedAt: ACTIVITY_CREATED_AT.toISOString(),
      }),
      REQUEST,
      CTX,
    );

    expect(fixture.mocks.updateById).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      { body: 'Edited.' },
      ACTIVITY_CREATED_AT,
      expect.any(Date),
    );
    expect(fixture.writes[0]?.input.operation).toBe('update');
  });

  it('answers `data: null` for a delete', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.remove(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      REQUEST,
      CTX,
    );

    expect(result.data).toBeNull();
    expect(fixture.mocks.softDeleteById).toHaveBeenCalledWith(
      expect.anything(),
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      expect.any(Date),
    );
    expect(fixture.writes[0]?.input).toEqual(
      expect.objectContaining({ operation: 'soft_delete' }),
    );
  });

  it('keeps `meta.requestId` on every answer', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.remove(
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      REQUEST,
      CTX,
    );

    expect(result.meta.requestId).toBe(CTX.requestId);
  });
});
