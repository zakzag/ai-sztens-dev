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
  buildApiKeyRow,
  buildCreateApiKeyInput,
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

  describe('findAll', () => {
    it('returns the selected rows and orders by created_at DESC', async () => {
      const rows = [
        buildApiKeyRow({ identifier: 'newer' }),
        buildApiKeyRow({ identifier: 'older' }),
      ];
      const database = createDatabaseMock({ selectedRows: rows });
      const repository = new DrizzleApiKeysRepository(database.db);

      const result = await repository.findAll();

      expect(result).toEqual(rows);
      expect(database.select).toHaveBeenCalledTimes(1);
      expect(database.from).toHaveBeenCalledTimes(1);

      const orderByExpression = firstArgument(database.orderBy);
      // The direction is SQL text, the column is a `Column` object (see the
      // helper's docblock), so both are asserted separately.
      expect(readSqlExpression(orderByExpression)).toContain('desc');
      expect(readSqlColumnNames(orderByExpression)).toContain('created_at');
    });

    it('returns an empty array when the table is empty', async () => {
      const database = createDatabaseMock({ selectedRows: [] });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('propagates a select error unchanged', async () => {
      const driverError = new PostgresErrorMock('42P01');
      const database = createDatabaseMock({ selectError: driverError });
      const repository = new DrizzleApiKeysRepository(database.db);

      await expect(repository.findAll()).rejects.toBe(driverError);
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
  });
});
