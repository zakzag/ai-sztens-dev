/**
 * Pure business rules of the `customers` feature (AIS-178).
 *
 * "Pure" is the point: a rule that decides what a customer number looks like, or
 * whether a row is incomplete, must not read the clock itself — otherwise every
 * test would need fake timers and the rule would silently depend on the machine.
 * `now` is always a parameter.
 *
 * No Nest, no Drizzle, no I/O — which is also why this file can be imported by a
 * script or a worker without dragging the HTTP stack along.
 */

import type { CustomerStatus } from '@callback/shared';
import { CUSTOMER_NUMBER_SEQUENCE_MAX } from './customers.const.js';
import { CustomerNumberExhaustedError } from './customers.errors.js';
import type { CustomerStatusPatch } from './customers.interface.js';

/** Number of digits the monthly sequence occupies (`AIS-YYYYMM-NNN`). */
const SEQUENCE_LENGTH = 3;

/**
 * Builds the month prefix of a customer number.
 *
 * UTC is used on purpose: the timestamps of a row are stored in UTC, and two
 * servers in different zones must agree on which month a number belongs to, or
 * the same sequence would be allocated twice.
 *
 * @param now - reference instant, injected so the caller owns the clock.
 * @returns the prefix, e.g. `AIS-202611-` for November 2026.
 */
export function toCustomerNumberPrefix(now: Date): string {
  const year = now.getUTCFullYear().toString().padStart(4, '0');
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');

  return `AIS-${year}${month}-`;
}

/**
 * Computes the next customer number of a month.
 *
 * @param prefix - the month prefix from {@link toCustomerNumberPrefix}.
 * @param currentMax - the stored maximum of the month, or `null` when empty.
 * @returns the next number, e.g. `AIS-202611-002` after `…-001`.
 * @throws {CustomerNumberExhaustedError} when the stored maximum does not carry
 *   a numeric sequence, or when the sequence would exceed `999` — the format has
 *   to grow before another customer can be created in that month. Both are data
 *   integrity signals, not user mistakes.
 */
export function toNextCustomerNumber(
  prefix: string,
  currentMax: string | null,
): string {
  if (currentMax === null) {
    return `${prefix}${'1'.padStart(SEQUENCE_LENGTH, '0')}`;
  }

  const suffix = currentMax.startsWith(prefix)
    ? currentMax.slice(prefix.length)
    : '';

  if (suffix.length !== SEQUENCE_LENGTH || !/^\d+$/.test(suffix)) {
    throw new CustomerNumberExhaustedError(
      prefix,
      `the stored maximum "${currentMax}" is not of the format ${prefix}NNN`,
    );
  }

  const next = Number.parseInt(suffix, 10) + 1;

  if (next > CUSTOMER_NUMBER_SEQUENCE_MAX) {
    throw new CustomerNumberExhaustedError(
      prefix,
      `sequence ${suffix} is the last value of the month (max ${CUSTOMER_NUMBER_SEQUENCE_MAX})`,
    );
  }

  return `${prefix}${next.toString().padStart(SEQUENCE_LENGTH, '0')}`;
}

/**
 * Decides whether a customer row is “incomplete”.
 *
 * The flag exists so the admin list can highlight the prospects that were
 * registered before their data was known (AIS-16 `D1`). Two fields make a row
 * incomplete, and both are the ones an invoice or a contract cannot live
 * without: the tax number and the registered postal code.
 *
 * An empty string counts as missing: the request schemas trim and reject it, but
 * a hand-written `INSERT` could still leave one, and “blank” is not “known”.
 *
 * @param row - the two fields the flag depends on.
 * @returns `true` when at least one of them is absent or blank.
 */
export function hasMissingData(row: {
  readonly taxNumber: string | null;
  readonly registeredAddressZip: string | null;
}): boolean {
  return !isFilled(row.taxNumber) || !isFilled(row.registeredAddressZip);
}

/** @returns `true` when the value is a non-empty, non-blank string. */
function isFilled(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

/**
 * Builds the column subset a status change writes.
 *
 * `status` and `status_changed_at` move together, always: the column's whole
 * purpose is to answer “since when is this customer in this state”, and a
 * service that forgot the second half would leave a timestamp that contradicts
 * the status. Returning both from one function makes that forgetting impossible.
 *
 * @param status - the validated target status.
 * @param now - reference instant, injected so the caller owns the clock.
 * @returns the two columns to write.
 */
export function toStatusPatch(
  status: CustomerStatus,
  now: Date,
): CustomerStatusPatch {
  return { status, statusChangedAt: now };
}
