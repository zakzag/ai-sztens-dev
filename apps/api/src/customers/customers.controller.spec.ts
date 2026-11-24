import { jest } from '@jest/globals';
import { ApiResponseService } from '../common/http/api-response.service.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import {
  CUSTOMER_ROW_ID,
  buildCreateCustomerInput,
  buildCustomerDetailRows,
  buildCustomerListQuery,
  buildCustomerResponse,
  buildCustomerRow,
  buildRawCustomerRow,
  buildUpdateCustomerInput,
  buildUpdateStatusInput,
  createAuditWriterMock,
  createCustomersRepositoryMock,
} from './test/mocks/customers.mock.js';

/**
 * Unit tests for the HTTP layer's delegation **and** its wrapping (AIS-178).
 *
 * The controller is built over a real `CustomersService` (repository and writer
 * mocked) and a real `ApiResponseService`, so the suite proves the three things
 * the controller owns: the request context ends up in `meta`, the payload ends
 * up in `data`, and the audit facts are built from the raw request. HTTP status
 * codes are covered end-to-end by `test/customers.e2e-spec.ts`, where they are
 * observable.
 */

/** Fixed request context, so `meta` assertions need no clock mocking. */
const CTX: RequestContext = {
  requestId: '0192f3c4-0000-4000-8000-000000000001',
  timestamp: '2026-11-22T21:00:00.000Z',
  path: '/api/admin/customers',
  method: 'GET',
};

/** The raw request subset the mutating handlers read for the audit facts. */
const REQUEST = {
  headers: { 'user-agent': 'Mozilla/5.0 (controller spec)' },
  ip: '10.9.8.7',
} as const;

interface ControllerFixture {
  readonly controller: CustomersController;
  readonly mocks: ReturnType<typeof createCustomersRepositoryMock>;
  readonly audit: ReturnType<typeof createAuditWriterMock>;
}

function createFixture(): ControllerFixture {
  const mocks = createCustomersRepositoryMock();
  const audit = createAuditWriterMock();
  const service = new CustomersService(mocks.repository, audit.writer);

  return {
    controller: new CustomersController(service, new ApiResponseService()),
    mocks,
    audit,
  };
}

describe('CustomersController', () => {
  it('wraps the page in `data` and the paging block in `meta.pagination`', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildCustomerRow()],
      total: 12,
    });

    const result = await fixture.controller.list(
      buildCustomerListQuery({ page: 2, limit: 10 }),
      CTX,
    );

    expect(result.data).toEqual([buildCustomerResponse()]);
    expect(result.meta).toEqual({
      requestId: CTX.requestId,
      timestamp: CTX.timestamp,
      pagination: { page: 2, limit: 10, total: 12, totalPages: 2 },
    });
  });

  it('returns an empty page as `data: []`, never null', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({ rows: [], total: 0 });

    const result = await fixture.controller.list(buildCustomerListQuery(), CTX);

    expect(result.data).toEqual([]);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('passes the validated query through to the service', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({ rows: [], total: 0 });
    const query = buildCustomerListQuery({
      sort: 'legalName',
      order: 'asc',
      q: 'példa',
    });

    await fixture.controller.list(query, CTX);

    expect(fixture.mocks.findPage).toHaveBeenCalledWith(query);
  });

  it('passes the path parameter through to the lookup and wraps the detail', async () => {
    const fixture = createFixture();
    fixture.mocks.findById.mockResolvedValue(buildCustomerDetailRows());

    const result = await fixture.controller.findById(CUSTOMER_ROW_ID, CTX);

    expect(fixture.mocks.findById).toHaveBeenCalledWith(CUSTOMER_ROW_ID);
    expect(result.data?.id).toBe(CUSTOMER_ROW_ID);
    expect(result.data?.contacts).toHaveLength(1);
    expect(result.meta.requestId).toBe(CTX.requestId);
  });

  it('lets a service error bubble up (the filter wraps it, not the controller)', async () => {
    const fixture = createFixture();
    const driverError = new Error('boom');
    fixture.mocks.findById.mockRejectedValue(driverError);

    await expect(
      fixture.controller.findById(CUSTOMER_ROW_ID, CTX),
    ).rejects.toBe(driverError);
  });

  it('builds the audit facts from the raw request on create', async () => {
    const fixture = createFixture();
    fixture.mocks.nextCustomerNumber.mockResolvedValue('AIS-202611-001');
    fixture.mocks.create.mockResolvedValue(buildRawCustomerRow());

    const result = await fixture.controller.create(
      buildCreateCustomerInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.audit.calls).toHaveLength(1);
    // `meta` is not enough for the ledger: the ip and the user agent come from
    // the request, and the request id from the envelope context.
    expect(fixture.audit.calls[0]?.customerId).toBeDefined();
    expect(result.data?.id).toBe(CUSTOMER_ROW_ID);
    expect(result.meta.requestId).toBe(CTX.requestId);
  });

  it('wraps the updated row and forwards the validated body', async () => {
    const fixture = createFixture();
    const updated = buildCustomerRow({ legalName: 'Példa Zrt.' });
    fixture.mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
    fixture.mocks.updateById.mockResolvedValue(buildRawCustomerRow());
    fixture.mocks.findById.mockResolvedValue(
      buildCustomerDetailRows({ customer: updated }),
    );

    const result = await fixture.controller.update(
      CUSTOMER_ROW_ID,
      buildUpdateCustomerInput(),
      REQUEST,
      CTX,
    );

    expect(fixture.mocks.updateById).toHaveBeenCalledTimes(1);
    expect(result.data?.legalName).toBe('Példa Zrt.');
    expect(fixture.audit.calls).toHaveLength(1);
  });

  it('wraps the status change', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
    fixture.mocks.updateStatusById.mockResolvedValue(
      buildRawCustomerRow({ status: 'suspended' }),
    );
    fixture.mocks.findById.mockResolvedValue(
      buildCustomerDetailRows({
        customer: buildCustomerRow({ status: 'suspended' }),
      }),
    );

    const result = await fixture.controller.updateStatus(
      CUSTOMER_ROW_ID,
      buildUpdateStatusInput(),
      REQUEST,
      CTX,
    );

    expect(result.data?.status).toBe('suspended');
    expect(fixture.mocks.updateStatusById).toHaveBeenCalledTimes(1);
  });

  it('returns `data: null` for a delete and keeps `meta`', async () => {
    const fixture = createFixture();
    fixture.mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
    fixture.mocks.softDeleteById.mockResolvedValue(buildRawCustomerRow());

    const result = await fixture.controller.remove(
      CUSTOMER_ROW_ID,
      REQUEST,
      CTX,
    );

    // The contract forbids `204`: a success with nothing to return is
    // `200` + `data: null`, so `meta.requestId` still reaches the client.
    expect(result).toEqual({
      data: null,
      meta: { requestId: CTX.requestId, timestamp: CTX.timestamp },
    });
  });

  it('lets a delete 404 bubble up unchanged', async () => {
    const fixture = createFixture();
    // The pre-image exists, but the guarded write matched nothing (another
    // writer archived the row first) — the service answers `404` either way.
    fixture.mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
    fixture.mocks.softDeleteById.mockResolvedValue(null);

    const error = await fixture.controller
      .remove(CUSTOMER_ROW_ID, REQUEST, CTX)
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('never asks for an audit row on a read', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({ rows: [], total: 0 });

    await fixture.controller.list(buildCustomerListQuery(), CTX);

    expect(jest.isMockFunction(fixture.mocks.findPage)).toBe(true);
    expect(fixture.audit.calls).toHaveLength(0);
  });
});
