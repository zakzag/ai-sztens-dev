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
  // AIS-108: the soft-delete marker. Nullable on purpose — `NULL` means "live".
  ['deleted_at', 'PgTimestamp', 'date', false],
] as const;

const MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0002_minor_domino.sql', import.meta.url),
);

/** Migration that added `deleted_at` and its index (AIS-108). */
const SOFT_DELETE_MIGRATION_FILE = fileURLToPath(
  new URL('../../drizzle/0003_organic_firedrake.sql', import.meta.url),
);

describe('apiKeys table identity', () => {
  it('lives in the platform schema', () => {
    expect(platformSchema.schemaName).toBe('platform');
    expect(config.schema).toBe('platform');
    expect(config.name).toBe('api_keys');
  });
});

describe('apiKeys column mapping', () => {
  it('declares the nine columns in order', () => {
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
    expect(apiKeys.deletedAt.name).toBe('deleted_at');
  });

  it('leaves the soft-delete marker nullable and without a default', () => {
    // `NULL` = live; a timestamp = deleted. A default would mark every new row
    // as deleted, and `NOT NULL` would make "live" inexpressible.
    expect(apiKeys.deletedAt.notNull).toBe(false);
    expect(apiKeys.deletedAt.hasDefault).toBe(false);
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

  it('declares exactly one index, the soft-delete one (AIS-108)', () => {
    expect(config.indexes.map((entry) => entry.config.name)).toEqual([
      'api_keys_deleted_at_idx',
    ]);
    // Drizzle types `index.config.columns` as `any`, so the shape is asserted
    // through a narrow local view instead of leaking `any[]` through `.map()`.
    const indexedColumns = (config.indexes[0]?.config.columns ??
      []) as readonly {
      readonly name: string;
    }[];

    expect(indexedColumns.map((column) => column.name)).toEqual(['deleted_at']);
  });

  it('declares no checks or foreign keys', () => {
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

describe('generated migration 0003', () => {
  const migration = readFileSync(SOFT_DELETE_MIGRATION_FILE, 'utf8');

  it('adds the nullable deleted_at column', () => {
    expect(migration).toContain(
      'ALTER TABLE "platform"."api_keys" ADD COLUMN "deleted_at" timestamp with time zone',
    );
  });

  it('creates the soft-delete index every read can use', () => {
    expect(migration).toContain(
      'CREATE INDEX "api_keys_deleted_at_idx" ON "platform"."api_keys"',
    );
  });

  it('does not make the existing rows look deleted', () => {
    // No `NOT NULL` and no default: every current row is live by definition.
    expect(migration).not.toContain(
      'deleted_at" timestamp with time zone NOT NULL',
    );
    expect(migration).not.toContain('DEFAULT now()');
  });
});
