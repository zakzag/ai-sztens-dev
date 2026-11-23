import {
  readSqlColumnNames,
  readSqlExpression,
} from '../db/test/helpers/sql-expression.js';
import { ActivityRowMissingError } from './customers-activities.errors.js';
import { DrizzleCustomerActivitiesRepository } from './customers-activities.repository.js';
import {
  ACTIVITY_CREATED_AT,
  ACTIVITY_CUSTOMER_ID,
  ACTIVITY_EDITED_AT,
  ACTIVITY_ID,
  SECOND_ACTIVITY_ID,
  buildActivityListQuery,
  buildActivityRowFixture,
  createActivitiesDatabaseMock,
  type ActivitiesDatabaseMockOptions,
} from './test/mocks/customers-activities.mock.js';

/**
 * Unit tests of the activity persistence (AIS-178, slice f).
 *
 * The `Database` is doubled (no socket) and the assertions are **contract level**:
 * which rows the page and the count share, which columns the guard compares, and
 * whether the explicit `updated_at` write happens. The Drizzle internals are never
 * asserted directly — `readSqlExpression` / `readSqlColumnNames` are the one place
 * that inspects them.
 */

/**
 * @param options - scripted rows/errors for the double.
 * @returns the repository under test plus its double.
 */
function createRepository(options: ActivitiesDatabaseMockOptions = {}): {
  readonly repository: DrizzleCustomerActivitiesRepository;
  readonly mock: ReturnType<typeof createActivitiesDatabaseMock>;
} {
  const mock = createActivitiesDatabaseMock(options);

  return {
    repository: new DrizzleCustomerActivitiesRepository(mock.db),
    mock,
  };
}

describe('DrizzleCustomerActivitiesRepository — reads', () => {
  it('reports a live customer', async () => {
    const { repository } = createRepository({
      customerRows: [{ id: ACTIVITY_CUSTOMER_ID }],
    });

    await expect(repository.customerExists(ACTIVITY_CUSTOMER_ID)).resolves.toBe(
      true,
    );
  });

  it('reports an unknown customer', async () => {
    const { repository } = createRepository({ customerRows: [] });

    await expect(repository.customerExists(ACTIVITY_CUSTOMER_ID)).resolves.toBe(
      false,
    );
  });

  it('reads a page and its total from one expression', async () => {
    const older = buildActivityRowFixture();
    const newer = buildActivityRowFixture({
      id: SECOND_ACTIVITY_ID,
      createdAt: ACTIVITY_EDITED_AT,
    });
    const { repository, mock } = createRepository({
      activityRows: [newer, older],
      total: 12,
    });

    const page = await repository.findPage(
      ACTIVITY_CUSTOMER_ID,
      buildActivityListQuery({ page: 2, limit: 2 }),
    );

    expect(page.total).toBe(12);
    expect(page.rows).toEqual([newer, older]);
    // The count and the page query must filter with the *same* expression, or
    // `meta.pagination.total` could count rows the page does not show.
    expect(mock.selectExpressions).toHaveLength(2);
    expect(mock.selectExpressions[0]).toBe(mock.selectExpressions[1]);
  });

  it('scopes the feed to the customer and to live rows', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(ACTIVITY_CUSTOMER_ID, buildActivityListQuery());

    const columns = readSqlColumnNames(mock.selectExpressions[0]);

    expect(columns).toContain('customer_id');
    expect(columns).toContain('deleted_at');
  });

  it('orders by created_at with the id tie-breaker, newest first by default', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      ACTIVITY_CUSTOMER_ID,
      buildActivityListQuery({ order: 'desc' }),
    );

    const [timeDirection, idDirection] = mock.orderByArguments[0] ?? [];

    expect(readSqlExpression(timeDirection)).toBe('desc');
    expect(readSqlColumnNames(timeDirection)).toEqual(['created_at']);
    expect(readSqlColumnNames(idDirection)).toEqual(['id']);
  });

  it('honours order=asc on the feed', async () => {
    const { repository, mock } = createRepository();

    await repository.findPage(
      ACTIVITY_CUSTOMER_ID,
      buildActivityListQuery({ order: 'asc' }),
    );

    const [timeDirection] = mock.orderByArguments[0] ?? [];

    expect(readSqlExpression(timeDirection)).toBe('asc');
  });

  it('reads one entry even when it is archived', async () => {
    const archived = buildActivityRowFixture({ deletedAt: ACTIVITY_EDITED_AT });
    const { repository, mock } = createRepository({
      activityRows: [archived],
    });

    await expect(
      repository.findAnyById(ACTIVITY_CUSTOMER_ID, ACTIVITY_ID),
    ).resolves.toEqual(archived);
    // No soft-delete branch: this read exists to tell "absent" from "archived".
    expect(readSqlColumnNames(mock.selectExpressions[0])).not.toContain(
      'deleted_at',
    );
  });

  it('answers null for an entry of another customer', async () => {
    const { repository } = createRepository({ activityRows: [] });

    await expect(
      repository.findAnyById(ACTIVITY_CUSTOMER_ID, ACTIVITY_ID),
    ).resolves.toBeNull();
  });
});

describe('DrizzleCustomerActivitiesRepository — create', () => {
  it('inserts the mapped payload and returns the stored row', async () => {
    const stored = buildActivityRowFixture();
    const { repository, mock } = createRepository({ insertedRows: [stored] });
    const input = {
      customerId: ACTIVITY_CUSTOMER_ID,
      type: 'note' as const,
      body: 'Called the owner.',
      authorType: 'system' as const,
      operatorId: null,
      customerUserId: null,
      authorName: 'system',
      metadata: null,
    };

    await expect(repository.create(mock.tx, input)).resolves.toEqual(stored);
    expect(mock.insertedValues).toEqual([input]);
  });

  it('fails loudly when RETURNING yields no row', async () => {
    const { repository, mock } = createRepository({ insertedRows: [] });

    await expect(
      repository.create(mock.tx, {
        customerId: ACTIVITY_CUSTOMER_ID,
        type: 'note',
        body: 'Called the owner.',
        authorType: 'system',
        operatorId: null,
        customerUserId: null,
        authorName: 'system',
      }),
    ).rejects.toBeInstanceOf(ActivityRowMissingError);
  });

  it('rethrows any driver failure untouched', async () => {
    const driverError = new Error('permission denied for table activities');
    const { repository, mock } = createRepository({
      insertError: driverError,
    });

    await expect(
      repository.create(mock.tx, {
        customerId: ACTIVITY_CUSTOMER_ID,
        type: 'note',
        body: 'Called the owner.',
        authorType: 'system',
        operatorId: null,
        customerUserId: null,
        authorName: 'system',
      }),
    ).rejects.toBe(driverError);
  });
});

describe('DrizzleCustomerActivitiesRepository — guarded writes', () => {
  it('writes the patch together with the new updated_at', async () => {
    const stored = buildActivityRowFixture({ updatedAt: ACTIVITY_EDITED_AT });
    const { repository, mock } = createRepository({ updatedRows: [stored] });

    await expect(
      repository.updateById(
        mock.tx,
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        { body: 'Edited.' },
        ACTIVITY_CREATED_AT,
        ACTIVITY_EDITED_AT,
      ),
    ).resolves.toEqual(stored);
    // `activities.updated_at` has no `$onUpdate`: a patch that skipped it would
    // freeze the concurrency token forever (`P9`).
    expect(mock.updatePatches).toEqual([
      { body: 'Edited.', updatedAt: ACTIVITY_EDITED_AT },
    ]);
  });

  it('guards on the last write instant, not on the nullable column', async () => {
    const { repository, mock } = createRepository();

    await repository.updateById(
      mock.tx,
      ACTIVITY_CUSTOMER_ID,
      ACTIVITY_ID,
      { body: 'Edited.' },
      ACTIVITY_CREATED_AT,
      ACTIVITY_EDITED_AT,
    );

    const guard = String(readSqlExpression(mock.updateExpressions[0]));
    const columns = readSqlColumnNames(mock.updateExpressions[0]);

    expect(guard).toContain('coalesce');
    expect(columns).toContain('updated_at');
    expect(columns).toContain('created_at');
    expect(columns).toContain('deleted_at');
    expect(columns).toContain('customer_id');
  });

  it('answers null when the guard matched no row', async () => {
    const { repository, mock } = createRepository({ updatedRows: [] });

    await expect(
      repository.updateById(
        mock.tx,
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        { body: 'Edited.' },
        ACTIVITY_CREATED_AT,
        ACTIVITY_EDITED_AT,
      ),
    ).resolves.toBeNull();
  });

  it('hides a live entry by setting deleted_at only', async () => {
    const stored = buildActivityRowFixture({ deletedAt: ACTIVITY_EDITED_AT });
    const { repository, mock } = createRepository({ deletedRows: [stored] });

    await expect(
      repository.softDeleteById(
        mock.tx,
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        ACTIVITY_EDITED_AT,
      ),
    ).resolves.toEqual(stored);
    expect(mock.updatePatches).toEqual([{ deletedAt: ACTIVITY_EDITED_AT }]);
    expect(readSqlColumnNames(mock.updateExpressions[0])).toContain(
      'deleted_at',
    );
  });

  it('answers null on a repeat delete', async () => {
    const { repository, mock } = createRepository({ deletedRows: [] });

    await expect(
      repository.softDeleteById(
        mock.tx,
        ACTIVITY_CUSTOMER_ID,
        ACTIVITY_ID,
        ACTIVITY_EDITED_AT,
      ),
    ).resolves.toBeNull();
  });

  it('runs the unit of work inside one transaction', async () => {
    const { repository, mock } = createRepository();

    await expect(
      repository.runInTransaction(() => Promise.resolve('committed')),
    ).resolves.toBe('committed');
    expect(mock.tx).toBeDefined();
  });
});
