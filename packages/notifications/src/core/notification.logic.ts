import {
  NOTIFICATION_REDACTED_PLACEHOLDER,
  NOTIFICATION_SENSITIVE_KEY_PATTERN,
  NOTIFICATION_UNSERIALIZABLE_DETAIL,
} from './notification.const.js';
import type { NotificationEntry, NotificationIdentity } from './notification.interface.js';

/**
 * Builds the identifier of a notification entry.
 *
 * Pure and deterministic (AIS-79 decision D8): the store injects the clock and
 * its own sequence counter, so tests never depend on `Math.random` or on a
 * `crypto` implementation being present.
 *
 * @param createdAt - epoch milliseconds of the entry.
 * @param sequence - monotonically increasing counter of the store instance.
 * @returns an id of the form `ntf-<base36 time>-<base36 sequence>`.
 */
export function createNotificationId(createdAt: number, sequence: number): string {
  return `ntf-${createdAt.toString(36)}-${sequence.toString(36)}`;
}

/**
 * Keeps the newest `cap` entries.
 *
 * @param entries - newest-first list.
 * @param cap - maximum length; a non-positive cap yields an empty list.
 * @returns the same reference when nothing has to be dropped, which keeps the
 *   store snapshot stable (AIS-79 decision D13).
 */
export function trimEntries(
  entries: readonly NotificationEntry[],
  cap: number,
): readonly NotificationEntry[] {
  if (cap >= entries.length) {
    return entries;
  }

  return entries.slice(0, Math.max(cap, 0));
}

/**
 * Keeps the newest `cap` toast ids.
 *
 * @param toastIds - newest-first list.
 * @param cap - maximum length; a non-positive cap yields an empty list.
 * @returns the same reference when nothing has to be dropped.
 */
export function trimToastIds(toastIds: readonly string[], cap: number): readonly string[] {
  if (cap >= toastIds.length) {
    return toastIds;
  }

  return toastIds.slice(0, Math.max(cap, 0));
}

/**
 * Finds the entry an emit would repeat.
 *
 * The window is inclusive (AIS-79 decision D6): a repeat exactly
 * `dedupeWindowMs` later still bumps.
 *
 * @param entries - newest-first list; the first match is the newest repeat.
 * @param identity - level and message to compare.
 * @param now - current time in epoch milliseconds.
 * @param dedupeWindowMs - repeat window in milliseconds.
 * @returns the matching entry, or `undefined` when a new entry is due.
 */
export function findDuplicate(
  entries: readonly NotificationEntry[],
  identity: NotificationIdentity,
  now: number,
  dedupeWindowMs: number,
): NotificationEntry | undefined {
  return entries.find(
    (entry) =>
      entry.level === identity.level &&
      entry.message === identity.message &&
      now - entry.createdAt <= dedupeWindowMs,
  );
}

/**
 * Counts a repeat on an existing entry.
 *
 * The creation time is refreshed so the window keeps sliding while the same
 * message repeats, and the entry becomes unread again (AIS-79 decision D7).
 *
 * @param entry - the entry being repeated.
 * @param now - current time in epoch milliseconds.
 * @returns a new entry; the input is not mutated.
 */
export function bumpEntry(entry: NotificationEntry, now: number): NotificationEntry {
  return {
    ...entry,
    createdAt: now,
    read: false,
    repeatCount: entry.repeatCount + 1,
  };
}

/**
 * Marks every entry as read.
 *
 * @param entries - newest-first list.
 * @returns the same reference when every entry is already read, otherwise a new
 *   list with only the unread entries replaced.
 */
export function markEntriesRead(entries: readonly NotificationEntry[]): readonly NotificationEntry[] {
  if (entries.every((entry) => entry.read)) {
    return entries;
  }

  return entries.map((entry) => (entry.read ? entry : { ...entry, read: true }));
}

/**
 * Redacts the value of a single key.
 *
 * @param key - property name as it appears in the payload.
 * @param value - raw value; returned unchanged for a non-sensitive key.
 * @returns the redaction placeholder for a sensitive key, otherwise `value`.
 */
export function redactValue(key: string, value: unknown): unknown {
  return NOTIFICATION_SENSITIVE_KEY_PATTERN.test(key) ? NOTIFICATION_REDACTED_PLACEHOLDER : value;
}

/**
 * Redacts one level of a payload.
 *
 * One level is deliberate: it covers the shapes the emitters actually produce
 * (an error body, a headers object, a request context) without pretending to be
 * a deep sanitiser. Nested values must be redacted by passing them in as their
 * own record.
 *
 * @param record - payload to redact.
 * @returns a new record; the input is not mutated.
 */
export function redactRecord(record: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    redacted[key] = redactValue(key, value);
  }

  return redacted;
}

/**
 * Turns the `detail` of an emit into the stored string.
 *
 * A record is redacted and serialised here, so redaction cannot be skipped by an
 * emitter (AIS-79 decision D9).
 *
 * @param detail - plain text or a redactable payload.
 * @returns the stored detail, or `undefined` when nothing was supplied.
 */
export function toRedactedDetail(
  detail: string | Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  if (detail === undefined) {
    return undefined;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  try {
    return JSON.stringify(redactRecord(detail));
  } catch {
    // The only failure mode of serialisation is a value JSON cannot express (a
    // cycle, a BigInt). A log entry must never break its caller, so the failure
    // is recorded as a marker instead of propagating.
    return NOTIFICATION_UNSERIALIZABLE_DETAIL;
  }
}
