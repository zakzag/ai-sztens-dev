/**
 * Narrowing helpers for the database failures the customer-user writes can cause
 * (AIS-178, slice e).
 *
 * The decision itself — "is this a `23505`/`23503` on **this** constraint?" —
 * lives in [`db/postgres-error.logic.ts`](../db/postgres-error.logic.ts), because
 * it is the same question for every resource. This file only names the
 * constraints the customer-user feature cares about.
 *
 * Every guard must stay **narrow**: any other violation has to fall through
 * unchanged and become a `500`, never a fabricated business answer.
 */

import {
  PG_FOREIGN_KEY_VIOLATION_CODE,
  PG_UNIQUE_VIOLATION_CODE,
  findPostgresError,
} from '../db/postgres-error.logic.js';
import {
  CUSTOMER_OWNER_CONSTRAINT,
  CUSTOMER_USER_ACTIVITY_FK_CONSTRAINT,
  CUSTOMER_USER_CONTACT_FK_CONSTRAINT,
  CUSTOMER_USER_EMAIL_CONSTRAINT,
} from './customers-users.const.js';

/**
 * @param error - value caught around the user write.
 * @returns `true` when `customer_users_email_key` rejected it.
 */
export function isCustomerUserEmailConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: CUSTOMER_USER_EMAIL_CONSTRAINT,
  });
}

/**
 * @param error - value caught around the user write.
 * @returns `true` when `customer_users_customer_owner_key` rejected it, i.e. the
 *   write would have created a second **active owner**.
 */
export function isCustomerOwnerConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: CUSTOMER_OWNER_CONSTRAINT,
  });
}

/**
 * @param error - value caught around the user delete.
 * @returns `true` when a contact or an activity still references the row.
 */
export function isCustomerUserInUse(error: unknown): boolean {
  return (
    findPostgresError(error, {
      code: PG_FOREIGN_KEY_VIOLATION_CODE,
      constraintName: CUSTOMER_USER_CONTACT_FK_CONSTRAINT,
    }) ||
    findPostgresError(error, {
      code: PG_FOREIGN_KEY_VIOLATION_CODE,
      constraintName: CUSTOMER_USER_ACTIVITY_FK_CONSTRAINT,
    })
  );
}
