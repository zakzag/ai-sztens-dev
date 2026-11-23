/**
 * SQL filters of the `customers` feature (AIS-178).
 *
 * Kept out of the repository class on purpose: a filter is a *pure* description
 * of "which rows", it has no state and no dependency, and the repository should
 * stay a thin translation layer between the interface and Drizzle.
 *
 * Two questions are answered here, and they must never be mixed:
 *
 * - {@link customerNotDeletedFilter} — *whether a row is visible at all*;
 * - {@link customerVisibleFilter} — *which* visible rows the caller asked for
 *   (search term + the four optional filters).
 *
 * The second one composes the first, and **both** the page query and the
 * `count(*)` call it, so `meta.pagination.total` can never count rows the page
 * does not show.
 */

import type { CustomerListQuery } from '@callback/shared';
import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { customers } from '../db/schema.js';

/**
 * The `?q=` filter: a case-insensitive substring match on the **three** columns
 * an operator actually searches by (AIS-178 `§5`).
 *
 * - `legalName` — “the company name”;
 * - `taxNumber` — what an invoice or a partner quote carries;
 * - `customerNumber` — what a colleague reads out over the phone.
 *
 * Deliberately **not** `shortName`: the display name is derived from the legal
 * name in practice, so matching it would return the same rows twice while making
 * a search for a legal form's short form noisy.
 *
 * An absent or empty term yields `undefined`, which Drizzle renders as "no
 * `WHERE` branch" — and `and()` drops it, so the same expression object is
 * reusable by the count.
 *
 * @param term - the trimmed search term from the validated list query.
 * @returns the `WHERE` branch, or `undefined` when there is no filter.
 */
export function customerSearchFilter(
  term: string | undefined,
): SQL | undefined {
  if (term === undefined || term.length === 0) {
    return undefined;
  }

  const pattern = `%${term}%`;

  return or(
    ilike(customers.legalName, pattern),
    ilike(customers.taxNumber, pattern),
    ilike(customers.customerNumber, pattern),
  );
}

/**
 * The soft-delete filter: only rows that were never archived.
 *
 * Always returns an expression — unlike the search term there is no "no filter"
 * case, because a read that does not exclude deleted rows is a bug, not a
 * variant.
 *
 * @returns the `deleted_at IS NULL` expression.
 */
export function customerNotDeletedFilter(): SQL {
  return isNull(customers.deletedAt);
}

/**
 * The complete `WHERE` of a customer read: visibility **and** every filter the
 * request asked for.
 *
 * One function for the page query and the count, and one place where a new
 * filter is added — a filter that exists in the schema but not here would be a
 * silently unfiltered list, which the client cannot detect.
 *
 * The four filters are equality matches on closed value sets (or on a uuid), and
 * each is skipped when absent: an absent filter means “no filter”, never “match
 * null”.
 *
 * @param query - the validated list query.
 * @returns the `WHERE` expression (never `undefined`: visibility always applies).
 */
export function customerVisibleFilter(query: CustomerListQuery): SQL {
  const notDeleted = customerNotDeletedFilter();

  const conditions = [
    notDeleted,
    customerSearchFilter(query.q),
    query.type === undefined ? undefined : eq(customers.type, query.type),
    query.status === undefined ? undefined : eq(customers.status, query.status),
    query.source === undefined ? undefined : eq(customers.source, query.source),
    query.responsibleOperatorId === undefined
      ? undefined
      : eq(customers.responsibleOperatorId, query.responsibleOperatorId),
  ].filter((condition): condition is SQL => condition !== undefined);

  return and(...conditions) ?? notDeleted;
}
