/**
 * Pure rule of the URL-owned tab/step reader (AIS-19).
 *
 * One function, so the fallback behaviour is testable without React and without
 * a router: an invalid or missing parameter must **never** throw (a hand-edited
 * or stale link has to keep working), it falls back to the caller's default.
 */

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
