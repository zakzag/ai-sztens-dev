/**
 * Persistence contract of the customer audit-log read (AIS-178, slice f).
 *
 * **Read-only by construction.** There is no `insert`, `update` or `delete`
 * method here, and that is the point: the ledger is append-only (trigger `0007`
 * refuses `UPDATE`/`DELETE`/`TRUNCATE`), so a write path from this module could
 * never succeed — the absence of the method makes the mistake unexpressible
 * rather than merely unlikely (`F10`).
 *
 * Contract for implementers:
 *
 * - every read is scoped by the customer id;
 * - there is **no** soft-delete filter: the ledger has no `deleted_at`;
 * - the page and the count share one `WHERE`, so `meta.pagination.total` matches
 *   the page.
 */

import type { AuditLogListQuery } from '@callback/shared';
import type { AuditLogPage } from './customers-audit-logs.interface.js';

export interface CustomerAuditLogsRepository {
  /**
   * @param customerId - the parent customer.
   * @returns `true` when a **live** customer owns the id.
   */
  customerExists(customerId: string): Promise<boolean>;

  /**
   * Reads one page of the ledger.
   *
   * @param customerId - the customer whose history is read.
   * @param query - the validated list query (`page`, `limit`, `order` + filters).
   * @returns the rows of the page and the total of the whole result set, both
   *   produced from the **same** `WHERE`.
   */
  findPage(customerId: string, query: AuditLogListQuery): Promise<AuditLogPage>;
}
