/**
 * Types of the query-string builder (AIS-109).
 *
 * Kept apart from the implementation so a caller can name the filter shape
 * without importing the logic, and so the pure function has one obvious input
 * type to test against.
 */

/** A value a query parameter may carry. */
export type QueryScalar = string | number | boolean;

/**
 * Everything one query parameter may be.
 *
 * `null` and `undefined` are part of the type on purpose: they mean “the user
 * has not chosen anything yet”, and the builder drops them instead of letting a
 * caller remember to strip them.
 */
export type QueryValue =
  QueryScalar | null | undefined | readonly QueryScalar[];

/** A record of filters, e.g. `{ q: 'vapi', active: true, tag: ['a', 'b'] }`. */
export type QueryFilters = Readonly<Record<string, QueryValue>>;

/**
 * Values that count as “unchanged”, and therefore stay out of the URL.
 *
 * A scalar map, not a `QueryFilters`: a default is a single known value, an
 * array default would make “is this equal” ambiguous for no benefit.
 */
export type QueryDefaults = Readonly<Record<string, QueryScalar>>;
