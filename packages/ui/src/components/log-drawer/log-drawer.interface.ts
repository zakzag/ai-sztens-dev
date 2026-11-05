import type { ToastLevel } from '../toast/toast.interface.js';

/**
 * Level filter vocabulary of the log drawer.
 *
 * `all` means "no filtering". The six values cover the whole `ToastLevel` union
 * plus `all`: `success` is part of the vocabulary on purpose, because the
 * notification store (`@callback/notifications`, AIS-79) emits `success` entries
 * as well — without its own chip those would be reachable only through `all`
 * (AIS-82 decision D2).
 */
export type LogLevelFilter =
  | 'all'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'system';

/**
 * One log entry as the notification host hands it to {@link LogDrawer}.
 *
 * Structurally typed, so a `NotificationEntry` of `@callback/notifications` is
 * assignable without a mapper — `packages/ui` must not import that package's
 * types, and the extra fields it carries (`source`, `read`, `toast`,
 * `repeatCount`) are simply ignored here. Same approach as `ToastItem`
 * (AIS-81).
 */
export interface LogEntryItem {
  /** Stable identifier; also the React key of the rendered row. */
  readonly id: string;
  readonly level: ToastLevel;
  /** Already-localised, human-readable sentence chosen by the emitter. */
  readonly message: string;
  /** Redacted technical context: HTTP status, request URL, stack trace. */
  readonly detail?: string;
  /** Creation time in epoch milliseconds. */
  readonly createdAt: number;
}

/**
 * Props of {@link LogEntryRow}.
 */
export interface LogEntryRowProps {
  readonly entry: LogEntryItem;
  /**
   * Formats `createdAt`.
   *
   * Injected on purpose: `packages/ui` must not depend on an app-specific date
   * library, and the caller already owns localisation (AIS-82 decision D6).
   */
  readonly formatTimestamp: (epochMs: number) => string;
}

/**
 * Props of {@link LogDrawer}.
 *
 * The drawer is **presentational only**: it owns no filter state, no page
 * window and no data. `entries` is the already-sliced, **newest-first** row
 * list the host decided to show; `hasMore` says whether the buffer holds older
 * rows, and every interaction is reported through a callback.
 */
export interface LogDrawerProps {
  /** Rows to render, **newest first** (index `0` is the newest entry). */
  readonly entries: readonly LogEntryItem[];
  readonly isOpen: boolean;
  /**
   * Unseen entries; drives the badge on the handle in **both** states and is
   * part of its accessible name. `0` hides the badge and the suffix.
   */
  readonly unseenCount: number;
  readonly levelFilter: LogLevelFilter;
  /** `true` while older rows remain in the store's ring buffer. */
  readonly hasMore: boolean;
  /**
   * The handle was activated — the single toggle intent of the component.
   *
   * The handle is always mounted (AIS-136), so this fires in both directions:
   * `isOpen === false` means “open the panel”, `isOpen === true` means “close
   * it”. The host derives that from its own state; the component never guesses.
   */
  readonly onToggle: () => void;
  /** Header close control or `Escape` — secondary close paths beside `onToggle`. */
  readonly onClose: () => void;
  readonly onFilterChange: (filter: LogLevelFilter) => void;
  /** "Korábbiak betöltése" — called exactly once per activation. */
  readonly onLoadMore: () => void;
  /** "Törlés" — drops the log, the store decides what that means. */
  readonly onClear: () => void;
  readonly formatTimestamp: (epochMs: number) => string;
}
