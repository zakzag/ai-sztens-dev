import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  CALL_STATUS_VALUES,
  callbackRequests,
  callStatusEnum,
} from './schema.js';

/**
 * Schema-as-code contract tests (AIS-36).
 *
 * These run WITHOUT a database: `getTableConfig()` reads the metadata that
 * `drizzle-kit generate` uses to produce the SQL, so a wrong column type,
 * width, nullability or default fails here — before a migration is generated
 * and long before a query fails at runtime.
 *
 * The one thing a unit test cannot prove is that the generated SQL applies
 * cleanly; that is covered by the `db:migrate` verification described in
 * `docs/Specs/Database-Local.md`.
 */

const table = getTableConfig(callbackRequests);

/** Look up a column by its database name, failing loudly when it is missing. */
function columnOf(name: string) {
  const column = table.columns.find((candidate) => candidate.name === name);
  if (!column) {
    throw new Error(`Column "${name}" is missing from callback_requests`);
  }
  return column;
}

describe('callback_requests table', () => {
  it('lives in the callback schema', () => {
    expect(table.schema).toBe('callback');
  });

  it('is named callback_requests', () => {
    expect(table.name).toBe('callback_requests');
  });

  it('has exactly the expected columns, in insert order', () => {
    expect(table.columns.map((column) => column.name)).toEqual([
      'id',
      'name',
      'email',
      'phone',
      'reason',
      'status',
      'created_at',
    ]);
  });

  it('declares no indexes or foreign keys yet', () => {
    // Indexes are added with the queries that need them (AIS-38 and later);
    // this assertion makes adding one a deliberate, reviewed change.
    expect(table.indexes).toHaveLength(0);
    expect(table.foreignKeys).toHaveLength(0);
  });

  describe('id', () => {
    it('is a NOT NULL uuid primary key with a database-side default', () => {
      const id = columnOf('id');
      expect(id.getSQLType()).toBe('uuid');
      expect(id.primary).toBe(true);
      expect(id.notNull).toBe(true);
      expect(id.default).toBeDefined();
    });
  });

  describe('contact fields', () => {
    it.each([
      ['name', 'varchar(120)'],
      ['email', 'varchar(254)'],
      ['phone', 'varchar(20)'],
      ['reason', 'varchar(1000)'],
    ])('%s is a NOT NULL %s, matching the DTO limits', (name, sqlType) => {
      const column = columnOf(name);
      expect(column.getSQLType()).toBe(sqlType);
      expect(column.notNull).toBe(true);
      // A request that passes class-validator must never fail on a DB
      // length constraint, so these widths mirror the DTO exactly.
      expect(column.default).toBeUndefined();
    });
  });

  describe('status', () => {
    it('is the callback.call_status enum, NOT NULL, defaulting to queued', () => {
      const status = columnOf('status');
      expect(status.columnType).toBe('PgEnumColumn');
      expect(status.notNull).toBe(true);
      expect(status.default).toBe('queued');
    });

    it('carries every shared CallStatus value in the same order', () => {
      const status = columnOf('status');
      if (status.columnType !== 'PgEnumColumn') {
        throw new Error('status is not an enum column');
      }
      expect(status.enumValues).toEqual([...CALL_STATUS_VALUES]);
    });
  });

  describe('created_at', () => {
    it('is a NOT NULL timestamptz with a now() default', () => {
      const createdAt = columnOf('created_at');
      expect(createdAt.getSQLType()).toBe('timestamp with time zone');
      expect(createdAt.notNull).toBe(true);
      expect(createdAt.default).toBeDefined();
    });
  });
});

describe('call_status enum', () => {
  it('is the callback.call_status type', () => {
    expect(callStatusEnum.enumName).toBe('call_status');
    expect(callStatusEnum.schema).toBe('callback');
  });

  it('contains the ten states of the call lifecycle, in order', () => {
    expect(callStatusEnum.enumValues).toEqual([
      'queued',
      'dialing',
      'ringing',
      'in-progress',
      'completed',
      'failed',
      'no_answer',
      'busy',
      'actions-executing',
      'done',
    ]);
  });

  it('starts in queued (the column default must be a valid member)', () => {
    expect(callStatusEnum.enumValues[0]).toBe('queued');
    expect(callStatusEnum.enumValues).toContain(columnOf('status').default);
  });
});
