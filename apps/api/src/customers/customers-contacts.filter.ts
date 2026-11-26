/**
 * SQL filters of the contacts list (AIS-178, slice d).
 *
 * Pure descriptions of "which rows", kept out of the repository so the repository
 * stays a thin translation layer — the same split the parent feature uses.
 *
 * Visibility has two parts, and both are load-bearing:
 *
 * - `customer_id = $id` — a contact is only ever reachable **inside its own
 *   customer**; guessing a uuid must not cross that boundary;
 * - `deleted_at IS NULL` — a soft-deleted contact is gone from every read.
 *
 * Both the page query and the `count(*)` call {@link contactVisibleFilter}, so
 * `meta.pagination.total` can never count rows the page does not show.
 */

import type { ListQuery } from '@callback/shared';
import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { contacts } from '../db/schema.js';

/**
 * The `?q=` filter: a case-insensitive substring match on the three columns an
 * operator searches a contact list by.
 *
 * @param term - the trimmed search term from the validated list query.
 * @returns the `WHERE` branch, or `undefined` when there is no search term.
 */
export function contactSearchFilter(term: string | undefined): SQL | undefined {
  if (term === undefined || term.length === 0) {
    return undefined;
  }

  const pattern = `%${term}%`;

  return or(
    ilike(contacts.name, pattern),
    ilike(contacts.email, pattern),
    ilike(contacts.phone, pattern),
  );
}

/**
 * The soft-delete filter: only contacts that were never archived.
 *
 * @returns the `deleted_at IS NULL` expression.
 */
export function contactNotDeletedFilter(): SQL {
  return isNull(contacts.deletedAt);
}

/**
 * The complete `WHERE` of a contacts read.
 *
 * @param customerId - the customer the contacts belong to (always applied).
 * @param query - the validated list query (`q` is the only filter).
 * @returns the `WHERE` expression (never `undefined`: both scopes always apply).
 */
export function contactVisibleFilter(
  customerId: string,
  query: ListQuery,
): SQL {
  const conditions = [
    eq(contacts.customerId, customerId),
    contactNotDeletedFilter(),
    contactSearchFilter(query.q),
  ].filter((condition): condition is SQL => condition !== undefined);

  return and(...conditions) ?? eq(contacts.customerId, customerId);
}
