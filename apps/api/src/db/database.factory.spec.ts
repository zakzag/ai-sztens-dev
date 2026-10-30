import { jest } from '@jest/globals';
import { DEFAULT_DATABASE_POOL_MAX } from './database.const.js';
import { DatabaseConfigurationError } from './database.errors.js';
import {
  createDatabase,
  createDatabaseClient,
  readDatabaseUrl,
  resolvePoolMax,
  type DrizzleFactory,
  type PostgresClientFactory,
} from './database.factory.js';
import type { Database } from './database.interface.js';
import * as schema from './schema.js';
import { createEnvSourceMock } from './test/mocks/config.mock.js';
import { createSqlClientMock } from './test/mocks/postgres.mock.js';

const VALID_URL = 'postgres://aisztens:secret@127.0.0.1:5432/aisztens_db';

describe('resolvePoolMax', () => {
  it('uses the parsed value when it is a positive integer', () => {
    expect(resolvePoolMax('25')).toBe(25);
  });

  it('trims surrounding whitespace', () => {
    expect(resolvePoolMax('  12 ')).toBe(12);
  });

  it('falls back to the default when the value is absent', () => {
    expect(resolvePoolMax(undefined)).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it('falls back to the default when the value is blank', () => {
    expect(resolvePoolMax('   ')).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it.each(['abc', '0', '-3', '10.7', 'NaN'])(
    'falls back to the default for the invalid value %s',
    (raw) => {
      expect(resolvePoolMax(raw)).toBe(DEFAULT_DATABASE_POOL_MAX);
    },
  );
});

describe('readDatabaseUrl', () => {
  it('returns the configured URL', () => {
    const { source } = createEnvSourceMock({ DATABASE_URL: VALID_URL });

    expect(readDatabaseUrl(source)).toBe(VALID_URL);
  });

  it('trims surrounding whitespace', () => {
    const { source } = createEnvSourceMock({
      DATABASE_URL: `  ${VALID_URL}  `,
    });

    expect(readDatabaseUrl(source)).toBe(VALID_URL);
  });

  it.each([undefined, '', '   '])(
    'throws DatabaseConfigurationError for the blank value %p',
    (raw) => {
      const { source } = createEnvSourceMock(
        raw === undefined ? {} : { DATABASE_URL: raw },
      );

      expect(() => readDatabaseUrl(source)).toThrow(DatabaseConfigurationError);
    },
  );

  it('treats a non-string value as missing', () => {
    const { source } = createEnvSourceMock();
    const brokenSource = { get: (): unknown => 42 };

    expect(() => readDatabaseUrl(brokenSource)).toThrow(
      DatabaseConfigurationError,
    );
    // sanity: the well-formed mock is not the failing case
    expect(() => readDatabaseUrl(source)).toThrow(DatabaseConfigurationError);
  });

  it('names the offending variable and points at the documentation', () => {
    const { source } = createEnvSourceMock({});

    try {
      readDatabaseUrl(source);
      throw new Error('expected readDatabaseUrl to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DatabaseConfigurationError);
      if (!(error instanceof DatabaseConfigurationError)) return;

      expect(error.name).toBe('DatabaseConfigurationError');
      expect(error.variable).toBe('DATABASE_URL');
      expect(error.message).toContain('docs/Specs/Database-Local.md');
    }
  });
});

describe('createDatabaseClient', () => {
  it('creates the client with the configured URL and the default pool size', () => {
    const { source } = createEnvSourceMock({ DATABASE_URL: VALID_URL });
    const sql = createSqlClientMock();
    const createClient = jest.fn<PostgresClientFactory>(() => sql.client);

    const client = createDatabaseClient(source, createClient);
    const options = createClient.mock.calls[0]?.[1];

    expect(client).toBe(sql.client);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0]?.[0]).toBe(VALID_URL);
    expect(options?.max).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(typeof options?.onnotice).toBe('function');
  });

  it('honours DATABASE_POOL_MAX', () => {
    const { source } = createEnvSourceMock({
      DATABASE_URL: VALID_URL,
      DATABASE_POOL_MAX: '25',
    });
    const sql = createSqlClientMock();
    const createClient = jest.fn<PostgresClientFactory>(() => sql.client);

    createDatabaseClient(source, createClient);

    expect(createClient.mock.calls[0]?.[1].max).toBe(25);
  });

  it('ignores a non-string DATABASE_POOL_MAX', () => {
    const sql = createSqlClientMock();
    const createClient = jest.fn<PostgresClientFactory>(() => sql.client);
    const source = {
      get: (key: string): unknown => (key === 'DATABASE_URL' ? VALID_URL : 7),
    };

    createDatabaseClient(source, createClient);

    expect(createClient.mock.calls[0]?.[1].max).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it('silences notices so a healthy boot does not look broken', () => {
    const { source } = createEnvSourceMock({ DATABASE_URL: VALID_URL });
    const sql = createSqlClientMock();
    const createClient = jest.fn<PostgresClientFactory>(() => sql.client);

    createDatabaseClient(source, createClient);

    const options = createClient.mock.calls[0]?.[1];
    expect(options?.onnotice()).toBeUndefined();
  });

  it('never constructs a client when the URL is missing', () => {
    const { source } = createEnvSourceMock({});
    const sql = createSqlClientMock();
    const createClient = jest.fn<PostgresClientFactory>(() => sql.client);

    expect(() => createDatabaseClient(source, createClient)).toThrow(
      DatabaseConfigurationError,
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('createDatabase', () => {
  it('wraps the client with the full schema', () => {
    const sql = createSqlClientMock();
    const handle = { tag: 'drizzle-handle' } as unknown as Database;
    const createDrizzle = jest.fn<DrizzleFactory>(() => handle);

    const database = createDatabase(sql.client, createDrizzle);

    expect(database).toBe(handle);
    expect(createDrizzle).toHaveBeenCalledWith(sql.client, { schema });
  });
});
