/**
 * Pure mapping of the audit ledger (AIS-178, slice f).
 *
 * Row → wire payload and nothing else: there is **no** input mapper, because the
 * ledger has no request schema and accepts no write from this module. That
 * asymmetry is deliberate — the read path cannot grow a write path by accident.
 *
 * Two details worth knowing:
 *
 * - `id` is a `bigint` identity with `mode: 'number'`, so it crosses the wire as a
 *   plain number (the contract says `z.number().int().nonnegative()`);
 * - `beforeData` / `afterData` are `jsonb` and nullable, narrowed through the
 *   shared {@link toJsonRecord} helper so the response always satisfies the
 *   contract's `z.record(z.unknown()) | null`.
 */

import type { AuditLog } from '@callback/shared';
import type { AuditLogRow } from '../db/schema.js';
import { toJsonRecord } from './customers-json.logic.js';

/**
 * Maps a stored ledger row to the wire payload.
 *
 * @param row - the row as read from `audit.audit_logs`.
 * @returns the `AuditLog` payload (`Date` → ISO 8601, `jsonb` → record).
 */
export function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    customerId: row.customerId,
    tableName: row.tableName,
    recordId: row.recordId,
    operation: row.operation,
    beforeData: toJsonRecord(row.beforeData),
    afterData: toJsonRecord(row.afterData),
    actorType: row.actorType,
    actorId: row.actorId,
    actorName: row.actorName,
    occurredAt: row.occurredAt.toISOString(),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestId: row.requestId,
    source: row.source,
  };
}
