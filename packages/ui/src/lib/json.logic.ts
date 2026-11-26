import { JSON_PRETTY_INDENT } from './json.const.js';

/**
 * Pretty-prints a value the store hands over as a string, when it is JSON.
 *
 * The log drawer stores every detail value as a **string** (redacted and
 * truncated by the notifications core, AIS-151), so a `queryKey` arrives as
 * `["api-keys","update"]` and a request body as `{"name":"first"}` — long,
 * single-line and unreadable (AIS-163). This function is the single place that
 * decides whether such a string is JSON and what it looks like when expanded.
 *
 * Only **containers** count as JSON: an object or an array. A bare number, a
 * quoted string, `true` and `null` all parse successfully but have nothing to
 * indent, so they are rejected — otherwise every numeric status code would grow
 * a pointless "expand" control. `null` is rejected explicitly, because
 * `typeof null === 'object'`.
 *
 * The function never throws: malformed JSON is a completely normal input here
 * (a plain sentence, a truncated body, a stack trace), and the caller only
 * needs a yes/no answer.
 *
 * @param value - the detail value exactly as the store stored it.
 * @returns the indented JSON text, or `null` when the value is not a JSON
 *   container.
 */
export function toPrettyJson(value: string): string | null {
  if (value.trim() === '') {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isJsonContainer(parsed)) {
    return null;
  }

  return JSON.stringify(parsed, null, JSON_PRETTY_INDENT);
}

/**
 * Tells whether a detail value can be expanded to pretty-printed JSON.
 *
 * A thin, intention-revealing wrapper around {@link toPrettyJson}: the row asks
 * this to decide whether to render the toggle at all, and a separate predicate
 * keeps that decision readable at the call site.
 *
 * @param value - the detail value exactly as the store stored it.
 * @returns `true` when {@link toPrettyJson} would produce indented output.
 */
export function isJsonDetailValue(value: string): boolean {
  return toPrettyJson(value) !== null;
}

/**
 * Narrows a parsed JSON value to a container (object or array).
 *
 * @param value - result of `JSON.parse`.
 * @returns `true` for a non-null object, which includes every array.
 */
function isJsonContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
