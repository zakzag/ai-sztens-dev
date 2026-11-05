/**
 * Errors of the registry ⇄ service coverage gate (AIS-110).
 *
 * A malformed `operationId` is not a “gap”: it means the registry itself violates
 * the `<namespace>.<action>` convention, so the gate cannot even form an
 * expectation. Reporting that as a missing method would hide the real problem, so
 * it gets its own type and fails loudly.
 */

/** Why an `operationId` cannot be split into namespace and method. */
export type InvalidOperationIdReason =
  'missing-separator' | 'empty-segment' | 'extra-segments';

/**
 * Thrown when an `operationId` does not follow `<namespace>.<action>`.
 *
 * `reason` is part of the message and of the instance, so a failing gate names
 * both the offending id and the exact way it is malformed.
 */
export class InvalidOperationIdError extends Error {
  /** The id that could not be split. */
  readonly operationId: string;

  /** The convention rule the id violates. */
  readonly reason: InvalidOperationIdReason;

  /**
   * @param operationId - the registry key as written.
   * @param reason - which part of the convention is violated.
   */
  constructor(operationId: string, reason: InvalidOperationIdReason) {
    super(
      `Operation id "${operationId}" is not "<namespace>.<action>" (${reason}).`,
    );
    this.name = 'InvalidOperationIdError';
    this.operationId = operationId;
    this.reason = reason;
  }
}
