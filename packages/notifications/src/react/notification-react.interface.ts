import type { ReactNode } from 'react';
import type {
  LogDrawerSizeRange,
  LogLevelFilter,
  ToastItem,
} from '@callback/ui';
import type {
  NotificationEntry,
  NotificationLevel,
  NotificationSource,
  NotificationStore,
} from '../core/notification.interface.js';
import type {
  NotificationStorage,
  NotificationWriteScheduler,
  StorageLike,
} from '../core/notification.storage.interface.js';

/**
 * Extra fields a `notify.*` shortcut may pass.
 *
 * Deliberately small: the level is chosen by the shortcut, the message is the
 * caller's already-localised sentence, everything else is optional context
 * (AIS-83 decision D10).
 */
export interface NotifyOptions {
  /** Where the entry came from; defaults to `manual`. */
  readonly source?: NotificationSource;
  /** Technical context; a record is redacted by the store (AIS-79 D9). */
  readonly detail?: string | Readonly<Record<string, unknown>>;
  /** Overrides the level default; `system` defaults to `false`, the rest to `true`. */
  readonly toast?: boolean;
}

/**
 * The `notify` facade.
 *
 * Two shapes exist on purpose (AIS-83 decision D10):
 *
 * - {@link createNotifier} binds any store and runs without React, so a service
 *   or a plain module can emit;
 * - `useNotifier()` binds the store of the surrounding provider.
 *
 * There is no module-level singleton: it would silently pick whichever provider
 * mounted last, and two apps (or two tests) would share state.
 */
export interface Notifier {
  success(message: string, options?: NotifyOptions): NotificationEntry;
  error(message: string, options?: NotifyOptions): NotificationEntry;
  warning(message: string, options?: NotifyOptions): NotificationEntry;
  info(message: string, options?: NotifyOptions): NotificationEntry;
  /** Log-only by default (`toast: false`). */
  system(message: string, options?: NotifyOptions): NotificationEntry;
}

/**
 * Props of `NotificationProvider`.
 *
 * Every collaborator that touches the outside world can be injected, so a test
 * never needs `window`, `sessionStorage` or `requestAnimationFrame` (AIS-83 D2).
 */
export interface NotificationProviderProps {
  readonly children: ReactNode;
  /** Injected store; default: created from the restored `initialEntries`. */
  readonly store?: NotificationStore;
  /** Injected mirror; default: `createNotificationStorage` over `sessionStorage`. */
  readonly storage?: NotificationStorage;
  /** Attach `stack` to runtime-error details. The app passes `import.meta.env.DEV`. */
  readonly includeDetails?: boolean;
  /** Formats log timestamps; default: `toLocaleTimeString('hu-HU')`. */
  readonly formatTimestamp?: (epochMs: number) => string;
  /** Write coalescer of the mirror; default: one flush per animation frame. */
  readonly scheduleWrite?: NotificationWriteScheduler;
  /**
   * Injected width preference of the log drawer; default:
   * `createLogDrawerWidthStorage` over the guarded `localStorage`.
   *
   * Separate from `storage` on purpose: the log mirror is session data
   * (`sessionStorage`), the panel width is a UI preference (`localStorage`) that
   * must survive a browser restart (AIS-150 D2).
   */
  readonly widthStorage?: LogDrawerWidthStorage;
}

/**
 * The `localStorage` cell holding the panel width of the log drawer.
 *
 * Declared structurally for the same reason as {@link StorageLike}: the raw
 * string is stored, while parsing and clamping belong to
 * `parseStoredDrawerWidth`, which needs the range. The adapter never throws —
 * a blocked storage degrades to memory-only (AIS-80 D13, AIS-150 D8).
 */
export interface LogDrawerWidthStorage {
  /**
   * Reads the stored width.
   *
   * @returns the raw payload, or `null` when nothing usable is stored.
   */
  load(): string | null;

  /**
   * Stores a width.
   *
   * @param width - width in CSS pixels; serialised by the adapter.
   */
  save(width: number): void;
}

/**
 * Construction options of {@link LogDrawerWidthStorage}.
 *
 * Both fields are optional so the adapter can be built with the production
 * defaults, and every collaborator is injectable so a test never needs a real
 * `window`.
 */
export interface LogDrawerWidthStorageOptions {
  /** Backing storage; `undefined`/`null` means memory-only (every call is a no-op). */
  readonly storage?: StorageLike | null;
  /** Storage key; defaults to `LOG_DRAWER_WIDTH_STORAGE_KEY`. */
  readonly key?: string;
}

/**
 * What the provider publishes on its context.
 *
 * Internal to the package: apps consume the hooks, never the context object
 * (copying it out would bypass the store's single-subscription rule, AIS-83 D4).
 */
export interface NotificationContextValue {
  readonly store: NotificationStore;
  readonly storage: NotificationStorage;
  readonly widthStorage: LogDrawerWidthStorage;
  readonly notifier: Notifier;
  readonly includeDetails: boolean;
  readonly formatTimestamp: (epochMs: number) => string;
}

/**
 * Open/closed, filter and paging state of the log drawer.
 *
 * Transient page UI state, so it lives in `useState` inside `useLogDrawer` — not
 * in the store (the store owns content) and not in a global Zustand store
 * (AIS-83 decision D7).
 */
export interface LogDrawerController {
  readonly isOpen: boolean;
  readonly levelFilter: LogLevelFilter;
  /** How many filtered rows the current window shows (`20`, then `+50`). */
  readonly visibleCount: number;
  /** `true` while the filtered buffer holds rows beyond the window. */
  readonly hasMore: boolean;
  /** Unseen entries; drives the collapsed tab's badge. */
  readonly unseenCount: number;
  /** Panel width in CSS pixels, restored from the width storage on mount. */
  readonly width: number;
  /** `true` while a pointer drag on the panel edge is in progress. */
  readonly isResizing: boolean;
  /** Bounds the width is clamped to; also the double-click reset target. */
  readonly widthRange: LogDrawerSizeRange;
  /** Open or close. Opening also marks every entry read (AIS-83 D8). */
  readonly toggle: () => void;
  readonly close: () => void;
  /** Changes the filter and resets the window to the first page. */
  readonly setLevelFilter: (filter: LogLevelFilter) => void;
  /** Widens the window by one page. */
  readonly loadMore: () => void;
  /** Drops the log from the store **and** the `sessionStorage` mirror. */
  readonly clear: () => void;
  /** A pointer drag started: the panel drops its transform transition (AIS-150). */
  readonly beginResize: () => void;
  /** A new width from a pointer move or a key press; clamped, not yet persisted. */
  readonly updateWidth: (next: number) => void;
  /** A pointer drag ended: the final width is persisted here, once. */
  readonly endResize: () => void;
  /** Double click on the handle: back to the default width and persist it. */
  readonly resetWidth: () => void;
}

/** Pause/resume controls the host hands to the toast stack. */
export interface ToastTimerControls {
  /** Pointer entered a card: stop its countdown (AIS-83 D6). */
  readonly pause: (id: string) => void;
  /** Pointer left a card: restart a full TTL. */
  readonly resume: (id: string) => void;
}

/**
 * Why a timer does not run: `null` means the level is sticky.
 *
 * Values are milliseconds; the map itself is `TOAST_TTL_MS_BY_LEVEL`.
 */
export type ToastTtl = number | null;

/** Severity → countdown pair used by `resolveToastTtl`. */
export type ToastTtlByLevel = Readonly<Record<NotificationLevel, ToastTtl>>;

/**
 * The slice of a `window` the adapter and the host need.
 *
 * Declared structurally so the package never assumes `requestAnimationFrame`
 * exists — jsdom does not implement it unless `pretendToBeVisual` is set, and
 * plain Node has no `window` at all (AIS-83 D2).
 */
export interface AnimationFrameScope {
  readonly requestAnimationFrame?: (callback: () => void) => number;
  readonly cancelAnimationFrame?: (handle: number) => void;
}

/** One toast as the host hands it to `ToastStack`; re-exported for convenience. */
export type NotificationToastItem = ToastItem;
