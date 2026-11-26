import {
  NOTIFICATION_DETAILS_INVALID_PLACEHOLDER,
  NOTIFICATION_DETAIL_LABEL_MAX_LENGTH,
  NOTIFICATION_DETAIL_MAX_FIELDS,
  NOTIFICATION_DETAIL_TRUNCATION_SUFFIX,
  NOTIFICATION_DETAIL_VALUE_MAX_LENGTH,
  NOTIFICATION_REDACTED_PLACEHOLDER,
  NOTIFICATION_SENSITIVE_KEY_PATTERN,
  NOTIFICATION_UNSERIALIZABLE_DETAIL,
} from './notification.const.js';
import type {
  NotificationDetailField,
  NotificationEntry,
  NotificationIdentity,
} from './notification.interface.js';

/**
 * Frozen, referentially stable empty field list.
 *
 * Returned instead of a fresh array so an emitter that supplies nothing cannot
 * make two otherwise identical snapshots differ by reference (AIS-151).
 */
const EMPTY_DETAIL_FIELDS: readonly NotificationDetailField[] = Object.freeze([]);

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
 * @param details - already-normalised fields of the repeating emit; omitted
 *   means the repeat carried none, so the entry keeps the fields it had
 *   (AIS-151 decision C).
 * @returns a new entry; the input is not mutated.
 */
export function bumpEntry(
  entry: NotificationEntry,
  now: number,
  details?: readonly NotificationDetailField[],
): NotificationEntry {
  return {
    ...entry,
    createdAt: now,
    read: false,
    repeatCount: entry.repeatCount + 1,
    ...(details === undefined ? {} : { details }),
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
 * Cuts a label or value down to its limit, marking the cut.
 *
 * @param text - already-trimmed text.
 * @param maxLength - hard cap, including the suffix.
 * @returns the text unchanged when it fits, otherwise a prefix plus
 *   {@link NOTIFICATION_DETAIL_TRUNCATION_SUFFIX}; never longer than `maxLength`.
 */
function truncateDetailText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= NOTIFICATION_DETAIL_TRUNCATION_SUFFIX.length) {
    return NOTIFICATION_DETAIL_TRUNCATION_SUFFIX.slice(0, Math.max(maxLength, 0));
  }

  const head = text.slice(0, maxLength - NOTIFICATION_DETAIL_TRUNCATION_SUFFIX.length);

  return `${head}${NOTIFICATION_DETAIL_TRUNCATION_SUFFIX}`;
}

/**
 * Turns any detail value into its stored text form.
 *
 * `JSON.stringify` returns `undefined` for what it cannot express (`Symbol`,
 * function, `undefined`) and throws on a cycle or a `BigInt`; both cases degrade
 * to {@link NOTIFICATION_DETAILS_INVALID_PLACEHOLDER} instead of breaking the
 * caller.
 *
 * @param value - raw value, possibly already redacted.
 * @returns the value as text, or the placeholder.
 */
function serializeDetailValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    const serialized: unknown = JSON.stringify(value);

    return typeof serialized === 'string' ? serialized : NOTIFICATION_DETAILS_INVALID_PLACEHOLDER;
  } catch {
    // Cycle or `BigInt`: JSON cannot express the value, and a log entry must
    // never break its caller, so the failure is recorded as a marker.
    return NOTIFICATION_DETAILS_INVALID_PLACEHOLDER;
  }
}

/**
 * Builds one stored field from a label and a raw value.
 *
 * Redaction, serialisation and both length limits live here so the record and
 * the array entry point of {@link toDetailFields} cannot drift apart.
 *
 * @param rawLabel - label exactly as the emitter spelled it (used as the
 *   redaction key before it is truncated).
 * @param rawValue - raw value.
 * @param mono - `true` when the value wants a monospace rendering.
 * @returns the normalised field, or `undefined` when the label is blank.
 */
function toDetailField(
  rawLabel: string,
  rawValue: unknown,
  mono: boolean | undefined,
): NotificationDetailField | undefined {
  const label = truncateDetailText(rawLabel.trim(), NOTIFICATION_DETAIL_LABEL_MAX_LENGTH);

  if (label.length === 0) {
    return undefined;
  }

  const value = truncateDetailText(
    serializeDetailValue(redactValue(rawLabel, rawValue)),
    NOTIFICATION_DETAIL_VALUE_MAX_LENGTH,
  );

  return mono === true ? { label, value, mono: true } : { label, value };
}

/**
 * Normalises an already-built field list.
 *
 * Used for both entry points of {@link toDetailFields}, and shared with the
 * storage guard's expectations: the field cap, the label/value limits and the
 * label-keyed redaction apply to a caller-built list too, so no emitter can skip
 * redaction by pre-building the array (AIS-151 decision B).
 *
 * @param details - candidate fields, possibly over-long or unredacted.
 * @returns a new list with blank labels dropped and the caps applied.
 */
export function clampDetailFields(
  details: readonly NotificationDetailField[],
): readonly NotificationDetailField[] {
  const clamped: NotificationDetailField[] = [];

  for (const field of details.slice(0, NOTIFICATION_DETAIL_MAX_FIELDS)) {
    const normalised = toDetailField(field.label, field.value, field.mono);

    if (normalised !== undefined) {
      clamped.push(normalised);
    }
  }

  return clamped.length === 0 ? EMPTY_DETAIL_FIELDS : clamped;
}

/**
 * Narrows the `details` union to its field-list branch.
 *
 * `Array.isArray` alone does not narrow a **readonly** array union, so the
 * discrimination is expressed once, with a real type predicate, instead of being
 * cast away at the call site.
 *
 * @param input - field list or redactable record.
 * @returns `true` when the input is already a field list.
 */
function isDetailFieldList(
  input: readonly NotificationDetailField[] | Readonly<Record<string, unknown>>,
): input is readonly NotificationDetailField[] {
  return Array.isArray(input);
}

/**
 * Turns the `details` of an emit into the stored field list.
 *
 * A record keeps the **insertion order** the emitter wrote (AIS-151 decision A),
 * so the expandable row reads exactly as the caller composed it. Every branch
 * goes through {@link redactValue} and the same limits, which keeps redaction a
 * single-place concern (AIS-79 decision D9, AIS-151 D-B).
 *
 * @param input - field list, redactable record, or nothing.
 * @returns the normalised fields, or a frozen empty list when nothing survives.
 */
export function toDetailFields(
  input: readonly NotificationDetailField[] | Readonly<Record<string, unknown>> | undefined,
): readonly NotificationDetailField[] {
  if (input === undefined) {
    return EMPTY_DETAIL_FIELDS;
  }

  if (isDetailFieldList(input)) {
    return clampDetailFields(input);
  }

  const record: Readonly<Record<string, unknown>> = input;
  const fields: NotificationDetailField[] = [];

  for (const [key, rawValue] of Object.entries(record)) {
    if (fields.length >= NOTIFICATION_DETAIL_MAX_FIELDS) {
      break;
    }

    const field = toDetailField(key, rawValue, undefined);

    if (field !== undefined) {
      fields.push(field);
    }
  }

  return fields.length === 0 ? EMPTY_DETAIL_FIELDS : fields;
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
