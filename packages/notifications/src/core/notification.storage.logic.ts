import {
  NOTIFICATION_LEVELS,
  NOTIFICATION_SOURCES,
  NOTIFICATION_STORAGE_VERSION,
} from './notification.const.js';
import type {
  NotificationEntry,
  NotificationLevel,
  NotificationSource,
} from './notification.interface.js';
import { trimEntries } from './notification.logic.js';
import type {
  PersistedEnvelopeReadResult,
  PersistedNotificationLog,
} from './notification.storage.interface.js';

/**
 * Narrows an unknown value to a plain object.
 *
 * Arrays are rejected explicitly: `typeof [] === 'object'`, and an array reaching
 * the envelope guard must be a shape error, not a "missing property" error.
 *
 * @param value - value to inspect.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrows an unknown value to the notification level vocabulary.
 *
 * @param value - value to inspect.
 * @returns `true` for one of `NOTIFICATION_LEVELS`.
 */
function isNotificationLevel(value: unknown): value is NotificationLevel {
  return typeof value === 'string' && NOTIFICATION_LEVELS.some((level) => level === value);
}

/**
 * Narrows an unknown value to the notification source vocabulary.
 *
 * @param value - value to inspect.
 * @returns `true` for one of `NOTIFICATION_SOURCES`.
 */
function isNotificationSource(value: unknown): value is NotificationSource {
  return typeof value === 'string' && NOTIFICATION_SOURCES.some((source) => source === value);
}

/**
 * Narrows an unknown value to a non-empty identifier.
 *
 * An empty id would make a restored entry impossible to dismiss or de-duplicate.
 *
 * @param value - value to inspect.
 * @returns `true` for a string with at least one character.
 */
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Narrows an unknown value to a finite epoch-milliseconds timestamp.
 *
 * @param value - value to inspect.
 * @returns `true` for a finite number.
 */
function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Narrows an unknown value to a valid repeat counter.
 *
 * @param value - value to inspect.
 * @returns `true` for an integer of at least one.
 */
function isRepeatCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * Narrows an unknown value to an optional stored detail string.
 *
 * @param value - value to inspect.
 * @returns `true` for `undefined` or a string.
 */
function isOptionalDetail(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Validates one persisted entry.
 *
 * Field-by-field on purpose (AIS-80 decision D4): the payload is written by us but
 * read back from a mutable browser store, so nothing may be trusted. Unknown extra
 * keys are tolerated — a newer writer must not break an older reader.
 *
 * @param value - candidate read from storage.
 * @returns `true` when the value is a complete {@link NotificationEntry}.
 */
export function isPersistedEntry(value: unknown): value is NotificationEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isId(value['id']) &&
    isNotificationLevel(value['level']) &&
    typeof value['message'] === 'string' &&
    isOptionalDetail(value['detail']) &&
    isNotificationSource(value['source']) &&
    isTimestamp(value['createdAt']) &&
    typeof value['read'] === 'boolean' &&
    typeof value['toast'] === 'boolean' &&
    isRepeatCount(value['repeatCount'])
  );
}

/**
 * Builds the payload written to storage.
 *
 * Pure and synchronous, so the cap and the envelope shape are unit-testable
 * without a storage (AIS-80 decision D5). The trimming rule is `trimEntries` —
 * the same head-keeping rule the in-memory ring buffer uses, so the mirror and the
 * store order entries identically.
 *
 * @param entries - newest-first list, as read from the store snapshot.
 * @param cap - maximum number of entries to keep.
 * @returns the versioned envelope; only `entries` are included.
 */
export function toPersistedEnvelope(
  entries: readonly NotificationEntry[],
  cap: number,
): PersistedNotificationLog {
  return { version: NOTIFICATION_STORAGE_VERSION, entries: trimEntries(entries, cap) };
}

/**
 * Parses and validates a stored payload.
 *
 * Rejections are values, not exceptions (AIS-80 decision D3), so the adapter can
 * decide what to remove from storage without a `try/catch` around the parse.
 * Validation is all-or-nothing (D4): one broken entry rejects the whole payload,
 * because a partially restored history would silently rewrite what happened.
 * The version check runs before the entry checks, so a foreign schema is reported
 * as `wrong-version` rather than as a shape error.
 *
 * @param raw - the string returned by `getItem`, or `null` when the key is absent.
 * @returns the accepted entries, or the rejection reason.
 */
export function fromPersistedEnvelope(raw: string | null): PersistedEnvelopeReadResult {
  if (raw === null || raw.trim().length === 0) {
    return { ok: false, reason: 'missing' };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed payload is an expected state (a half-written value, a foreign
    // key, a truncated session). It is reported, never thrown.
    return { ok: false, reason: 'malformed-json' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'wrong-shape' };
  }

  if (parsed['version'] !== NOTIFICATION_STORAGE_VERSION) {
    return { ok: false, reason: 'wrong-version' };
  }

  const storedEntries: unknown = parsed['entries'];

  if (!Array.isArray(storedEntries)) {
    return { ok: false, reason: 'wrong-shape' };
  }

  const entries: readonly unknown[] = storedEntries;

  if (!entries.every(isPersistedEntry)) {
    return { ok: false, reason: 'wrong-shape' };
  }

  return { ok: true, entries };
}
