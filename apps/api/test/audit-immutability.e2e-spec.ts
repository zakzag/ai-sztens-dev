import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { SystemAuditActorProvider } from '../src/audit/audit-actor.provider.js';
import { toAuditRequestFacts } from '../src/audit/audit-request.logic.js';
import { DrizzleAuditRepository } from '../src/audit/audit.repository.js';
import type { DatabaseTransaction } from '../src/audit/audit-transaction.interface.js';
import { AuditWriterService } from '../src/audit/audit-writer.service.js';
import { resolveDatabaseUrl } from '../src/db/database-url.js';
import type { Database } from '../src/db/database.interface.js';
import * as schema from '../src/db/schema.js';
import {
  activities,
  auditLogs,
  customers,
  customerUsers,
  operators,
} from '../src/db/schema.js';
import { DATABASE_SKIP_REASON, probeDatabase } from './lib/database-gate.js';

/**
 * The AIS-177 invariants that only a real Postgres can prove.
 *
 * Everything asserted here is enforced by the **database**, not by the API:
 *
 * - `activities_author_reference_check` rejects a contradictory author pair and
 *   accepts all four legitimate branches (including `api_key`, which the Jira
 *   ticket did not list but the frozen contract has);
 * - the append-only triggers reject `UPDATE`, `DELETE` **and** `TRUNCATE` on
 *   `audit.audit_logs` — a plain `GRANT` cannot do that, because the app role
 *   owns the table (finding `F2` of the AIS-14 plan);
 * - the business row and its audit row share one transaction, so a rolled-back
 *   write leaves no audit trace and a rejected audit insert kills the write.
 *
 * **Every test rolls back.** The ledger is append-only by design, so a test that
 * committed would leave unremovable rows in the developer's database; instead a
 * sentinel error ends each transaction and the assertions about persistence run
 * afterwards, from outside. Statements that are *expected* to fail run in a
 * nested transaction (a savepoint), so an aborted statement cannot poison the
 * outer one.
 *
 * Same gating rule as the other persistence suites: without a reachable
 * `DATABASE_URL` the suite warns loudly and self-skips.
 */

/** Sentinel thrown to roll a test transaction back on purpose. */
const ROLLBACK = new Error('audit-e2e-rollback');

let client: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;
let skipReason: string | null = null;

/** @returns the connected handle, or throws when the suite is skipped. */
function requireDb(): Database {
  if (db === null) {
    throw new Error(`suite skipped: ${skipReason ?? 'database unavailable'}`);
  }

  return db;
}

/**
 * Runs a body inside a transaction that always rolls back.
 *
 * @param body - assertions and writes to execute.
 */
async function inRolledBackTransaction(
  body: (tx: DatabaseTransaction) => Promise<void>,
): Promise<void> {
  try {
    await requireDb().transaction(async (tx) => {
      await body(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) {
      throw error;
    }
  }
}

/**
 * Flattens an error and its `cause` chain into one searchable string.
 *
 * Drizzle wraps every driver failure: the top-level message is
 * `Failed query: <sql>` and the Postgres detail (constraint name, trigger
 * message) sits in `cause`. Asserting on the top-level message alone would
 * therefore assert nothing useful — this helper is what makes the assertions
 * below about Postgres rather than about Drizzle's formatting.
 *
 * @param error - the rejection reason.
 * @returns the concatenated messages of the whole chain.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current !== undefined; depth += 1) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
      current = (current as { cause?: unknown }).cause;
      continue;
    }

    // A non-`Error` throw (a string, a plain object) still has to be findable;
    // `JSON.stringify` keeps it readable without falling back to
    // `"[object Object]"`, which would make the assertion meaningless.
    parts.push(JSON.stringify(current) ?? '[unserialisable rejection]');
    break;
  }

  return parts.join(' <- ');
}

/**
 * Asserts that a promise rejects with a message (or a cause) matching the
 * pattern. Never throws on a fulfilled promise — it fails the test.
 *
 * @param promise - the operation expected to fail.
 * @param pattern - expected fragment of the error chain.
 */
async function expectRejection(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).not.toBeNull();
  expect(describeError(error)).toMatch(pattern);
}

/**
 * Asserts that one statement is rejected, without aborting the outer
 * transaction: the statement runs in its own savepoint.
 *
 * @param tx - the surrounding transaction.
 * @param statement - the SQL to attempt.
 * @param pattern - expected fragment of the error chain.
 */
async function expectRejected(
  tx: DatabaseTransaction,
  statement: ReturnType<typeof sql>,
  pattern: RegExp,
): Promise<void> {
  await expectRejection(
    tx.transaction(async (inner) => {
      await inner.execute(statement);
    }),
    pattern,
  );
}

/** A customer number that cannot collide with real data. */
function buildCustomerNumber(): string {
  return `AIS-E2E-${randomUUID().slice(0, 8)}`;
}

/**
 * Creates the rows every activity needs (customer, operator, customer user).
 *
 * @param tx - the test transaction.
 * @returns the three ids.
 */
async function seedParents(
  tx: DatabaseTransaction,
): Promise<{ customerId: string; operatorId: string; customerUserId: string }> {
  const [customer] = await tx
    .insert(customers)
    .values({
      customerNumber: buildCustomerNumber(),
      type: 'company',
      legalName: 'AIS-177 E2E Kft.',
      status: 'active',
    })
    .returning();

  if (customer === undefined) {
    throw new Error('customer insert returned no row');
  }

  const [operator] = await tx
    .insert(operators)
    .values({
      name: 'E2E Operator',
      email: `e2e-operator-${randomUUID()}@example.test`,
      role: 'operator',
    })
    .returning();

  if (operator === undefined) {
    throw new Error('operator insert returned no row');
  }

  const [customerUser] = await tx
    .insert(customerUsers)
    .values({
      customerId: customer.id,
      name: 'E2E User',
      email: `e2e-user-${randomUUID()}@example.test`,
      role: 'member',
      status: 'active',
    })
    .returning();

  if (customerUser === undefined) {
    throw new Error('customer user insert returned no row');
  }

  return {
    customerId: customer.id,
    operatorId: operator.id,
    customerUserId: customerUser.id,
  };
}

beforeAll(async () => {
  if (process.env['DATABASE_URL'] === undefined) {
    skipReason = DATABASE_SKIP_REASON;
    console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);
    return;
  }

  let url: string;

  try {
    url = resolveDatabaseUrl();
  } catch (error) {
    skipReason = `${DATABASE_SKIP_REASON} (${error instanceof Error ? error.message : String(error)})`;
    console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);
    return;
  }

  client = postgres(url, { max: 1, onnotice: () => undefined });
  const handle = drizzle(client, { schema });

  if ((await probeDatabase(handle)) === false) {
    skipReason = DATABASE_SKIP_REASON;
    console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);
    await client.end({ timeout: 5 });
    client = null;
    return;
  }

  db = handle;
});

afterAll(async () => {
  if (client !== null) {
    await client.end({ timeout: 5 });
  }
});

describe('activities author reference', () => {
  it('accepts all four author branches', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);

      const base = { customerId: parents.customerId, body: 'E2E' } as const;

      await tx.insert(activities).values([
        { ...base, type: 'system', authorType: 'system', authorName: 'system' },
        {
          ...base,
          type: 'note',
          authorType: 'operator',
          operatorId: parents.operatorId,
          authorName: 'Operator',
        },
        {
          ...base,
          type: 'note',
          authorType: 'customer_user',
          customerUserId: parents.customerUserId,
          authorName: 'Customer user',
        },
        {
          ...base,
          type: 'call',
          authorType: 'api_key',
          authorName: 'Vapi',
        },
      ]);

      const stored = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.customerId, parents.customerId));

      expect(stored).toHaveLength(4);
    });
  });

  it('rejects a system author that carries an operator id', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);

      await expectRejection(
        tx.insert(activities).values({
          customerId: parents.customerId,
          type: 'system',
          body: 'contradiction',
          authorType: 'system',
          operatorId: parents.operatorId,
          authorName: 'system',
        }),
        /activities_author_reference_check/,
      );
    });
  });

  it('rejects an operator author without an operator id', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);

      await expectRejection(
        tx.insert(activities).values({
          customerId: parents.customerId,
          type: 'note',
          body: 'contradiction',
          authorType: 'operator',
          authorName: 'Operator',
        }),
        /activities_author_reference_check/,
      );
    });
  });

  it('rejects a customer_user author that points at an operator', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);

      await expectRejection(
        tx.insert(activities).values({
          customerId: parents.customerId,
          type: 'note',
          body: 'contradiction',
          authorType: 'customer_user',
          operatorId: parents.operatorId,
          authorName: 'Customer user',
        }),
        /activities_author_reference_check/,
      );
    });
  });
});

describe('activities soft delete', () => {
  it('keeps the row but drops it from the live feed filter', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);
      const [activity] = await tx
        .insert(activities)
        .values({
          customerId: parents.customerId,
          type: 'note',
          body: 'soft-deleted later',
          authorType: 'system',
          authorName: 'system',
        })
        .returning();

      if (activity === undefined) {
        throw new Error('activity insert returned no row');
      }

      await tx
        .update(activities)
        .set({ deletedAt: new Date() })
        .where(eq(activities.id, activity.id));

      const live = await tx.execute(
        sql`select count(*)::int as count from activity.activities
            where customer_id = ${parents.customerId} and deleted_at is null`,
      );
      const all = await tx.execute(
        sql`select count(*)::int as count from activity.activities
            where customer_id = ${parents.customerId}`,
      );

      expect(live[0]?.['count']).toBe(0);
      expect(all[0]?.['count']).toBe(1);
    });
  });
});

describe('audit ledger immutability', () => {
  it('rejects UPDATE, DELETE and TRUNCATE on a stored row', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    await inRolledBackTransaction(async (tx) => {
      const [row] = await tx
        .insert(auditLogs)
        .values({
          tableName: 'customers',
          operation: 'insert',
          actorType: 'system',
          actorName: 'system',
          requestId: `audit-e2e-${randomUUID()}`,
        })
        .returning({ id: auditLogs.id });

      if (row === undefined) {
        throw new Error('audit insert returned no row');
      }

      await expectRejected(
        tx,
        sql`update audit.audit_logs set actor_name = 'tampered' where id = ${row.id}`,
        /append-only/,
      );
      await expectRejected(
        tx,
        sql`delete from audit.audit_logs where id = ${row.id}`,
        /append-only/,
      );
      await expectRejected(
        tx,
        sql`truncate table audit.audit_logs`,
        /append-only/,
      );

      // The row is still there and untouched after all three attempts.
      const stored = await tx
        .select({ actorName: auditLogs.actorName })
        .from(auditLogs)
        .where(eq(auditLogs.id, row.id));

      expect(stored).toEqual([{ actorName: 'system' }]);
    });
  });
});

describe('AuditWriter on a real transaction', () => {
  /** @returns the writer under test, wired like `AuditModule` wires it. */
  function buildWriter(): AuditWriterService {
    return new AuditWriterService(
      new DrizzleAuditRepository(),
      new SystemAuditActorProvider(),
    );
  }

  it('writes the ledger row on the same transaction as the business row', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    const requestId = `audit-e2e-${randomUUID()}`;
    const writer = buildWriter();
    const facts = toAuditRequestFacts(
      { headers: { 'user-agent': 'audit-e2e' }, ip: '127.0.0.1' },
      requestId,
    );

    await inRolledBackTransaction(async (tx) => {
      const parents = await seedParents(tx);

      await tx.insert(activities).values({
        customerId: parents.customerId,
        type: 'note',
        body: 'audited note',
        authorType: 'system',
        authorName: 'system',
      });

      await writer.write(
        {
          customerId: parents.customerId,
          tableName: 'activities',
          recordId: null,
          operation: 'insert',
          before: null,
          after: { type: 'note', body: 'audited note' },
        },
        tx,
        facts,
      );

      const stored = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.requestId, requestId));

      expect(stored).toHaveLength(1);
      expect(stored[0]?.operation).toBe('insert');
      expect(stored[0]?.afterData).toEqual({
        type: 'note',
        body: 'audited note',
      });
      expect(stored[0]?.beforeData).toBeNull();
      expect(stored[0]?.ipAddress).toBe('127.0.0.1');
      expect(stored[0]?.source).toBe('admin_api');
    });

    // The rollback above proves the row did not survive on its own.
    const leftovers = await requireDb()
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.requestId, requestId));

    expect(leftovers).toHaveLength(0);
  });

  it('leaves no audit row when the business write rolls back', async () => {
    if (db === null) {
      console.warn(`[audit-immutability.e2e-spec] ${skipReason}`);

      return;
    }

    const requestId = `audit-e2e-${randomUUID()}`;
    const writer = buildWriter();
    const facts = toAuditRequestFacts({ headers: {}, ip: null }, requestId);
    const failure = new Error('business write failed after the audit row');

    await expect(
      requireDb().transaction(async (tx) => {
        const parents = await seedParents(tx);

        await writer.write(
          {
            customerId: parents.customerId,
            tableName: 'customers',
            recordId: parents.customerId,
            operation: 'insert',
            before: null,
            after: { legalName: 'AIS-177 E2E Kft.' },
          },
          tx,
          facts,
        );

        throw failure;
      }),
    ).rejects.toBe(failure);

    const leftovers = await requireDb()
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.requestId, requestId));

    expect(leftovers).toHaveLength(0);
  });
});
