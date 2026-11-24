/**
 * Narrowing helper for the one database failure the tag writes can cause
 * (AIS-178, slice e).
 *
 * The decision itself — "is this a `23505` on **this** constraint?" — lives in
 * [`db/postgres-error.logic.ts`](../db/postgres-error.logic.ts), because it is the
 * same question for every resource. This file only names the constraint the tags
 * feature cares about, so the repository reads as `if (isTagNameConflict(error))`
 * instead of carrying SQLSTATEs inline.
 *
 * The guard must stay **narrow**: any other violation has to fall through
 * unchanged and become a `500`, never a fabricated business answer.
 */

import {
  PG_UNIQUE_VIOLATION_CODE,
  findPostgresError,
} from '../db/postgres-error.logic.js';
import { TAG_NAME_CONSTRAINT } from './customers-tags.const.js';

/**
 * @param error - value caught around the tag insert.
 * @returns `true` when `tags_name_key` rejected it, i.e. the label already
 *   exists and can be reused.
 */
export function isTagNameConflict(error: unknown): boolean {
  return findPostgresError(error, {
    code: PG_UNIQUE_VIOLATION_CODE,
    constraintName: TAG_NAME_CONSTRAINT,
  });
}
