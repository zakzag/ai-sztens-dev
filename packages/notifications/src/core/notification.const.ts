import type {
  NotificationEntry,
  NotificationLevel,
  NotificationSource,
  NotificationState,
} from './notification.interface.js';
import type { PersistedEnvelopeVersion } from './notification.storage.interface.js';

/**
 * Ring-buffer size of the log.
 *
 * The oldest entry is dropped when a new one arrives at the cap. 500 is enough
 * for a full debugging session in a single tab while keeping the log drawer's
 * memory footprint and render cost bounded.
 */
export const NOTIFICATION_MAX_ENTRIES = 500;

/**
 * How many toast ids the state keeps.
 *
 * The UI renders at most this many cards and slices defensively. Mirror of
 * `TOAST_MAX_VISIBLE` in `packages/ui` — the two packages must not import each
 * other (AIS-79 decision D3), so both numbers are asserted in tests.
 */
export const NOTIFICATION_MAX_VISIBLE_TOASTS = 3;

/**
 * Repeat window of the dedupe rule.
 *
 * An identical level + message inside this window bumps the existing entry's
 * `repeatCount` instead of adding a second entry and a second toast.
 */
export const NOTIFICATION_DEDUPE_WINDOW_MS = 2_000;

/**
 * The canonical level vocabulary.
 *
 * Runtime mirror of the {@link NotificationLevel} union, needed for guards,
 * iteration and the parity test against `packages/ui`'s `ToastLevel` (D2).
 */
export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = [
  'success',
  'error',
  'warning',
  'info',
  'system',
];

/** Runtime mirror of the {@link NotificationSource} union. */
export const NOTIFICATION_SOURCES: readonly NotificationSource[] = [
  'form',
  'api',
  'router',
  'runtime',
  'manual',
];

/**
 * `sessionStorage` key of the persisted log mirror.
 *
 * The schema version is part of the key (`v1`), so a future v2 can sit next to an
 * old payload instead of guessing what it is reading (AIS-80 decision D2).
 */
export const NOTIFICATION_STORAGE_KEY = 'aisztens.notifications.v1';

/**
 * Schema version written into the persisted envelope.
 *
 * A payload carrying any other version is rejected and removed, because phase 1
 * ships no migration (AIS-80 decisions D3 and D11).
 */
export const NOTIFICATION_STORAGE_VERSION: PersistedEnvelopeVersion = 1;

/**
 * How many entries the `sessionStorage` mirror keeps.
 *
 * Deliberately smaller than the in-memory ring buffer (`NOTIFICATION_MAX_ENTRIES`):
 * the mirror explains what happened before a reload, it is not an archive, and
 * `sessionStorage` quota is shared with the rest of the app (AIS-80 decision D2).
 */
export const NOTIFICATION_STORAGE_MAX_ENTRIES = 200;

/**
 * Replaces the value of a sensitive key.
 *
 * The marker is fixed so tests and log readers can grep for it; the value itself
 * is never retained anywhere.
 */
export const NOTIFICATION_REDACTED_PLACEHOLDER = '<redacted>';

/**
 * Stands in for a `detail` record that cannot be serialised (cycle, `BigInt`).
 *
 * A log entry must never break its caller, so serialisation failure degrades to
 * this marker instead of throwing.
 */
export const NOTIFICATION_UNSERIALIZABLE_DETAIL = '<unserializable detail>';

/**
 * Maximum number of structured fields kept on one entry.
 *
 * The `sessionStorage` mirror holds 200 entries and the quota is shared with the
 * rest of the app, so a per-entry field cap keeps the payload realistic
 * (AIS-151 decision D-D). Fields beyond the cap are dropped silently.
 */
export const NOTIFICATION_DETAIL_MAX_FIELDS = 20;

/**
 * Maximum length of a detail field label.
 *
 * A label is a column in the expandable row, not prose: anything longer is
 * truncated with {@link NOTIFICATION_DETAIL_TRUNCATION_SUFFIX}.
 */
export const NOTIFICATION_DETAIL_LABEL_MAX_LENGTH = 40;

/**
 * Maximum length of a detail field value.
 *
 * Long enough for a stack frame list or a request-body prefix, short enough that
 * 200 persisted entries stay inside the `sessionStorage` quota.
 */
export const NOTIFICATION_DETAIL_VALUE_MAX_LENGTH = 2_000;

/**
 * Marker appended to a truncated label or value.
 *
 * Visible on purpose: a truncated value must never look complete to whoever
 * reads the log.
 */
export const NOTIFICATION_DETAIL_TRUNCATION_SUFFIX = '…';

/**
 * Stands in for a detail value that cannot be turned into text.
 *
 * Covers what JSON cannot express (a cycle, a `BigInt`) and the values
 * `JSON.stringify` silently erases (`Symbol`, function, `undefined`). A log entry
 * must never break its caller, so these degrade to this marker.
 */
export const NOTIFICATION_DETAILS_INVALID_PLACEHOLDER = '<invalid value>';

/**
 * Key names whose value must never reach the log.
 *
 * Matched case-insensitively and as a substring, so `Authorization`,
 * `X-Auth-Token`, `api_key` and `clientSecret` are all covered.
 */
export const NOTIFICATION_SENSITIVE_KEY_PATTERN = /authorization|token|password|api[_-]?key|secret/i;

const EMPTY_ENTRIES: readonly NotificationEntry[] = Object.freeze([]);
const EMPTY_TOAST_IDS: readonly string[] = Object.freeze([]);

/**
 * Frozen, referentially stable empty state.
 *
 * Also the value of `getServerSnapshot`, which must return the same reference on
 * every call.
 */
export const EMPTY_NOTIFICATION_STATE: NotificationState = Object.freeze({
  entries: EMPTY_ENTRIES,
  toasts: EMPTY_TOAST_IDS,
});
