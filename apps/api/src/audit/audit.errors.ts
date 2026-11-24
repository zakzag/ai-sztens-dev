/**
 * Domain errors of the audit module (AIS-177).
 *
 * Both are **programmer** errors, not user-facing ones: they mean a service
 * called the writer with a payload that cannot describe the operation it
 * claims. They therefore carry no HTTP status and never reach the API
 * exception filter — a request that triggers one deserves a `500`, because the
 * bug is in our code, not in the input.
 */

import type { AuditOperation } from '@callback/shared';

/** Base class, so a consumer can catch "any audit misuse" in one clause. */
export abstract class AuditError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The `before` / `after` pair does not match the operation.
 *
 * `insert` needs `after`, `delete` and `soft_delete` need `before`, `update`
 * needs both. Anything else would either log a change that cannot be
 * reconstructed, or fabricate one.
 */
export class AuditPayloadIncompleteError extends AuditError {
  /**
   * @param operation - the operation whose payload is incoherent.
   * @param detail - which side is missing, for the log line.
   */
  constructor(
    readonly operation: AuditOperation,
    readonly detail: string,
  ) {
    super(`audit payload cannot describe "${operation}": ${detail}`);
  }
}
