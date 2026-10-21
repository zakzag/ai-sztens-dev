import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { apiKeys, platformSchema } from './schema.js';
import { readSqlExpression } from './test/helpers/sql-expression.js';

/**
 * Unit tests for the `platform.api_keys` schema contract (AIS-39).
 *
 * Nothing here touches a database: `getTableConfig()` reads the schema-as-code
 * the same way the migration generator does, so a renamed column, a lost
 * `NOT NULL`, a dropped unique constraint or a changed default fails here
 * instead of surfacing as a runtime error in AIS-40.
 *
 * The last block reads the committed migration, because `db:generate` writes SQL
 * that nobody reviews by accident — the generated file and the schema must agree.
 */

const config = getTableConfig(apiKeys);

/** `name / columnType / dataType / notNull` — the ticket's column mapping. */
const COLUMN_MAPPING = [
  ['id', 'PgUUID', 'string', true],
  ['name', 'PgText', 'string', true],
  ['identifier', 'PgText', 'string', true],
  ['description', 'PgText', 'string', false],
  ['api_key', 'PgText', 'string', true],
  ['expires_at', 'PgTimestamp', 'date', false],
  ['created_at', 'PgTimestamp', 'date', true],
  ['updated_at', 'PgTimestamp', 'date', true],
] as const;

const MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0002_minor_domino.sql', import.meta.url),
);

describe('apiKeys table identity', () => {
  it('lives in the platform schema', () => {
    expect(platformSchema.schemaName).toBe('platform');
    expect(config.schema).toBe('platform');
    expect(config.name).toBe('api_keys');
  });
});

describe('apiKeys column mapping', () => {
  it('declares the eight ticket columns in order', () => {
    expect(config.columns.map((column) => column.name)).toEqual(
      COLUMN_MAPPING.map(([name]) => name),
    );
  });

  it.each(COLUMN_MAPPING)(
    'maps %s to %s / %s / notNull=%s',
    (name, columnType, dataType, notNull) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn).toBeDefined();
      expect(tableColumn?.columnType).toBe(columnType);
      expect(tableColumn?.dataType).toBe(dataType);
      expect(tableColumn?.notNull).toBe(notNull);
    },
  );

  it('keeps the camelCase property names apart from the snake_case DB names', () => {
    expect(apiKeys.apiKey.name).toBe('api_key');
    expect(apiKeys.expiresAt.name).toBe('expires_at');
    expect(apiKeys.createdAt.name).toBe('created_at');
    expect(apiKeys.updatedAt.name).toBe('updated_at');
  });
});

describe('apiKeys defaults', () => {
  it('generates the uuid on the database side', () => {
    expect(readSqlExpression(apiKeys.id.default)).toBe('gen_random_uuid()');
  });

  it('stamps both timestamps with now()', () => {
    expect(readSqlExpression(apiKeys.createdAt.default)).toBe('now()');
    expect(readSqlExpression(apiKeys.updatedAt.default)).toBe('now()');
  });

  it.each(['name', 'identifier', 'description', 'api_key', 'expires_at'])(
    'leaves %s without a default',
    (name) => {
      const tableColumn = config.columns.find((column) => column.name === name);

      expect(tableColumn?.hasDefault).toBe(false);
    },
  );
});

describe('apiKeys primary key', () => {
  it('has exactly one primary key column, id', () => {
    expect(
      config.columns
        .filter((column) => column.primary)
        .map((column) => column.name),
    ).toEqual(['id']);
    expect(apiKeys.id.primary).toBe(true);
    expect(config.primaryKeys).toEqual([]);
  });
});

describe('apiKeys unique constraint', () => {
  it('has exactly one unique constraint, on identifier', () => {
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(['api_keys_identifier_key']);
    expect(
      config.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      ),
    ).toEqual([['identifier']]);
  });

  it('declares no extra indexes, checks or foreign keys', () => {
    expect(config.indexes).toEqual([]);
    expect(config.checks).toEqual([]);
    expect(config.foreignKeys).toEqual([]);
  });
});

describe('generated migration 0002', () => {
  const migration = readFileSync(MIGRATION_FILE, 'utf8');

  it('creates the table in the platform schema', () => {
    expect(migration).toContain('CREATE TABLE "platform"."api_keys"');
  });

  it('creates the schema idempotently, because it already exists on live volumes', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "platform"');
    // Anchored to the statement, so the explanatory SQL comment is allowed to
    // mention the unguarded form the generator originally emitted.
    expect(migration).not.toMatch(/^CREATE SCHEMA "platform"/m);
  });

  it('carries the named unique constraint the API maps to 409', () => {
    expect(migration).toContain(
      'CONSTRAINT "api_keys_identifier_key" UNIQUE("identifier")',
    );
  });

  it('stores the timestamps with time zone', () => {
    const timestampColumns =
      migration.match(/"\w+" timestamp with time zone/g) ?? [];

    expect(timestampColumns).toHaveLength(3);
  });
});
