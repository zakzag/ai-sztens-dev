/**
 * Persistence contract of the audit ledger (AIS-177).
 *
 * One method, on purpose: the ledger is **append-only**, so the only promise it
 * can make is "this row is now stored". There is no update, no delete and no
 * read here — reads belong to the `customers` module (`GET /:id/audit-logs`,
 * AIS-178), which owns the list contract.
 *
 * The `tx` parameter is not optional: an audit row written outside the business
 * transaction could survive a rolled-back change, or vanish after a committed
 * one. Making the handle a required argument turns that mistake into a type
 * error instead of an incident.
 */

import type { NewAuditLogRow } from '../db/schema.js';
import type { DatabaseTransaction } from './audit-transaction.interface.js';

export interface AuditRepository {
  /**
   * Appends one row to `audit.audit_logs`.
   *
   * @param row - the fully resolved row (diff, actor, request facts included).
   * @param tx - the transaction of the business write this row describes.
   * @throws whatever the driver throws, unchanged: a rejected insert must roll
   *   the business write back, so swallowing it would defeat the whole design.
   */
  insert(row: NewAuditLogRow, tx: DatabaseTransaction): Promise<void>;
}
