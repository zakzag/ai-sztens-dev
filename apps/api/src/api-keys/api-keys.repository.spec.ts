import {
  readSqlColumnNames,
  readSqlExpression,
} from '../db/test/helpers/sql-expression.js';
import {
  ApiKeyIdentifierConflictError,
  ApiKeyRowMissingError,
} from './api-keys.errors.js';
import { toNewApiKeyRow } from './api-keys.mapper.js';
import { DrizzleApiKeysRepository } from './api-keys.repository.js';
import {
  API_KEY_DELETED_AT,
  API_KEY_UPDATED_AT,
  buildApiKeyRow,
  buildCreateApiKeyInput,
  buildListQuery,
} from './test/mocks/api-keys.mock.js';
import {
  createDatabaseMock,
  PostgresErrorMock,
  wrapDrizzleQueryError,
} from './test/mocks/database.mock.js';

/**
 * Unit tests for the Drizzle repository.
 *
 * The `Database` handle is mocked (see `test/mocks/database.mock.ts`), so these
 * tests never need `DATABASE_URL`, a running Postgres or a migrated table — the
 * real database behaviour (a duplicate actually rejected by the constraint) is
 * proven by `test/api-keys.e2e-spec.ts`.
 *
 * Assertions stay at the contract level: which method was called with which
 * payload, and which error is surfaced. Drizzle's internal call order is not
 * part of the contract.
 */

/** @returns the first argument a spy was called with, as `unknown`. */
function firstArgument(spy: {
  readonly mock: { readonly calls: readonly unknown[][] };
}): unknown {
  const [call] = spy.mock.calls;
  if (call === undefined) {
    throw new Error('expected the spy to be called at least once');
  }
  return call[0];
}

/** @returns every argument of the first call of a spy. */
function callArguments(spy: {
  readonly mock: { readonly calls: readonly unknown[][] };
}): readonly unknown[] {
  const [call] = spy.mock.calls;
  if (call === undefined) {
    throw new Error('expected the spy to be called at least once');
  }
  return call;
}

describe('DrizzleApiKeysRepository', () => {
  describe('create', () => {
    it('inserts the mapped payload and returns the persisted row', async () => {
      const row = buildApiKeyRow();
      const database = createDatabaseMock({ insertedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);
      const input = toNewApiKeyRow(buildCreateApiKeyInput());

      const result = await repository.create(input);

      expect(result).toEqual(row);
      expect(database.insert).toHaveBeenCalledTimes(1);
      expect(database.values).toHaveBeenCalledWith(input);
      expect(database.returning).toHaveBeenCalledTimes(1);
    });

    it('maps a unique violation on api_keys_identifier_key to ApiKeyIdentifierConflictError', async () => {
      // Drizzle wraps the driver error — exactly what the live smoke showed.
      const database = createDatabaseMock({
        insertError: wrapDrizzleQueryError(
          new PostgresErrorMock('23505', 'api_keys_identifier_key'),
        ),
      });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.create(toNewApiKeyRow(buildCreateApiKeyInput())),
      ).rejects.toMatchObject({
        name: 'ApiKeyIdentifierConflictError',
        identifier: 'vapi-prod',
      });
    });

    it('accepts a 23505 without a constraint name (driver did not report it)', async () => {
      const database = createDatabaseMock({
        insertError: new PostgresErrorMock('23505'),
      });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.create(toNewApiKeyRow(buildCreateApiKeyInput())),
      ).rejects.toBeInstanceOf(ApiKeyIdentifierConflictError);
    });

    it('propagates a 23505 from a different constraint unchanged', async () => {
      const driverError = wrapDrizzleQueryError(
        new PostgresErrorMock('23505', 'api_keys_name_key'),
      );
      const database = createDatabaseMock({ insertError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.create(toNewApiKeyRow(buildCreateApiKeyInput())),
      ).rejects.toBe(driverError);
    });

    it('propagates a non-unique database error unchanged (no wrapping)', async () => {
      const driverError = new PostgresErrorMock('23503');
      const database = createDatabaseMock({ insertError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.create(toNewApiKeyRow(buildCreateApiKeyInput())),
      ).rejects.toBe(driverError);
    });

    it('throws ApiKeyRowMissingError when the insert returns no row', async () => {
      const database = createDatabaseMock({ insertedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.create(toNewApiKeyRow(buildCreateApiKeyInput())),
      ).rejects.toBeInstanceOf(ApiKeyRowMissingError);
    });
  });

  describe('findPage', () => {
    it('returns the page and the total from the count query', async () => {
      const rows = [
        buildApiKeyRow({ identifier: 'newer' }),
        buildApiKeyRow({ identifier: 'older' }),
      ];
      const database = createDatabaseMock({ selectedRows: rows, total: 42 });
      const repository = new DrizzleApiKeysRepository(database.db);

      const result = await repository.findPage(
        buildListQuery({ page: 3, limit: 10 }),
      );

      expect(result).toEqual({ rows, total: 42 });
      // One select for the count, one for the page itself.
      expect(database.select).toHaveBeenCalledTimes(2);
      expect(database.from).toHaveBeenCalledTimes(2);
      expect(database.limit).toHaveBeenCalledWith(10);
      expect(database.offset).toHaveBeenCalledWith(20);
    });

    it('orders by the requested column with the id tie-breaker', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findPage(buildListQuery({ sort: 'name', order: 'asc' }));

      const [sortExpression, tieBreaker] = callArguments(database.orderBy);
      // The direction is SQL text, the column is a `Column` object (see the
      // helper's docblock), so both are asserted separately.
      expect(readSqlExpression(sortExpression)).toContain('asc');
      expect(readSqlColumnNames(sortExpression)).toContain('name');
      // Without the tie-breaker two rows sharing a timestamp could swap places
      // between requests, and a page boundary would skip a row (plan D6).
      expect(readSqlColumnNames(tieBreaker)).toEqual(['id']);
    });

    it('sorts by created_at descending by default', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findPage(buildListQuery());

      const [sortExpression] = callArguments(database.orderBy);
      expect(readSqlExpression(sortExpression)).toContain('desc');
      expect(readSqlColumnNames(sortExpression)).toContain('created_at');
    });

    it('filters on name and identifier when a search term is given', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findPage(buildListQuery({ q: 'vapi' }));

      const [filter] = callArguments(database.where);
      expect(readSqlExpression(filter)).toContain('ilike');
      expect(readSqlColumnNames(filter)).toEqual(
        expect.arrayContaining(['name', 'identifier']),
      );
    });

    it('always excludes soft-deleted rows, even without a search term', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findPage(buildListQuery());

      // AIS-108: the WHERE is never absent any more — visibility is not
      // optional, so a soft-deleted row cannot leak into the list or the total.
      expect(readSqlColumnNames(firstArgument(database.where))).toContain(
        'deleted_at',
      );
      expect(readSqlExpression(firstArgument(database.where))).toContain(
        'is null',
      );
    });

    it('applies visibility and the search term to the count query too', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findPage(buildListQuery({ q: 'vapi' }));

      // Same expression object for both queries: `total` can never count rows
      // the page does not show.
      expect(database.countWhere.mock.calls[0]?.[0]).toBe(
        database.where.mock.calls[0]?.[0],
      );
    });

    it('returns an empty page with a zero total when nothing matches', async () => {
      const database = createDatabaseMock({ selectedRows: [], total: 0 });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findPage(buildListQuery())).resolves.toEqual({
        rows: [],
        total: 0,
      });
    });

    it('reports a zero total when the driver returns no count row', async () => {
      const database = createDatabaseMock();
      database.countWhere.mockResolvedValueOnce([]);
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findPage(buildListQuery())).resolves.toEqual({
        rows: [],
        total: 0,
      });
    });

    it('propagates a page-query error unchanged', async () => {
      const driverError = new PostgresErrorMock('42P01');
      const database = createDatabaseMock({ selectError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findPage(buildListQuery())).rejects.toBe(
        driverError,
      );
    });

    it('propagates a count-query error unchanged', async () => {
      const driverError = new PostgresErrorMock('57014');
      const database = createDatabaseMock({ countError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findPage(buildListQuery())).rejects.toBe(
        driverError,
      );
    });
  });

  describe('findByIdentifier', () => {
    it('returns the matching row', async () => {
      const row = buildApiKeyRow();
      const database = createDatabaseMock({ selectedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findByIdentifier('vapi-prod')).resolves.toEqual(
        row,
      );
      expect(database.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when no row matches', async () => {
      const database = createDatabaseMock({ selectedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findByIdentifier('missing')).resolves.toBeNull();
    });

    it('trims the search key before querying', async () => {
      const row = buildApiKeyRow();
      const database = createDatabaseMock({ selectedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.findByIdentifier('  vapi-prod  '),
      ).resolves.toEqual(row);
      expect(database.select).toHaveBeenCalledTimes(1);
    });

    it('returns null for a blank identifier without issuing a query', async () => {
      const database = createDatabaseMock({ selectedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findByIdentifier('   ')).resolves.toBeNull();
      expect(database.select).not.toHaveBeenCalled();
    });

    it('returns null for an empty identifier without issuing a query', async () => {
      const database = createDatabaseMock({ selectedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findByIdentifier('')).resolves.toBeNull();
      expect(database.select).not.toHaveBeenCalled();
    });

    it('filters on the identifier and on visibility (deleted rows are invisible)', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findByIdentifier('vapi-prod');

      const filter = firstArgument(database.where);
      expect(readSqlColumnNames(filter)).toEqual(
        expect.arrayContaining(['identifier', 'deleted_at']),
      );
    });
  });

  describe('updateByIdentifier', () => {
    it('returns the updated row', async () => {
      const row = buildApiKeyRow({ name: 'renamed' });
      const database = createDatabaseMock({ updatedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.updateByIdentifier(
          'vapi-prod',
          { name: 'renamed' },
          API_KEY_UPDATED_AT,
        ),
      ).resolves.toEqual(row);
    });

    it('writes only the provided columns', async () => {
      const database = createDatabaseMock({ updatedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      const patch = { name: 'renamed', description: null };
      await repository.updateByIdentifier(
        'vapi-prod',
        patch,
        API_KEY_UPDATED_AT,
      );

      expect(database.set).toHaveBeenCalledWith(patch);
    });

    it('never writes updatedAt, even though the token is part of the call', async () => {
      const database = createDatabaseMock({ updatedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.updateByIdentifier(
        'vapi-prod',
        { name: 'renamed' },
        API_KEY_UPDATED_AT,
      );

      const [patch] = callArguments(database.set);
      expect(patch).not.toHaveProperty('updatedAt');
    });

    it('guards the write with identifier, visibility and the expected version', async () => {
      const database = createDatabaseMock({ updatedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.updateByIdentifier(
        'vapi-prod',
        { name: 'renamed' },
        API_KEY_UPDATED_AT,
      );

      const filter = firstArgument(database.updateWhere);
      const columns = readSqlColumnNames(filter);
      // All three conditions in one statement: there is no read-compare-write
      // window, which is the entire reason the update is a single query.
      expect(columns).toEqual(
        expect.arrayContaining(['identifier', 'deleted_at', 'updated_at']),
      );
      expect(readSqlExpression(filter)).toContain('is null');
    });

    it('returns null when no row matched (absent, deleted or stale)', async () => {
      const database = createDatabaseMock({ updatedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.updateByIdentifier(
          'missing',
          { name: 'renamed' },
          API_KEY_UPDATED_AT,
        ),
      ).resolves.toBeNull();
    });

    it('propagates a driver error unchanged', async () => {
      const driverError = new PostgresErrorMock('40001');
      const database = createDatabaseMock({ updateError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.updateByIdentifier(
          'vapi-prod',
          { name: 'renamed' },
          API_KEY_UPDATED_AT,
        ),
      ).rejects.toBe(driverError);
    });
  });

  describe('softDeleteByIdentifier', () => {
    it('sets deleted_at and returns the row', async () => {
      const row = buildApiKeyRow({ deletedAt: API_KEY_DELETED_AT });
      const database = createDatabaseMock({ updatedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);

      const result = await repository.softDeleteByIdentifier(
        'vapi-prod',
        API_KEY_DELETED_AT,
      );

      expect(result).toEqual(row);
      expect(database.set).toHaveBeenCalledWith({
        deletedAt: API_KEY_DELETED_AT,
      });
    });

    it('matches only a live row', async () => {
      const database = createDatabaseMock({
        updatedRows: [buildApiKeyRow({ deletedAt: API_KEY_DELETED_AT })],
      });
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.softDeleteByIdentifier('vapi-prod', API_KEY_DELETED_AT);

      const columns = readSqlColumnNames(firstArgument(database.updateWhere));
      expect(columns).toEqual(
        expect.arrayContaining(['identifier', 'deleted_at']),
      );
    });

    it('returns null when the row is absent or already deleted', async () => {
      const database = createDatabaseMock({ updatedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.softDeleteByIdentifier('missing', API_KEY_DELETED_AT),
      ).resolves.toBeNull();
    });

    it('propagates a driver error unchanged', async () => {
      const driverError = new PostgresErrorMock('57014');
      const database = createDatabaseMock({ updateError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.softDeleteByIdentifier('vapi-prod', API_KEY_DELETED_AT),
      ).rejects.toBe(driverError);
    });
  });

  describe('findAnyByIdentifier', () => {
    it('returns a deleted row too (that is the point)', async () => {
      const row = buildApiKeyRow({ deletedAt: API_KEY_DELETED_AT });
      const database = createDatabaseMock({ selectedRows: [row] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.findAnyByIdentifier('vapi-prod'),
      ).resolves.toEqual(row);
    });

    it('does not filter on visibility', async () => {
      const database = createDatabaseMock();
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findAnyByIdentifier('vapi-prod');

      expect(readSqlColumnNames(firstArgument(database.where))).not.toContain(
        'deleted_at',
      );
    });

    it('returns null when no row ever existed', async () => {
      const database = createDatabaseMock({ selectedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(
        repository.findAnyByIdentifier('missing'),
      ).resolves.toBeNull();
    });

    it('trims the search key before querying', async () => {
      const database = createDatabaseMock({ selectedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await repository.findAnyByIdentifier('  vapi-prod  ');

      expect(database.limit).toHaveBeenCalledWith(1);
    });

    it('short-circuits a blank identifier without issuing a query', async () => {
      const database = createDatabaseMock({ selectedRows: [buildApiKeyRow()] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findAnyByIdentifier('   ')).resolves.toBeNull();
      expect(database.select).not.toHaveBeenCalled();
    });

    it('propagates a driver error unchanged', async () => {
      const driverError = new PostgresErrorMock('42P01');
      const database = createDatabaseMock({ selectError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findAnyByIdentifier('vapi-prod')).rejects.toBe(
        driverError,
      );
    });
  });
});
