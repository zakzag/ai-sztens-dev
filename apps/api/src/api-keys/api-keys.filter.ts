/**
 * SQL filters of the `api-keys` feature (AIS-107).
 *
 * Kept out of the repository class on purpose: a filter is a *pure* description
 * of "which rows", it has no state and no dependency, and the repository should
 * stay a thin translation layer between the interface and Drizzle.
 */

import { ilike, or, type SQL } from 'drizzle-orm';
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
