/**
 * Narrowing helpers for the two database failures the contact writes can cause
 * (AIS-178, slice d).
 *
 * The decision itself — "is this a `23505`/`23503` on **this** constraint?" —
 * lives in [`db/postgres-error.logic.ts`](../db/postgres-error.logic.ts), because
 * it is the same question for every resource. This file only names the
 * constraints the contacts feature cares about, so the repository reads as
 * `if (isPrimaryContactConflict(error))` instead of carrying SQLSTATEs inline.
 *
 * Both guards must stay **narrow**: any other violation has to fall through
 * unchanged and become a `500`, never a fabricated business answer.
 */

import {
  PG_FOREIGN_KEY_VIOLATION_CODE,
  PG_UNIQUE_VIOLATION_CODE,
  findPostgresError,
} from '../db/postgres-error.logic.js';
import {
  CONTACT_PRIMARY_ROLE_CONSTRAINT,
  CONTACT_USER_FK_CONSTRAINT,
} from './customers-contacts.const.js';

/**
 * @param error - value caught around the role write.
 * @returns `true` when `contact_roles_primary_key` rejected it.
 */
export function isPrimaryContactConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: CONTACT_PRIMARY_ROLE_CONSTRAINT,
  });
}

/**
 * @param error - value caught around the contact write.
 * @returns `true` when `contacts_customer_user_id_fkey` rejected it.
 */
export function isContactUserMismatch(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_FOREIGN_KEY_VIOLATION_CODE,
    constraintName: CONTACT_USER_FK_CONSTRAINT,
  });
}
