/**
 * SQL filters of the `api-keys` feature (AIS-107, AIS-108).
 *
 * Kept out of the repository class on purpose: a filter is a *pure* description
 * of "which rows", it has no state and no dependency, and the repository should
 * stay a thin translation layer between the interface and Drizzle.
 *
 * Two filters live here, and they answer two different questions:
 *
 * - {@link apiKeySearchFilter} — *which* rows the caller asked for (`?q=`);
 * - {@link apiKeyNotDeletedFilter} — *whether a row is visible at all*.
 *
 * The second one is composed into **every** read, so a soft-deleted row cannot
 * leak through one forgotten `WHERE`.
 */

import { and, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { apiKeys } from '../db/schema.js';

/**
 * The `?q=` filter: a case-insensitive substring match on `name` **or**
 * `identifier`.
 *
 * Two notes on the semantics:
 *
 * - an absent or empty term yields `undefined`, which Drizzle renders as "no
 *   `WHERE` clause" — the same expression is then reused by the count and the
 *   page query, so the two can never disagree about the result set;
 * - `%` and `_` in the term are **not** escaped, so they behave as SQL wildcards.
 *   That is a search-precision quirk, not an injection risk (the value is
 *   always sent as a bound parameter), and escaping without an `ESCAPE` clause
 *   would silently change the user's text instead of storing what they typed.
 *
 * @param term - the trimmed search term from the validated list query.
 * @returns the `WHERE` expression, or `undefined` when there is no filter.
 */
export function apiKeySearchFilter(term: string | undefined): SQL | undefined {
  if (term === undefined || term.length === 0) {
    return undefined;
  }

  const pattern = `%${term}%`;

  return or(ilike(apiKeys.name, pattern), ilike(apiKeys.identifier, pattern));
}

/**
 * The soft-delete filter: only rows that were never deleted (AIS-108).
 *
 * Always returns an expression — unlike the search term there is no "no
 * filter" case, because a read that does not exclude deleted rows is a bug, not
 * a variant. `and()` drops `undefined` branches, so composing this with
 * {@link apiKeySearchFilter} yields a plain `WHERE deleted_at IS NULL` for an
 * unfiltered list and a two-branch `WHERE` for a search.
 *
 * @returns the `deleted_at IS NULL` expression.
 */
export function apiKeyNotDeletedFilter(): SQL {
  return isNull(apiKeys.deletedAt);
}

/**
 * The complete `WHERE` of a read: visibility **and** the optional search term.
 *
 * One function so the count query and the page query cannot drift apart (both
 * call it), and so a new read gets the deleted-row filter by construction.
 *
 * @param term - the trimmed search term from the validated list query.
 * @returns the `WHERE` expression (or `undefined` when Drizzle must omit it —
 *   never the case here, since {@link apiKeyNotDeletedFilter} always applies).
 */
export function apiKeyVisibleFilter(term: string | undefined): SQL {
  const notDeleted = apiKeyNotDeletedFilter();
  const search = apiKeySearchFilter(term);

  // `and()` folds a single expression into `undefined`, so the not-deleted
  // branch is returned explicitly rather than through a cast.
  return and(notDeleted, search) ?? notDeleted;
}
