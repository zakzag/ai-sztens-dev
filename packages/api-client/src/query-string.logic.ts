/**
 * Pure query-string builder of the transport (AIS-109).
 *
 * Why it exists instead of string concatenation at the call sites: a filter
 * record contains `undefined`, `null`, empty strings and empty arrays, and every
 * hand-written builder eventually ships one of them as `?q=undefined`. This
 * function owns that rule once, and it is pure, so every branch is testable
 * without a `fetch` double.
 *
 * Encoding is delegated to `URLSearchParams`, which means a space becomes `+`
 * and `&`/`é` are percent-encoded — the same encoding the shared
 * `toListQueryParams` produces for list queries, so a list URL and a filtered
 * URL can never disagree about how a value travels.
 */

import type {
  QueryDefaults,
  QueryFilters,
  QueryValue,
} from './query-string.interface.js';

/** Signals “this value is not a filter the URL should carry”. */
function isSkipped(value: QueryValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  return value === '' || (Array.isArray(value) && value.length === 0);
}

/** @returns `true` when the filter still carries its default value. */
function isDefault(
  key: string,
  value: QueryValue,
  defaults: QueryDefaults | undefined,
): boolean {
  if (defaults === undefined || Array.isArray(value)) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(defaults, key)
    ? defaults[key] === value
    : false;
}

/**
 * Builds the query string of a set of filters.
 *
 * @param filters - the filters; insertion order is the parameter order.
 * @param defaults - values that count as unchanged and are therefore omitted.
 * @returns the encoded query string **without** the leading `?`, or `''` when
 *   nothing should be appended (a caller never produces a bare `?`).
 */
export function toQueryString(
  filters: QueryFilters,
  defaults?: QueryDefaults,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (isSkipped(value) || isDefault(key, value, defaults)) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        // An empty string inside a list is an unset choice, not a filter value.
        if (item !== '') {
          params.append(key, String(item));
        }
      }

      continue;
    }

    params.append(key, String(value));
  }

  return params.toString();
}
