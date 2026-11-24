/**
 * The pure diff behind every audit row (AIS-177).
 *
 * One responsibility: given the row before and after a write, return **only the
 * keys that changed**, in a shape that survives a `jsonb` round trip. No I/O, no
 * Nest, no clock — which is what makes the interesting cases (null vs missing,
 * `updated_at`, dates) unit-testable without a database.
 *
 * Why not store both rows whole: the ledger is read by a human (*Napló* tab) and
 * by an incident responder. A 22-column customer row repeated on every update
 * hides the one field that moved, and multiplies the storage for no information.
 */

import { AUDIT_DIFF_IGNORED_KEYS } from './audit.const.js';
import type { AuditDiff } from './audit.interface.js';

/** A row-shaped payload as the caller hands it over. */
export type AuditPayload = Readonly<Record<string, unknown>>;

/** Is this value a plain object (and not an array, `null` or a class instance)? */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts a payload value into something `JSON.stringify` and `jsonb` agree on.
 *
 * - `Date` → ISO string: a timestamp column read through Drizzle is a `Date`,
 *   and `JSON.stringify` would produce the same string anyway — doing it here
 *   makes the comparison and the stored value *identical*, so an unchanged
 *   timestamp cannot look changed.
 * - `undefined` → the key is dropped: "absent" and "explicitly null" are
 *   different facts, and only `null` survives into the log.
 * - Arrays and nested objects are normalised recursively, because `metadata`
 *   and `before_data` are JSON documents.
 *
 * @param value - any value taken from a row or a request body.
 * @returns a JSON-safe value of the same shape.
 */
export function toJsonSafeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry: unknown) => toJsonSafeValue(entry));
  }

  if (isPlainRecord(value)) {
    const normalised: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        continue;
      }
      normalised[key] = toJsonSafeValue(entry);
    }

    return normalised;
  }

  return value;
}

/** Normalises a payload into a JSON-safe record, ignoring `null` / `undefined`. */
function toEntries(
  payload: AuditPayload | null | undefined,
): Record<string, unknown> {
  if (payload === null || payload === undefined) {
    return {};
  }

  const normalised = toJsonSafeValue(payload);

  return isPlainRecord(normalised) ? normalised : {};
}

/**
 * Are two normalised values equal for audit purposes?
 *
 * Deep equality by serialisation: the payloads are already JSON-safe (see
 * {@link toJsonSafeValue}), so two values are the same fact exactly when they
 * serialise identically. Ordering inside an object is stable for our rows,
 * because they come from the same projection.
 */
function isSameValue(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Narrows a before/after pair to the keys that actually changed.
 *
 * Rules:
 * - `insert`: `before` is `null`, every key of `after` is "changed".
 * - `delete` / `soft_delete`: `after` is `null`, every key of `before` is changed.
 * - `update`: only the differing keys appear on both sides; a key present on one
 *   side only appears on that side alone (null vs missing is not flattened).
 * - `updated_at` is ignored on both sides — see {@link AUDIT_DIFF_IGNORED_KEYS}.
 *
 * @param before - the row as it was, or `null` when it did not exist.
 * @param after - the row as it is, or `null` when it no longer exists.
 * @returns the narrowed payload plus the changed key names.
 */
export function diffAuditPayload(
  before: AuditPayload | null,
  after: AuditPayload | null,
): AuditDiff {
  const beforeEntries = toEntries(before);
  const afterEntries = toEntries(after);
  const changedKeys: string[] = [];
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([
    ...Object.keys(beforeEntries),
    ...Object.keys(afterEntries),
  ])) {
    if (AUDIT_DIFF_IGNORED_KEYS.includes(key)) {
      continue;
    }

    const hadBefore = Object.hasOwn(beforeEntries, key);
    const hasAfter = Object.hasOwn(afterEntries, key);

    if (
      hadBefore &&
      hasAfter &&
      isSameValue(beforeEntries[key], afterEntries[key])
    ) {
      continue;
    }

    changedKeys.push(key);

    if (hadBefore) {
      changedBefore[key] = beforeEntries[key];
    }

    if (hasAfter) {
      changedAfter[key] = afterEntries[key];
    }
  }

  return {
    // `null` means exactly "this side of the change has no row" — it mirrors the
    // input, so an unchanged update yields two empty objects, not `null`.
    before: before === null ? null : changedBefore,
    after: after === null ? null : changedAfter,
    changedKeys,
    hasChanges: changedKeys.length > 0,
  };
}
