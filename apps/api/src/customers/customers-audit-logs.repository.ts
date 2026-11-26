/**
 * Drizzle implementation of {@link CustomerAuditLogsRepository} (AIS-178, slice f).
 *
 * The only file in the feature that imports Drizzle, and it contains **no write
 * statement of any kind**. It receives the shared `DATABASE` handle from
 * `DatabaseModule` (never creates a client) and propagates every failure
 * untouched: there is no business error to classify on a read, so an error here
 * is genuinely a server problem.
 *
 * A note on the order (`F9`): the tie-breaker `id` follows the requested time
 * direction. `id` is the identity sequence, so in `desc` it *is* the append order,
 * and two rows written in the same millisecond keep a stable order across pages.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogListQuery } from '@callback/shared';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { auditLogs, customers } from '../db/schema.js';
import { customerNotDeletedFilter } from './customers.filter.js';
import type { AuditLogPage } from './customers-audit-logs.interface.js';
import { auditLogVisibleFilter } from './customers-audit-logs.filter.js';
import type { CustomerAuditLogsRepository } from './customers-audit-logs.repository.interface.js';

/**
 * Postgres-backed reader of `audit.audit_logs`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomerAuditLogsRepository(db);
 * const page = await repository.findPage(customerId, query);
 * ```
 */
@Injectable()
export class DrizzleCustomerAuditLogsRepository implements CustomerAuditLogsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomerAuditLogsRepository.customerExists} */
  async customerExists(customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), customerNotDeletedFilter()))
      .limit(1);

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerAuditLogsRepository.findPage} */
  async findPage(
    customerId: string,
    query: AuditLogListQuery,
  ): Promise<AuditLogPage> {
    // One expression for the count and the page query, so the two can never
    // disagree about the result set.
    const where = auditLogVisibleFilter(customerId, query);
    const direction = query.order === 'asc' ? asc : desc;

    const [counted, rows] = await Promise.all([
      this.db.select({ total: count() }).from(auditLogs).where(where),
      this.db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(
          direction(auditLogs.occurredAt),
          // The tie-breaker of `F9`: it follows the time direction, so the append
          // order and the time order never contradict each other.
          direction(auditLogs.id),
        )
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ]);

    return {
      rows,
      total: Number(counted[0]?.total ?? 0),
    };
  }
}
