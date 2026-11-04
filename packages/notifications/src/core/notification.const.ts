import type {
  NotificationEntry,
  NotificationLevel,
  NotificationSource,
  NotificationState,
} from './notification.interface.js';

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
