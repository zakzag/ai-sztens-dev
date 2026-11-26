import {
  NotFoundAppError,
  SemanticValidationAppError,
} from '../common/http/app-error.js';
import { CustomerAuditLogsService } from './customers-audit-logs.service.js';
import {
  AUDIT_CUSTOMER_ID,
  buildAuditLogListQuery,
  buildAuditLogRowFixture,
  createCustomerAuditLogsRepositoryMock,
} from './test/mocks/customers-audit-logs.mock.js';

/**
 * Unit tests of the ledger read's orchestration (AIS-178, slice f).
 *
 * The service owns exactly three decisions: the parent guard (`404`), the
 * semantically impossible time window (`422`, `F8`), and the paging block. It owns
 * no write, so there is nothing else to assert — and the repository double has no
 * write method to call even by accident.
 */

/**
 * @returns the service under test plus its double.
 */
function createFixture(): {
  readonly service: CustomerAuditLogsService;
  readonly mocks: ReturnType<typeof createCustomerAuditLogsRepositoryMock>;
} {
  const mocks = createCustomerAuditLogsRepositoryMock();

  return { service: new CustomerAuditLogsService(mocks.repository), mocks };
}

describe('CustomerAuditLogsService', () => {
  it('rejects an unknown customer before reading the ledger', async () => {
    const fixture = createFixture();
    fixture.mocks.customerExists.mockResolvedValue(false);

    await expect(
      fixture.service.list(AUDIT_CUSTOMER_ID, buildAuditLogListQuery()),
    ).rejects.toBeInstanceOf(NotFoundAppError);
    expect(fixture.mocks.findPage).not.toHaveBeenCalled();
  });

  it('maps the page and builds the pagination block', async () => {
    const fixture = createFixture();
    fixture.mocks.findPage.mockResolvedValue({
      rows: [buildAuditLogRowFixture()],
      total: 21,
    });

    const result = await fixture.service.list(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({ page: 3, limit: 10 }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(41);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('passes the four filters to the repository unchanged', async () => {
    const fixture = createFixture();
    const query = buildAuditLogListQuery({
      tableName: 'customers',
      operation: 'update',
      actorId: '6b7c8d9e-0f1a-4b2c-8d3e-5f6a7b8c9d0e',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T23:59:59.000Z',
    });

    await fixture.service.list(AUDIT_CUSTOMER_ID, query);

    expect(fixture.mocks.findPage).toHaveBeenCalledWith(
      AUDIT_CUSTOMER_ID,
      query,
    );
  });

  it('answers 422 when the window ends before it starts', async () => {
    const fixture = createFixture();

    const error = await fixture.service
      .list(
        AUDIT_CUSTOMER_ID,
        buildAuditLogListQuery({
          from: '2026-11-30T00:00:00.000Z',
          to: '2026-11-01T00:00:00.000Z',
        }),
      )
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SemanticValidationAppError);
    expect((error as SemanticValidationAppError).details[0]?.path).toBe('from');
    expect(fixture.mocks.findPage).not.toHaveBeenCalled();
  });

  it('accepts a single-instant window', async () => {
    const fixture = createFixture();
    const instant = '2026-11-23T09:00:00.000Z';

    await expect(
      fixture.service.list(
        AUDIT_CUSTOMER_ID,
        buildAuditLogListQuery({ from: instant, to: instant }),
      ),
    ).resolves.toBeDefined();
  });

  it('accepts a window with only one bound', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.list(
        AUDIT_CUSTOMER_ID,
        buildAuditLogListQuery({ from: '2026-11-30T00:00:00.000Z' }),
      ),
    ).resolves.toBeDefined();
  });
});
