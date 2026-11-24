/**
 * Value shapes of the audit module (AIS-177).
 *
 * Types only — no Nest, no Drizzle, no Fastify import. Everything here is what a
 * *domain* service needs to describe one audited write, which is why the writer
 * and the diff logic can both be unit-tested with plain objects.
 */

import type { AuditOperation, AuditSource, AuthorType } from '@callback/shared';
import type { AUDIT_TABLE_NAMES } from './audit.const.js';

/** One audited table (see {@link AUDIT_TABLE_NAMES}). */
export type AuditTableName = (typeof AUDIT_TABLE_NAMES)[number];

/**
 * One audited write.
 *
 * `before` / `after` are the **whole** row (or the changed projection the
 * caller has at hand) — the writer narrows them to the changed keys. The same
 * shape describes all four operations, which is what lets the writer validate
 * that the pair is coherent with the operation.
 */
export interface AuditWriteInput {
  /** The customer the row belongs to; `null` for rows with no customer. */
  readonly customerId: string | null;

  /** Which table was written. */
  readonly tableName: AuditTableName;

  /** Primary key of the row; `null` for a composite-key join row. */
  readonly recordId: string | null;

  /** What happened. */
  readonly operation: AuditOperation;

  /** Row before the write: required for `update`, `delete`, `soft_delete`. */
  readonly before: Readonly<Record<string, unknown>> | null;

  /** Row after the write: required for `insert` and `update`. */
  readonly after: Readonly<Record<string, unknown>> | null;
}

/** Who performed the audited write. */
export interface AuditActor {
  /** `operator` / `customer_user` / `system` / `api_key`. */
  readonly type: AuthorType;

  /**
   * The actor's id, or `null` when the type carries no id (`system`).
   *
   * Deliberately **not** a foreign key in the database: the log must survive the
   * deletion of the actor it names.
   */
  readonly id: string | null;

  /** Snapshot of the actor's display name, so the row stays readable. */
  readonly name: string;
}

/**
 * Request facts stored next to the change.
 *
 * Collected by a pure helper from the raw request (`toAuditRequestFacts`), never
 * read by the writer itself — that keeps the writer free of HTTP concerns.
 */
export interface AuditRequestFacts {
  /** Client address; `null` when unknown or unusable for `inet`. */
  readonly ipAddress: string | null;

  /** Raw `user-agent` header, clipped to the contract limit. */
  readonly userAgent: string | null;

  /** The envelope's correlation id. */
  readonly requestId: string | null;

  /** Which entry point produced the change. */
  readonly source: AuditSource | null;
}

/**
 * The narrowed payload of one audited write.
 *
 * `before` / `after` hold only the keys that actually changed; `changedKeys` is
 * exposed so a caller (or a log line) can report *what* moved without diffing
 * the payload again.
 */
export interface AuditDiff {
  /** Changed keys of the previous row, or `null` when there was no row. */
  readonly before: Readonly<Record<string, unknown>> | null;

  /** Changed keys of the new row, or `null` when the row is gone. */
  readonly after: Readonly<Record<string, unknown>> | null;

  /** Names of the keys that differ, in the union order of both payloads. */
  readonly changedKeys: readonly string[];

  /** `true` when at least one key differs. */
  readonly hasChanges: boolean;
}
