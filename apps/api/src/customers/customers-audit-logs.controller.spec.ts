import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { CustomerAuditLogsController } from './customers-audit-logs.controller.js';
import { CustomerAuditLogsService } from './customers-audit-logs.service.js';
import {
  AUDIT_CUSTOMER_ID,
  buildAuditLogListQuery,
  buildAuditLogRowFixture,
  createCustomerAuditLogsRepositoryMock,
} from './test/mocks/customers-audit-logs.mock.js';

/**
 * Unit tests for the ledger read's HTTP layer (AIS-178, slice f).
 *
 * One route, so the suite proves two things only: the page is wrapped in `data`
 * with the pager in `meta.pagination`, and the validated query reaches the
 * service unchanged. The `404`/`422` answers are covered by the service spec and
 * by `test/customer-audit-logs.e2e-spec.ts`, where they are observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000006',
  timestamp: '2026-11-23T15:00:00.000Z',
  path: '/api/admin/customers/3f4a5b6c/audit-logs',
  method: 'GET',
};

interface ControllerFixture {
  readonly controller: CustomerAuditLogsController;
  readonly mocks: ReturnType<typeof createCustomerAuditLogsRepositoryMock>;
}

/**
 * @returns the controller under test plus its doubles.
 */
function createFixture(): ControllerFixture {
  const mocks = createCustomerAuditLogsRepositoryMock();
  const service = new CustomerAuditLogsService(mocks.repository);

  return {
    controller: new CustomerAuditLogsController(
      service,
      new ApiResponseService(),
    ),
    mocks,
  };
}

describe('CustomerAuditLogsController', () => {
  it('wraps the page in `data` and the pager in `meta.pagination`', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildAuditLogRowFixture(), buildAuditLogRowFixture({ id: 40 })],
      total: 2,
    });

    const result = await fixture.controller.list(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({ page: 1, limit: 20 }),
      CTX,
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it('passes the customer id and the validated query to the service', async () => {
    const fixture = createFixture();
    const query = buildAuditLogListQuery({
      tableName: 'activities',
      operation: 'soft_delete',
    });

    await fixture.controller.list(AUDIT_CUSTOMER_ID, query, CTX);

    expect(fixture.mocks.findPage).toHaveBeenCalledWith(
      AUDIT_CUSTOMER_ID,
      query,
    );
  });

  it('keeps `meta.requestId` on the answer', async () => {
    const fixture = createFixture();

    const result = await fixture.controller.list(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery(),
      CTX,
    );

    expect(result.meta.requestId).toBe(CTX.requestId);
  });
});
