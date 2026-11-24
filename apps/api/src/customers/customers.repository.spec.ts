import {
  readSqlColumnNames,
  readSqlExpression,
} from '../db/test/helpers/sql-expression.js';
import {
  PostgresErrorMock,
  wrapDrizzleQueryError,
} from '../db/test/mocks/postgres-error.mock.js';
import {
  CustomerNumberConflictError,
  CustomerRowMissingError,
  CustomerTaxNumberConflictError,
} from './customers.errors.js';
import {
  CUSTOMER_PROJECTION,
  DrizzleCustomersRepository,
} from './customers.repository.js';
import {
  CUSTOMER_DELETED_AT,
  CUSTOMER_UPDATED_AT,
  buildContactJoinRow,
  buildCustomerListQuery,
  buildCustomerRow,
  buildCustomerUserRow,
  buildRawCustomerRow,
  buildTagRow,
} from './test/mocks/customers.mock.js';
import { createCustomersDatabaseMock } from './test/mocks/database.mock.js';

/**
 * Unit tests for the Drizzle repository (AIS-178).
 *
 * The `Database` handle is mocked (see `test/mocks/database.mock.ts`), so these
 * tests never need `DATABASE_URL`, a running Postgres or a migrated table — the
 * real database behaviour (a duplicate actually rejected by the constraint, the
 * partial index freeing a tax number after a soft delete) is proven by
 * `test/customers.e2e-spec.ts`.
 *
 * Assertions stay at the contract level: which method was called with which
 * payload, which `WHERE` expression the two list queries share, and which error
 * is surfaced. Drizzle's internal call order is not part of the contract.
 */

/**
 * A derived column is only usable if every reference inside its correlated
 * subquery names its schema, table and column. Drizzle renders a bare column
 * name when the expression becomes a `select()` field, and
 * `customer.contacts` / `customer.contact_roles` share `customer_id`, so the
 * unqualified form made the whole list endpoint answer `500` with
 * `42702 ambiguous column reference` (AIS-14 R1).
 */
describe('CUSTOMER_PROJECTION', () => {
  it('qualifies every reference of the lastActivityAt subquery', () => {
    const expression = readSqlExpression(CUSTOMER_PROJECTION.lastActivityAt);

    expect(expression).toContain('"activity"."activities"."created_at"');
    expect(expression).toContain('"activity"."activities"."customer_id"');
    expect(expression).toContain('"customer"."customers"."id"');
  });

  it('qualifies every reference of the primaryContactName subquery', () => {
    // Table objects are not part of the rendered text, so the assertions cover
    // the column references — the ones that were ambiguous.
    const expression = readSqlExpression(
      CUSTOMER_PROJECTION.primaryContactName,
    );

    expect(expression).toContain('"customer"."contacts"."name"');
    expect(expression).toContain('"customer"."contacts"."customer_id"');
    expect(expression).toContain('"customer"."contact_roles"."contact_id"');
    expect(expression).toContain('"customer"."customers"."id"');
  });
});

describe('DrizzleCustomersRepository', () => {
  describe('findPage', () => {
    it('returns the page and the total from the count query', async () => {
      const rows = [buildCustomerRow()];
      const database = createCustomersDatabaseMock({
        customerRows: rows,
        total: 42,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.findPage(
        buildCustomerListQuery({ page: 3, limit: 10 }),
      );

      expect(result).toEqual({ rows, total: 42 });
      // One select for the count, one for the page itself.
      expect(database.select).toHaveBeenCalledTimes(2);
      expect(database.from).toHaveBeenCalledTimes(2);
      expect(database.limitArguments).toEqual([10]);
      expect(database.offsetArguments).toEqual([20]);
    });

    it('applies visibility and every filter to the count query too', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(buildCustomerListQuery({ q: 'példa' }));

      // The count chain is built first, the page second — and they MUST share
      // one expression object, otherwise `total` could count rows the page does
      // not show.
      expect(database.whereExpressions).toHaveLength(2);
      expect(database.whereExpressions[0]).toBe(database.whereExpressions[1]);
    });

    it('excludes soft-deleted rows even without a filter', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(buildCustomerListQuery());

      const [condition] = database.whereExpressions;

      expect(readSqlColumnNames(condition)).toContain('deleted_at');
      expect(readSqlExpression(condition)).toContain('is null');
    });

    it('searches legal name, tax number and customer number', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(buildCustomerListQuery({ q: 'példa' }));

      const [condition] = database.whereExpressions;

      expect(readSqlExpression(condition)).toContain('ilike');
      expect(readSqlColumnNames(condition)).toEqual(
        expect.arrayContaining(['legal_name', 'tax_number', 'customer_number']),
      );
    });

    it('applies each optional filter as an equality match', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(
        buildCustomerListQuery({
          type: 'company',
          status: 'active',
          source: 'website',
        }),
      );

      const columns = readSqlColumnNames(database.whereExpressions[1]);

      expect(columns).toEqual(
        expect.arrayContaining(['type', 'status', 'source']),
      );
    });

    it('orders by the requested column with the id tie-breaker', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(
        buildCustomerListQuery({ sort: 'legalName', order: 'asc' }),
      );

      // The count chain never orders; the page chain is the only entry.
      const [sortExpression, tieBreaker] = database.orderByArguments[0] ?? [];

      expect(readSqlExpression(sortExpression)).toContain('asc');
      expect(readSqlColumnNames(sortExpression)).toContain('legal_name');
      expect(readSqlColumnNames(tieBreaker)).toEqual(['id']);
    });

    it('sorts by created_at descending by default', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(buildCustomerListQuery());

      const [sortExpression] = database.orderByArguments[0] ?? [];

      expect(readSqlExpression(sortExpression)).toContain('desc');
      expect(readSqlColumnNames(sortExpression)).toContain('created_at');
    });

    it('sorts a derived lastActivityAt with NULLS LAST in both directions', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findPage(
        buildCustomerListQuery({ sort: 'lastActivityAt', order: 'desc' }),
      );

      const [descExpression] = database.orderByArguments[0] ?? [];
      const descSql = readSqlExpression(descExpression).toLowerCase();

      expect(descSql).toContain('desc');
      expect(descSql).toContain('nulls last');

      await repository.findPage(
        buildCustomerListQuery({ sort: 'lastActivityAt', order: 'asc' }),
      );

      const [ascExpression] = database.orderByArguments[1] ?? [];
      const ascSql = readSqlExpression(ascExpression).toLowerCase();

      expect(ascSql).toContain('asc');
      expect(ascSql).toContain('nulls last');
    });

    it('returns an empty page with a zero total when nothing matches', async () => {
      const database = createCustomersDatabaseMock({
        customerRows: [],
        total: 0,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.findPage(buildCustomerListQuery()),
      ).resolves.toEqual({ rows: [], total: 0 });
    });

    it('normalises a missing count row to zero', async () => {
      const database = createCustomersDatabaseMock();
      // A driver that returns no count row must not produce `NaN`.
      database.select.mockImplementationOnce(() => ({
        from: () => ({ where: () => Promise.resolve([]) }),
      }));
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.findPage(buildCustomerListQuery()),
      ).resolves.toMatchObject({ total: 0 });
    });

    it('propagates a page-query error unchanged', async () => {
      const driverError = new PostgresErrorMock('42P01');
      const database = createCustomersDatabaseMock({
        selectError: driverError,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.findPage(buildCustomerListQuery())).rejects.toBe(
        driverError,
      );
    });

    it('propagates a count-query error unchanged', async () => {
      const driverError = new PostgresErrorMock('57014');
      const database = createCustomersDatabaseMock({ countError: driverError });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.findPage(buildCustomerListQuery())).rejects.toBe(
        driverError,
      );
    });
  });

  describe('findById', () => {
    it('reads the parent and the three children', async () => {
      const customer = buildCustomerRow();
      const database = createCustomersDatabaseMock({
        customerRows: [customer],
        tagRows: [buildTagRow()],
        contactRows: [buildContactJoinRow()],
        customerUserRows: [buildCustomerUserRow()],
      });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.findById(customer.id);

      expect(result?.customer).toEqual(customer);
      expect(result?.tags).toHaveLength(1);
      expect(result?.contacts[0]?.roles).toEqual(['primary']);
      expect(result?.customerUsers).toHaveLength(1);
      // Parent + three children: four round trips, no per-row query.
      expect(database.from).toHaveBeenCalledTimes(4);
    });

    it('answers null for a soft-deleted or unknown id', async () => {
      const database = createCustomersDatabaseMock({ customerRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.findById('missing')).resolves.toBeNull();
    });

    it('filters the parent on id and visibility', async () => {
      const database = createCustomersDatabaseMock({ customerRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.findById('some-id');

      const [condition] = database.whereExpressions;

      expect(readSqlColumnNames(condition)).toEqual(
        expect.arrayContaining(['id', 'deleted_at']),
      );
    });

    it('answers a contact without roles with an empty list', async () => {
      const database = createCustomersDatabaseMock({
        customerRows: [buildCustomerRow()],
        contactRows: [buildContactJoinRow({ role: null })],
      });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.findById(buildCustomerRow().id);

      expect(result?.contacts[0]?.roles).toEqual([]);
    });
  });

  describe('findAnyById', () => {
    it('returns a row without the soft-delete filter', async () => {
      const row = buildRawCustomerRow();
      const database = createCustomersDatabaseMock({ rawRows: [row] });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.findAnyById(row.id);

      expect(result).toEqual(row);
      // The whole point of this read: it must see deleted rows too.
      expect(readSqlColumnNames(database.whereExpressions[0])).toEqual(['id']);
    });

    it('returns null when the row never existed', async () => {
      const database = createCustomersDatabaseMock({ rawRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.findAnyById('missing')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('inserts the payload and returns the persisted row', async () => {
      const row = buildRawCustomerRow();
      const database = createCustomersDatabaseMock({ insertedRows: [row] });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.create(database.tx, row);

      expect(result).toEqual(row);
      expect(database.insert).toHaveBeenCalledTimes(1);
      expect(database.values).toHaveBeenCalledWith(row);
      expect(database.returning).toHaveBeenCalledTimes(1);
    });

    it('maps a customer_number violation to the domain error', async () => {
      const row = buildRawCustomerRow();
      const database = createCustomersDatabaseMock({
        insertError: wrapDrizzleQueryError(
          new PostgresErrorMock('23505', 'customers_customer_number_key'),
        ),
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.create(database.tx, row)).rejects.toBeInstanceOf(
        CustomerNumberConflictError,
      );
    });

    it('maps a tax_number violation to the domain error', async () => {
      const row = buildRawCustomerRow();
      const database = createCustomersDatabaseMock({
        insertError: wrapDrizzleQueryError(
          new PostgresErrorMock('23505', 'customers_tax_number_key'),
        ),
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(repository.create(database.tx, row)).rejects.toMatchObject({
        name: 'CustomerTaxNumberConflictError',
        taxNumber: row.taxNumber,
      });
    });

    it('propagates a 23505 from another constraint unchanged', async () => {
      const driverError = wrapDrizzleQueryError(
        new PostgresErrorMock('23505', 'some_other_key'),
      );
      const database = createCustomersDatabaseMock({
        insertError: driverError,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.create(database.tx, buildRawCustomerRow()),
      ).rejects.toBe(driverError);
    });

    it('does not translate a tax conflict for a null tax number', async () => {
      const driverError = new PostgresErrorMock(
        '23505',
        'customers_tax_number_key',
      );
      const database = createCustomersDatabaseMock({
        insertError: driverError,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.create(
          database.tx,
          buildRawCustomerRow({ taxNumber: null }),
        ),
      ).rejects.toBe(driverError);
    });

    it('throws when the insert returns no row', async () => {
      const database = createCustomersDatabaseMock({ insertedRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.create(database.tx, buildRawCustomerRow()),
      ).rejects.toBeInstanceOf(CustomerRowMissingError);
    });
  });

  describe('updateById', () => {
    it('writes the patch with the guard and returns the row', async () => {
      const row = buildRawCustomerRow({ legalName: 'Új Név Kft.' });
      const database = createCustomersDatabaseMock({ updatedRows: [row] });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.updateById(
        database.tx,
        row.id,
        { legalName: 'Új Név Kft.' },
        CUSTOMER_UPDATED_AT,
      );

      expect(result).toEqual(row);
      expect(database.updateSetArguments).toEqual([
        { legalName: 'Új Név Kft.' },
      ]);

      const [condition] = database.updateWhereExpressions;

      expect(readSqlColumnNames(condition)).toEqual(
        expect.arrayContaining(['id', 'deleted_at', 'updated_at']),
      );
    });

    it('returns null when the guard matched nothing', async () => {
      const database = createCustomersDatabaseMock({ updatedRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.updateById(
          database.tx,
          'missing',
          { legalName: 'Új Név Kft.' },
          CUSTOMER_UPDATED_AT,
        ),
      ).resolves.toBeNull();
    });

    it('maps a tax_number violation to the domain error', async () => {
      const database = createCustomersDatabaseMock({
        updateError: wrapDrizzleQueryError(
          new PostgresErrorMock('23505', 'customers_tax_number_key'),
        ),
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.updateById(
          database.tx,
          'some-id',
          { taxNumber: '10773381-2-44' },
          CUSTOMER_UPDATED_AT,
        ),
      ).rejects.toBeInstanceOf(CustomerTaxNumberConflictError);
    });
  });

  describe('updateStatusById', () => {
    it('writes the status pair with the guard', async () => {
      const row = buildRawCustomerRow({ status: 'suspended' });
      const database = createCustomersDatabaseMock({ updatedRows: [row] });
      const repository = new DrizzleCustomersRepository(database.db);
      const patch = {
        status: 'suspended',
        statusChangedAt: CUSTOMER_UPDATED_AT,
      } as const;

      const result = await repository.updateStatusById(
        database.tx,
        row.id,
        patch,
        CUSTOMER_UPDATED_AT,
      );

      expect(result).toEqual(row);
      expect(database.updateSetArguments).toEqual([patch]);
    });

    it('returns null when the guard matched nothing', async () => {
      const database = createCustomersDatabaseMock({ updatedRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.updateStatusById(
          database.tx,
          'missing',
          { status: 'suspended', statusChangedAt: CUSTOMER_UPDATED_AT },
          CUSTOMER_UPDATED_AT,
        ),
      ).resolves.toBeNull();
    });

    it('propagates a database error unchanged (no fabricated 409)', async () => {
      const driverError = new PostgresErrorMock('40001');
      const database = createCustomersDatabaseMock({
        updateError: driverError,
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.updateStatusById(
          database.tx,
          'some-id',
          { status: 'suspended', statusChangedAt: CUSTOMER_UPDATED_AT },
          CUSTOMER_UPDATED_AT,
        ),
      ).rejects.toBe(driverError);
    });
  });

  describe('softDeleteById', () => {
    it('sets deleted_at and returns the row', async () => {
      const row = buildRawCustomerRow({ deletedAt: CUSTOMER_DELETED_AT });
      const database = createCustomersDatabaseMock({ updatedRows: [row] });
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.softDeleteById(
        database.tx,
        row.id,
        CUSTOMER_DELETED_AT,
      );

      expect(result).toEqual(row);
      expect(database.updateSetArguments).toEqual([
        { deletedAt: CUSTOMER_DELETED_AT },
      ]);
      expect(readSqlColumnNames(database.updateWhereExpressions[0])).toEqual(
        expect.arrayContaining(['id', 'deleted_at']),
      );
    });

    it('returns null on a repeat delete', async () => {
      const database = createCustomersDatabaseMock({ updatedRows: [] });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.softDeleteById(database.tx, 'gone', CUSTOMER_DELETED_AT),
      ).resolves.toBeNull();
    });
  });

  describe('nextCustomerNumber', () => {
    it('returns the stored maximum of the month', async () => {
      const database = createCustomersDatabaseMock({
        maxCustomerNumber: 'AIS-202611-004',
      });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.nextCustomerNumber(database.tx, 'AIS-202611-'),
      ).resolves.toBe('AIS-202611-004');
    });

    it('returns null for an empty month', async () => {
      const database = createCustomersDatabaseMock({ maxCustomerNumber: null });
      const repository = new DrizzleCustomersRepository(database.db);

      await expect(
        repository.nextCustomerNumber(database.tx, 'AIS-202611-'),
      ).resolves.toBeNull();
    });

    it('filters on customer_number and does not exclude deleted rows', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      await repository.nextCustomerNumber(database.tx, 'AIS-202611-');

      const [condition] = database.whereExpressions;

      expect(readSqlColumnNames(condition)).toEqual(['customer_number']);
      expect(readSqlExpression(condition).toLowerCase()).toContain('like');
    });
  });

  describe('runInTransaction', () => {
    it('passes the transaction handle to the unit of work', async () => {
      const database = createCustomersDatabaseMock();
      const repository = new DrizzleCustomersRepository(database.db);

      const result = await repository.runInTransaction((tx) => {
        expect(tx).toBe(database.tx);

        return Promise.resolve('done');
      });

      expect(result).toBe('done');
      expect(database.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
