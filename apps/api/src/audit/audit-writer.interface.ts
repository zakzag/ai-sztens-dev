/**
 * The single entry point that writes the ledger (AIS-177).
 *
 * Every audited write in the application goes through this method — one place
 * to change when the ledger's shape or the actor resolution changes. Consumers
 * depend on this interface (via the `AUDIT_WRITER` token), never on the service
 * class.
 */

import type { DatabaseTransaction } from './audit-transaction.interface.js';
import type { AuditRequestFacts, AuditWriteInput } from './audit.interface.js';

export interface AuditWriter {
  /**
   * Appends one audit row describing a business write.
   *
   * Contract:
   * - the row is written **on `tx`**, so both commit or neither does;
   * - `before`/`after` are narrowed to the changed keys;
   * - an `update` whose diff is empty writes **nothing** (nothing happened);
   * - a failed insert is **not** caught: it must abort the business write.
   *
   * @param input - what was written, and the row before/after.
   * @param tx - the transaction handle of the business write.
   * @param facts - request facts (ip, user agent, request id, source).
   * @throws {import('./audit.errors.js').AuditPayloadIncompleteError} when the
   *   payload cannot describe the operation.
   */
  write(
    input: AuditWriteInput,
    tx: DatabaseTransaction,
    facts: AuditRequestFacts,
  ): Promise<void>;
}
