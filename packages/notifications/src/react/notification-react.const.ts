import {
  LOG_DRAWER_WIDTH_DEFAULT,
  LOG_DRAWER_WIDTH_MAX,
  LOG_DRAWER_WIDTH_MIN,
} from '@callback/ui';
import type { LogDrawerSizeRange } from '@callback/ui';
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

/**
 * Key of the persisted panel width of the log drawer.
 *
 * Versioned (`.v1`) like every other stored payload in this package: a future
 * change of the format must be able to ignore the old value instead of
 * misreading it (AIS-150).
 */
export const LOG_DRAWER_WIDTH_STORAGE_KEY = 'aisztens.logdrawer.width.v1';

/**
 * Bounds and default of the resizable log drawer.
 *
 * The numbers themselves live in `@callback/ui` (AIS-150 D4) — this constant
 * only binds them into the shape the controller and `LogDrawer` expect, so the
 * trigger geometry and the stored value can never disagree.
 */
export const LOG_DRAWER_WIDTH_RANGE: LogDrawerSizeRange = {
  min: LOG_DRAWER_WIDTH_MIN,
  max: LOG_DRAWER_WIDTH_MAX,
  initial: LOG_DRAWER_WIDTH_DEFAULT,
};

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
