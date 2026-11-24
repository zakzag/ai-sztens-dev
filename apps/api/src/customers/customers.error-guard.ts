/**
 * Narrowing helpers that turn an `unknown` driver error into a decision
 * (AIS-178).
 *
 * The decision itself — “is this a `23505` on **this** constraint?” — lives in
 * [`db/postgres-error.logic.ts`](../db/postgres-error.logic.ts), because it is
 * the same question for every resource. This file only names the two constraints
 * the `customers` feature cares about, so the repository reads as
 * `if (isCustomerTaxNumberConflict(error))` instead of carrying the SQLSTATE and
 * the index name inline.
 *
 * Both guards must stay **narrow**: a `23505` from any other constraint (or from
 * a future one) has to fall through unchanged and become a `500`, never a
 * fabricated business conflict.
 */

import {
  PG_UNIQUE_VIOLATION_CODE,
  findPostgresError,
} from '../db/postgres-error.logic.js';
import {
  CUSTOMER_NUMBER_CONSTRAINT,
  CUSTOMER_TAX_NUMBER_CONSTRAINT,
} from './customers.const.js';

/**
 * @param error - value caught around the write.
 * @returns `true` when `customers_customer_number_key` rejected it.
 */
export function isCustomerNumberConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: CUSTOMER_NUMBER_CONSTRAINT,
  });
}

/**
 * @param error - value caught around the write.
 * @returns `true` when the partial `customers_tax_number_key` index rejected it.
 */
export function isCustomerTaxNumberConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: CUSTOMER_TAX_NUMBER_CONSTRAINT,
  });
}
