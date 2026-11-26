/**
 * Drizzle implementation of {@link AuditRepository} (AIS-177).
 *
 * The only file in the module that builds SQL. It receives the **transaction
 * handle** from the caller and never the connection pool: that is what makes
 * "the audit row and the business row commit together" a property of the
 * signature rather than a convention.
 *
 * No `RETURNING`, no error translation: the insert either happens or it throws,
 * and a throw is exactly the signal the caller needs.
 */

import { Injectable } from '@nestjs/common';
import { auditLogs } from '../db/schema.js';
import type { NewAuditLogRow } from '../db/schema.js';
import type { DatabaseTransaction } from './audit-transaction.interface.js';
import type { AuditRepository } from './audit.repository.interface.js';

/** Postgres-backed writer of `audit.audit_logs`. */
@Injectable()
export class DrizzleAuditRepository implements AuditRepository {
  /** {@inheritDoc AuditRepository.insert} */
  async insert(row: NewAuditLogRow, tx: DatabaseTransaction): Promise<void> {
    await tx.insert(auditLogs).values(row);
  }
}
