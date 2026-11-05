import type { NotificationSource } from '../core/notification.interface.js';
import type { ToastTtlByLevel } from './notification-react.interface.js';

/**
 * How long a toast stays on screen.
 *
 * `null` means sticky: an error (or a `system` entry whose toast was forced on)
 * never disappears on its own, because losing the message is worse than an
 * extra click (AIS-83 decision D5, base plan §4.3).
 */
export const TOAST_TTL_MS_BY_LEVEL: ToastTtlByLevel = {
  success: 4_000,
  info: 4_000,
  warning: 6_000,
  error: null,
  system: null,
};

/**
 * Rows the log drawer shows when it is opened.
 *
 * Matches the base plan's `LOG_INITIAL_PAGE` (§4.3) and keeps the first paint of
 * the panel cheap even when the 500-entry ring buffer is full.
 */
export const LOG_INITIAL_PAGE = 20;

/** Rows one "Korábbiak betöltése" activation appends. */
export const LOG_PAGE_STEP = 50;

/** Source a `notify.*` entry is filed under unless the caller says otherwise. */
export const DEFAULT_NOTIFIER_SOURCE: NotificationSource = 'manual';

/** Locale of the default timestamp formatter; the app can inject its own. */
export const DEFAULT_LOCALE = 'hu-HU';

/**
 * Sentence shown for an uncaught error.
 *
 * The package knows nothing about localisation, so this is the one place the
 * default text lives; an emitter that wants another wording passes its own
 * message through `createNotifier(store).error(...)`.
 */
export const RUNTIME_ERROR_MESSAGE = 'Váratlan hiba történt.';

/** Name given to a thrown value that is not an `Error` instance. */
export const UNKNOWN_ERROR_NAME = 'UnknownError';
