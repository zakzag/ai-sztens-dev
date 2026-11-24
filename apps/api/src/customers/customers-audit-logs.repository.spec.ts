import {
  readSqlColumnNames,
  readSqlExpression,
} from '../db/test/helpers/sql-expression.js';
import { DrizzleCustomerAuditLogsRepository } from './customers-audit-logs.repository.js';
import {
  AUDIT_CUSTOMER_ID,
  AUDIT_OCCURRED_AT,
  buildAuditLogListQuery,
  buildAuditLogRowFixture,
  createAuditLogsDatabaseMock,
  type AuditLogsDatabaseMockOptions,
} from './test/mocks/customers-audit-logs.mock.js';

/**
 * Unit tests of the ledger read (AIS-178, slice f).
 *
 * The double has no `insert`/`update`/`delete` at all, so a write added to the
 * repository fails here instead of passing silently (`F10`). The assertions are
 * contract level: which filters reach the `WHERE`, which columns the order uses,
 * and whether the page and the count share one expression.
 */

/**
 * @param options - scripted rows/errors for the double.
 * @returns the repository under test plus its double.
 */
function createRepository(options: AuditLogsDatabaseMockOptions = {}): {
  readonly repository: DrizzleCustomerAuditLogsRepository;
  readonly mock: ReturnType<typeof createAuditLogsDatabaseMock>;
} {
  const mock = createAuditLogsDatabaseMock(options);

  return {
    repository: new DrizzleCustomerAuditLogsRepository(mock.db),
    mock,
  };
}

describe('DrizzleCustomerAuditLogsRepository — parent probe', () => {
  it('reports a live customer', async () => {
    const { repository } = createRepository({
      customerRows: [{ id: AUDIT_CUSTOMER_ID }],
    });

    await expect(repository.customerExists(AUDIT_CUSTOMER_ID)).resolves.toBe(
      true,
    );
  });

  it('reports an unknown customer', async () => {
    const { repository } = createRepository({ customerRows: [] });

    await expect(repository.customerExists(AUDIT_CUSTOMER_ID)).resolves.toBe(
      false,
    );
  });
});

describe('DrizzleCustomerAuditLogsRepository — findPage', () => {
  it('reads the page and its total from one expression', async () => {
    const rows = [
      buildAuditLogRowFixture({ id: 43 }),
      buildAuditLogRowFixture({ id: 42 }),
    ];
    const { repository, mock } = createRepository({
      auditLogRows: rows,
      total: 9,
    });

    const page = await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery(),
    );

    expect(page.total).toBe(9);
    expect(page.rows).toEqual(rows);
    expect(mock.selectExpressions).toHaveLength(2);
    expect(mock.selectExpressions[0]).toBe(mock.selectExpressions[1]);
  });

  it('always scopes the read to the customer and never filters a soft delete', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(AUDIT_CUSTOMER_ID, buildAuditLogListQuery());

    const columns = readSqlColumnNames(mock.selectExpressions[0]);

    expect(columns).toContain('customer_id');
    // The ledger is append-only: it has no `deleted_at` column to filter on.
    expect(columns).not.toContain('deleted_at');
  });

  it('orders by occurred_at with the append-order tie-breaker', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({ order: 'desc' }),
    );

    const [timeDirection, idDirection] = mock.orderByArguments[0] ?? [];

    expect(readSqlColumnNames(timeDirection)).toEqual(['occurred_at']);
    expect(readSqlExpression(timeDirection)).toBe('desc');
    expect(readSqlColumnNames(idDirection)).toEqual(['id']);
    expect(readSqlExpression(idDirection)).toBe('desc');
  });

  it('follows the requested direction in the tie-breaker too', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({ order: 'asc' }),
    );

    const [timeDirection, idDirection] = mock.orderByArguments[0] ?? [];

    expect(readSqlExpression(timeDirection)).toBe('asc');
    expect(readSqlExpression(idDirection)).toBe('asc');
  });

  it('applies every filter the query carries', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({
        tableName: 'activities',
        operation: 'insert',
        actorId: '6b7c8d9e-0f1a-4b2c-8d3e-5f6a7b8c9d0e',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-30T23:59:59.000Z',
      }),
    );

    const columns = readSqlColumnNames(mock.selectExpressions[0]);

    expect(columns).toContain('customer_id');
    expect(columns).toContain('table_name');
    expect(columns).toContain('operation');
    expect(columns).toContain('actor_id');
    expect(columns).toContain('occurred_at');
  });

  it('drops every filter when the query carries none', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(AUDIT_CUSTOMER_ID, buildAuditLogListQuery());

    const columns = readSqlColumnNames(mock.selectExpressions[0]);

    expect(columns).toEqual(expect.arrayContaining(['customer_id']));
    expect(columns).not.toContain('table_name');
    expect(columns).not.toContain('operation');
    expect(columns).not.toContain('actor_id');
  });

  it('pages with the validated limit and offset', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery({ page: 3, limit: 10 }),
    );

    expect(mock.limitValues).toEqual([10, 20]);
  });

  it('propagates a driver failure untouched', async () => {
    const failure = new Error('permission denied for table audit_logs');
    const { repository } = createRepository({ selectError: failure });

    await expect(
      repository.findPage(AUDIT_CUSTOMER_ID, buildAuditLogListQuery()),
    ).rejects.toBe(failure);
  });

  it('reads the newest row first, whatever the clock says', async () => {
    const newest = buildAuditLogRowFixture({
      id: 44,
      occurredAt: AUDIT_OCCURRED_AT,
    });
    const { repository } = createRepository({ auditLogRows: [newest] });

    const page = await repository.findPage(
      AUDIT_CUSTOMER_ID,
      buildAuditLogListQuery(),
    );

    expect(page.rows[0]?.id).toBe(44);
  });
});
