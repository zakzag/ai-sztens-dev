/**
 * Pure rules of the URL-owned tab/step reader (AIS-19, extended by AIS-181).
 *
 * Both functions are testable without React and without a router: an invalid or
 * missing parameter must **never** throw (a hand-edited or stale link has to keep
 * working), it falls back to the caller's default; and a write has to leave every
 * parameter it does not own alone.
 */

import type { TabWriteOptions } from './use-tab-param.interface.js';

/**
 * Narrows a raw URL value onto a closed set of allowed values.
 *
 * @param value - the raw parameter (`null` when absent).
 * @param allowed - the closed set of legal values.
 * @param fallback - value used when `value` is absent or not allowed.
 * @returns one of `allowed`, never anything else.
 */
export function parseAllowedValue<TValue extends string>(
  value: string | null,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  if (value === null) {
    return fallback;
  }

  // `includes` on a readonly tuple of literals needs the widened argument; the
  // narrowing below is the same one the array itself guarantees.
  const match = allowed.find((candidate) => candidate === value);

  return match ?? fallback;
}

/**
 * Computes the search params of one tab write (AIS-181).
 *
 * Three rules, in this order, and all of them in **one** object so the caller
 * performs exactly one navigation:
 *
 * 1. the keys listed in `clearParams` are removed — a view switch invalidates the
 *    previous view's paged list state;
 * 2. the tab parameter is removed when the new value **is** the fallback, so the
 *    canonical address of the default view carries no query string;
 * 3. every other parameter of the page is preserved untouched.
 *
 * The input is cloned, never mutated.
 *
 * @param current - the search params currently in the URL.
 * @param options - parameter name, the new value, the fallback and the keys to clear.
 * @returns the search params to write.
 */
export function applyTabWrite(
  current: URLSearchParams,
  options: TabWriteOptions,
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const name of options.clearParams ?? []) {
    next.delete(name);
  }

  if (options.value === options.fallback) {
    next.delete(options.paramName);
  } else {
    next.set(options.paramName, options.value);
  }

  return next;
}
