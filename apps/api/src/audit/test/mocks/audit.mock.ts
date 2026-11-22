import type { NewAuditLogRow } from '../../../db/schema.js';
import type { DatabaseTransaction } from '../../audit-transaction.interface.js';
import type {
  AuditActor,
  AuditRequestFacts,
  AuditWriteInput,
} from '../../audit.interface.js';

/**
 * Fixtures and doubles for the audit specs (AIS-177).
 *
 * Centralised here, never inline in a spec file (coding standard): the payload
 * shapes follow `schema.ts`, so a column change breaks this file first instead
 * of quietly diverging in five tests.
 *
 * The doubles are **hand-written recorders** rather than `jest.fn()` spies: they
 * expose exactly what the specs assert (`calls`, `transactions`, `callCount`),
 * so no assertion has to reach into a spy's internals and the types stay
 * resolved under the strict lint rules.
 */

/** Fixed customer uuid, so assertions need no regex noise. */
export const AUDIT_CUSTOMER_ID = 'b3f1c2d4-1111-4000-8000-00000000cccc';

/** Fixed record uuid. */
export const AUDIT_RECORD_ID = 'c4e2d3f5-2222-4000-8000-00000000dddd';

/** A row-shaped payload used as the "before" side. */
export const AUDIT_BEFORE_ROW = {
  id: AUDIT_RECORD_ID,
  legal_name: 'Régi Név Kft.',
  tax_number: '12345678-1-42',
  updated_at: '2026-11-22T10:00:00.000Z',
} as const;

/** @returns request facts with every field filled. */
export function buildAuditRequestFacts(
  overrides: Partial<AuditRequestFacts> = {},
): AuditRequestFacts {
  return {
    ipAddress: '10.1.2.3',
    userAgent: 'Mozilla/5.0 (test)',
    requestId: 'req-abc-123',
    source: 'admin_api',
    ...overrides,
  };
}

/** @returns the system actor the provider resolves today. */
export function buildAuditActor(
  overrides: Partial<AuditActor> = {},
): AuditActor {
  return {
    type: 'system',
    id: null,
    name: 'system',
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default update payload.
 * @returns one `update` of a customer legal name.
 */
export function buildAuditWriteInput(
  overrides: Partial<AuditWriteInput> = {},
): AuditWriteInput {
  return {
    customerId: AUDIT_CUSTOMER_ID,
    tableName: 'customers',
    recordId: AUDIT_RECORD_ID,
    operation: 'update',
    before: AUDIT_BEFORE_ROW,
    after: { ...AUDIT_BEFORE_ROW, legal_name: 'Új Név Kft.' },
    ...overrides,
  };
}

/** The repository double: records every row and transaction handle. */
export interface AuditRepositoryMock {
  /** The `insert` the writer calls. */
  readonly insert: (
    row: NewAuditLogRow,
    tx: DatabaseTransaction,
  ) => Promise<void>;

  /** Rows passed to {@link insert}, in call order. */
  readonly calls: readonly NewAuditLogRow[];

  /** Transaction handles passed to {@link insert}, in call order. */
  readonly transactions: readonly DatabaseTransaction[];

  /** Makes the next {@link insert} reject, to prove nothing is swallowed. */
  failNextWith(error: Error): void;
}

/** @returns a repository double that records its calls. */
export function createAuditRepositoryMock(): AuditRepositoryMock {
  const calls: NewAuditLogRow[] = [];
  const transactions: DatabaseTransaction[] = [];
  let pendingFailure: Error | null = null;

  return {
    calls,
    transactions,
    failNextWith(error: Error): void {
      pendingFailure = error;
    },
    insert: (row, tx): Promise<void> => {
      calls.push(row);
      transactions.push(tx);

      if (pendingFailure !== null) {
        const failure = pendingFailure;
        pendingFailure = null;

        return Promise.reject(failure);
      }

      return Promise.resolve();
    },
  };
}

/** The actor-provider double. */
export interface AuditActorProviderMock {
  /** The single method the writer calls. */
  readonly resolve: () => AuditActor;

  /** How many times {@link resolve} ran — "was an actor even asked?" */
  readonly callCount: () => number;
}

/**
 * @param actor - what `resolve()` returns (defaults to the system actor).
 * @returns an actor-provider double that counts its calls.
 */
export function createAuditActorProviderMock(
  actor: AuditActor = buildAuditActor(),
): AuditActorProviderMock {
  let calls = 0;

  return {
    resolve: (): AuditActor => {
      calls += 1;

      return actor;
    },
    callCount: (): number => calls,
  };
}

/**
 * A stand-in transaction handle.
 *
 * The writer only forwards it to the repository, so the specs assert *identity*
 * (the same handle it received) instead of modelling Drizzle's transaction. The
 * single cast is what lets a plain object satisfy the derived type.
 *
 * @returns an object typed as {@link DatabaseTransaction}.
 */
export function createTransactionMock(): DatabaseTransaction {
  return {} as DatabaseTransaction;
}
