import { jest } from '@jest/globals';
import type { NewAuditLogRow } from '../db/schema.js';
import type { DatabaseTransaction } from './audit-transaction.interface.js';
import { DrizzleAuditRepository } from './audit.repository.js';
import { AUDIT_CUSTOMER_ID, AUDIT_RECORD_ID } from './test/mocks/audit.mock.js';

/**
 * Unit tests for the Drizzle implementation (AIS-177).
 *
 * They assert the *contract with the writer*: the row goes to `audit_logs`, and
 * it goes through the transaction handle the caller passed — never through the
 * connection pool. That single property is what makes the audit row and the
 * business row commit together.
 */
describe('DrizzleAuditRepository', () => {
  /** @returns a transaction handle whose `insert().values()` chain is spied on. */
  function createTransactionStub(): {
    readonly tx: DatabaseTransaction;
    readonly insert: ReturnType<typeof jest.fn>;
    readonly values: ReturnType<typeof jest.fn>;
  } {
    const values = jest.fn<Promise<void>, []>(() => Promise.resolve(undefined));
    const insert = jest.fn(() => ({ values }));

    return { tx: { insert } as unknown as DatabaseTransaction, insert, values };
  }

  /** @returns a complete insert payload, as the writer resolves it. */
  function buildRow(): NewAuditLogRow {
    return {
      customerId: AUDIT_CUSTOMER_ID,
      tableName: 'customers',
      recordId: AUDIT_RECORD_ID,
      operation: 'update',
      beforeData: { legal_name: 'Régi' },
      afterData: { legal_name: 'Új' },
      actorType: 'system',
      actorId: null,
      actorName: 'system',
      ipAddress: '10.1.2.3',
      userAgent: 'test-agent',
      requestId: 'req-1',
      source: 'admin_api',
    };
  }

  it('inserts the row through the provided transaction', async () => {
    const repository = new DrizzleAuditRepository();
    const row = buildRow();
    const transaction = createTransactionStub();

    await repository.insert(row, transaction.tx);

    expect(transaction.insert).toHaveBeenCalledTimes(1);
    expect(transaction.values).toHaveBeenCalledWith(row);
  });

  it('propagates the driver error instead of swallowing it', async () => {
    const repository = new DrizzleAuditRepository();
    const failure = new Error('permission denied for table audit_logs');
    const insert = jest.fn(() => ({
      values: jest.fn<Promise<void>, []>(() => Promise.reject(failure)),
    }));
    const tx = { insert } as unknown as DatabaseTransaction;

    await expect(repository.insert(buildRow(), tx)).rejects.toBe(failure);
  });
});
