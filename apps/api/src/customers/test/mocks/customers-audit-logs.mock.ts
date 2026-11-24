import { jest } from '@jest/globals';
import type { AuditLogListQuery } from '@callback/shared';
import type { Database } from '../../../db/database.interface.js';
import { auditLogs, customers } from '../../../db/schema.js';
import type { AuditLogRow } from '../../../db/schema.js';
import type { AuditLogPage } from '../../customers-audit-logs.interface.js';
import type { CustomerAuditLogsRepository } from '../../customers-audit-logs.repository.interface.js';

/**
 * Fixtures and doubles for the audit-log read specs (AIS-178, slice f).
 *
 * Centralised here (coding standard: no fixtures inline in spec files) so the row
 * shape stays in sync with `schema.ts` and the service, controller and repository
 * specs share one description of "a ledger row".
 */

/** Fixed customer uuid the ledger rows belong to. */
export const AUDIT_CUSTOMER_ID = '3f4a5b6c-7d8e-4f90-8a1b-2c3d4e5f6a7b';

/** Fixed `record_id` of the fixture (the audited row's uuid). */
export const AUDIT_RECORD_ID = '4a5b6c7d-8e9f-4a0b-9c1d-3e4f5a6b7c8d';

/** Fixed actor uuid, for the `operator` actor branch. */
export const AUDIT_ACTOR_ID = '6b7c8d9e-0f1a-4b2c-8d3e-5f6a7b8c9d0e';

/** The correlation id of the request that produced the change. */
export const AUDIT_REQUEST_ID = '0192f3c4-0000-7000-8000-000000000000';

/** Instant the fixture's change happened. */
export const AUDIT_OCCURRED_AT = new Date('2026-11-23T09:00:00.000Z');

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `audit.audit_logs` row.
 */
export function buildAuditLogRowFixture(
  overrides: Partial<AuditLogRow> = {},
): AuditLogRow {
  return {
    id: 41,
    customerId: AUDIT_CUSTOMER_ID,
    tableName: 'customers',
    recordId: AUDIT_RECORD_ID,
    operation: 'insert',
    beforeData: null,
    afterData: { legalName: 'Példa Kft.' },
    actorType: 'system',
    actorId: null,
    actorName: 'system',
    occurredAt: AUDIT_OCCURRED_AT,
    ipAddress: '127.0.0.1',
    userAgent: 'jest/audit-logs',
    requestId: AUDIT_REQUEST_ID,
    source: 'admin_api',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default query.
 * @returns a validated audit-log query (no filter applied).
 */
export function buildAuditLogListQuery(
  overrides: Partial<AuditLogListQuery> = {},
): AuditLogListQuery {
  return { page: 1, limit: 20, order: 'desc', ...overrides };
}

/** The jest doubles of one {@link CustomerAuditLogsRepository}. */
export interface CustomerAuditLogsRepositoryMock {
  readonly repository: CustomerAuditLogsRepository;
  readonly customerExists: jest.Mock<(customerId: string) => Promise<boolean>>;
  readonly findPage: jest.Mock<
    (customerId: string, query: AuditLogListQuery) => Promise<AuditLogPage>
  >;
}

/**
 * Builds a repository double whose defaults describe a live customer with one
 * ledger row.
 *
 * @returns the doubles plus the `CustomerAuditLogsRepository` they implement.
 */
export function createCustomerAuditLogsRepositoryMock(): CustomerAuditLogsRepositoryMock {
  const customerExists = jest.fn(() => Promise.resolve(true));
  const findPage = jest.fn(() =>
    Promise.resolve<AuditLogPage>({
      rows: [buildAuditLogRowFixture()],
      total: 1,
    }),
  );

  const repository: CustomerAuditLogsRepository = { customerExists, findPage };

  return { repository, customerExists, findPage };
}

/** Scripted outcomes of one audit-log database double. */
export interface AuditLogsDatabaseMockOptions {
  /** Rows resolved by the `customers` existence select. */
  readonly customerRows?: readonly { readonly id: string }[];
  /** Rows resolved by an `audit_logs` select. */
  readonly auditLogRows?: readonly AuditLogRow[];
  /** Total reported by the `count(*)` select; defaults to the row count. */
  readonly total?: number;
  /** Error rejected by the `audit_logs` read. */
  readonly selectError?: unknown;
}

/** Handle exposing the injected value and the recorded calls. */
export interface AuditLogsDatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  /** `WHERE` expressions of every select, in build order. */
  readonly selectExpressions: readonly unknown[];
  /** Arguments of every `orderBy`, in build order. */
  readonly orderByArguments: readonly (readonly unknown[])[];
  /** Values passed to every `limit`, in build order. */
  readonly limitValues: readonly unknown[];
}

/**
 * Chainable `Database` double for the audit-log repository spec.
 *
 * Read-only by construction: the double has no `insert`, `update` or `delete`, so
 * a write added to the repository would fail the spec instead of passing silently.
 *
 * @param options - scripted rows/errors; the defaults describe one ledger row.
 * @returns the injected handle plus what was recorded.
 */
export function createAuditLogsDatabaseMock(
  options: AuditLogsDatabaseMockOptions = {},
): AuditLogsDatabaseMock {
  const rejectWith = (reason: unknown): Promise<never> =>
    Promise.reject(
      reason instanceof Error
        ? reason
        : new Error('mocked database failure', { cause: reason }),
    );
  const selectExpressions: unknown[] = [];
  const orderByArguments: (readonly unknown[])[] = [];
  const limitValues: unknown[] = [];
  const auditLogRows = options.auditLogRows ?? [buildAuditLogRowFixture()];

  const select = jest.fn((fields?: unknown) => ({
    from: jest.fn((table: object) => {
      if (table === customers) {
        return {
          where: jest.fn(() => ({
            limit: jest.fn((value: unknown) => {
              limitValues.push(value);

              return Promise.resolve([...(options.customerRows ?? [])]);
            }),
          })),
        };
      }

      if (table !== auditLogs) {
        throw new Error(
          'createAuditLogsDatabaseMock: unmocked table in a select',
        );
      }

      const settle = (): Promise<unknown[]> => {
        if (options.selectError !== undefined) {
          return rejectWith(options.selectError);
        }

        return Promise.resolve(
          isCountProjection(fields)
            ? [{ total: options.total ?? auditLogRows.length }]
            : [...auditLogRows],
        );
      };

      const chain = {
        orderBy: jest.fn((...args: unknown[]) => {
          orderByArguments.push(args);

          return chain;
        }),
        limit: jest.fn((value: unknown) => {
          limitValues.push(value);

          return chain;
        }),
        offset: jest.fn((value: unknown) => {
          limitValues.push(value);

          return settle();
        }),
        then: (
          onFulfilled: (rows: unknown[]) => unknown,
          onRejected: (reason: unknown) => unknown,
        ): Promise<unknown> => settle().then(onFulfilled, onRejected),
      };

      return {
        where: jest.fn((expression: unknown) => {
          selectExpressions.push(expression);

          return chain;
        }),
      };
    }),
  }));

  const db = { select } as unknown as Database;

  return { db, selectExpressions, orderByArguments, limitValues };
}

/**
 * @param fields - the `select` projection the repository passed.
 * @returns `true` when the projection is the `count(*)` one.
 */
function isCountProjection(fields: unknown): boolean {
  return (
    typeof fields === 'object' &&
    fields !== null &&
    Object.hasOwn(fields, 'total')
  );
}
