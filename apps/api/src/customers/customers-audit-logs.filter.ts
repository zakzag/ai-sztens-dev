/**
 * SQL filter of the customer audit-log read (AIS-178, slice f).
 *
 * A pure description of "which ledger rows", kept out of the repository so the
 * repository stays a thin translation layer — the same split the parent, contacts
 * and activity features use.
 *
 * Three deliberate properties:
 *
 * 1. **`customer_id = $id` is always applied.** The ledger has no foreign keys, so
 *    nothing else would stop a caller from reading another customer's history.
 * 2. **There is no soft-delete branch.** `audit.audit_logs` is append-only: a row
 *    can neither be updated nor deleted, so it has no `deleted_at` and the read
 *    must not grow such a filter.
 * 3. **Every filter rides `audit_logs_customer_occurred_idx`.** The four filters
 *    are equality tests on plain columns plus a range on `occurred_at`, which is
 *    exactly what the index is ordered by; there is no `jsonb` search (`F6`).
 *
 * The page query and the `count(*)` call the **same** function, so
 * `meta.pagination.total` can never count rows the page does not show.
 */

import type {
  AuditLogListQuery,
  AuditLogTable,
  AuditOperation,
} from '@callback/shared';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import { auditLogs } from '../db/schema.js';

/**
 * @param customerId - the customer whose history is read (always applied).
 * @param query - the validated list query (`page`, `limit`, `order` + four filters).
 * @returns the `WHERE` expression (never `undefined`: the customer scope always
 *   applies).
 */
export function auditLogVisibleFilter(
  customerId: string,
  query: AuditLogListQuery,
): SQL {
  const conditions = [
    eq(auditLogs.customerId, customerId),
    tableNameFilter(query.tableName),
    operationFilter(query.operation),
    actorFilter(query.actorId),
    occurredFromFilter(query.from),
    occurredToFilter(query.to),
  ].filter((condition): condition is SQL => condition !== undefined);

  return and(...conditions) ?? eq(auditLogs.customerId, customerId);
}

/**
 * @param tableName - the audited table the caller selected.
 * @returns the equality branch, or `undefined` when the filter is absent.
 */
function tableNameFilter(
  tableName: AuditLogTable | undefined,
): SQL | undefined {
  return tableName === undefined
    ? undefined
    : eq(auditLogs.tableName, tableName);
}

/**
 * @param operation - the audited operation the caller selected.
 * @returns the equality branch, or `undefined` when the filter is absent.
 */
function operationFilter(
  operation: AuditOperation | undefined,
): SQL | undefined {
  return operation === undefined
    ? undefined
    : eq(auditLogs.operation, operation);
}

/**
 * @param actorId - the actor id the caller selected.
 * @returns the equality branch, or `undefined` when the filter is absent.
 */
function actorFilter(actorId: string | undefined): SQL | undefined {
  return actorId === undefined ? undefined : eq(auditLogs.actorId, actorId);
}

/**
 * @param from - the inclusive lower bound of `occurredAt`.
 * @returns the `occurred_at >= from` branch, or `undefined` when absent.
 */
function occurredFromFilter(from: string | undefined): SQL | undefined {
  return from === undefined
    ? undefined
    : gte(auditLogs.occurredAt, new Date(from));
}

/**
 * @param to - the inclusive upper bound of `occurredAt`.
 * @returns the `occurred_at <= to` branch, or `undefined` when absent.
 */
function occurredToFilter(to: string | undefined): SQL | undefined {
  return to === undefined ? undefined : lte(auditLogs.occurredAt, new Date(to));
}
