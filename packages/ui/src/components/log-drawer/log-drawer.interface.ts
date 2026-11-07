import type { CSSProperties } from 'react';
import type { ToastLevel } from '../toast/toast.interface.js';
import type { LOG_DRAWER_WIDTH_CSS_VAR } from './log-drawer.const.js';

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
  'all' | 'success' | 'error' | 'warning' | 'info' | 'system';

/**
 * One key–value fact of an entry, shown in the expandable detail region.
 *
 * Declared **here**, not imported from `@callback/notifications`: the core
 * package's `NotificationDetailField` carries the same three fields, so a
 * `NotificationEntry` stays assignable without a mapper, and `packages/ui`
 * keeps its rule of never importing the notifications package. The two shapes
 * are kept in sync by structural compatibility plus the drawer's own tests —
 * the same approach as `ToastLevel` and `ToastItem` (AIS-81).
 *
 * The `value` is already a string: redaction, serialisation and truncation are
 * the emitter/store's job (`NOTIFICATION_DETAIL_*`, AIS-151), so the primitive
 * only has to render what it receives.
 */
export interface LogDetailField {
  /** Name of the fact, e.g. `requestId`. Emitter-owned, already localised/truncated. */
  readonly label: string;
  /** Already-redacted, already-stringified value. */
  readonly value: string;
  /**
   * Render the value as pre-formatted, monospaced text.
   *
   * Set by the emitter for ids, URLs, header dumps and bodies — anything whose
   * meaning would suffer from being re-wrapped as prose.
   */
  readonly mono?: boolean;
}

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
  /**
   * Redacted technical context: HTTP status, request URL, stack trace.
   *
   * Stays a single line on purpose (AIS-151 decision D-A): the toast and the
   * **collapsed** row show it, while {@link details} is what the expandable
   * region lists. The two complement each other, neither replaces the other.
   */
  readonly detail?: string;
  /**
   * Structured, already-redacted facts of the entry, in the emitter's order.
   *
   * Optional and absent when the emitter had nothing to add — an empty array
   * never reaches here (the store drops it), so "no `details`" and "no facts"
   * are the same state. Rendered only while the row is expanded.
   */
  readonly details?: readonly LogDetailField[];
  /** Creation time in epoch milliseconds. */
  readonly createdAt: number;
}

/**
 * Which copy control of an expanded row gave its feedback.
 *
 * A named union (not two booleans, not an inline string) because the row keeps
 * one independent "copied" flag per target: pressing `JSON` must not relabel
 * the `requestId` button, so the state and its timer map are keyed by this
 * type.
 */
export type LogEntryCopyTarget = 'requestId' | 'json';

/**
 * Per-target copy feedback of one row.
 *
 * A `Record` keyed by {@link LogEntryCopyTarget} (not one boolean per control)
 * so a new control cannot be added without deciding its initial flag, and so
 * the row's reset timer can address its own key only.
 */
export type LogEntryCopyFlags = Readonly<Record<LogEntryCopyTarget, boolean>>;

/**
 * Serialisable projection of one entry, as the "copy JSON" control writes it.
 *
 * A named type (not an inline object, not a cast) with a **fixed field order**,
 * so `toEntryJson` is deterministic and its output is assertable in a test. The
 * order is the order a human reads an entry in: identity, severity, sentence,
 * one-line context, then the structured facts of the expanded region.
 *
 * Optional fields are left `undefined` rather than set to `null`:
 * `JSON.stringify` drops them, so a minimal entry serialises to a minimal
 * object instead of a wall of `null`s.
 */
export interface LogEntryJson {
  readonly id: string;
  readonly level: ToastLevel;
  readonly message: string;
  readonly detail?: string;
  readonly createdAt: number;
  readonly details?: readonly LogDetailField[];
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
 * Bounds and default of the resizable panel (AIS-150).
 *
 * Passed in as a prop rather than read from the constants directly, so the host
 * stays the single owner of the policy and the primitive keeps a testable,
 * dependency-free geometry contract. `initial` is also the fallback whenever a
 * candidate width is unusable (`NaN`, `Infinity`).
 */
export interface LogDrawerSizeRange {
  /** Narrowest accepted width, in CSS pixels. */
  readonly min: number;
  /** Widest accepted width, in CSS pixels. */
  readonly max: number;
  /** Width used for a missing/unreadable preference and for a double-click reset. */
  readonly initial: number;
}

/**
 * Geometry of one in-flight pointer drag of the resize separator.
 *
 * Kept by the component (a `useRef`, not a prop) because only the handle knows
 * the gesture's origin. `startX`/`startWidth` are the anchor the width is
 * derived from: the reported width is `startWidth - (currentX - startX)`, so it
 * depends on the pointer's **travel** and never on a viewport edge — see
 * `toWidthFromDrag` in `log-drawer.logic.ts`.
 */
export interface LogDrawerDragAnchor {
  /** `pointerId` of the pointer that started the drag; a move of any other pointer is ignored. */
  readonly pointerId: number;
  /** Pointer x at `pointerdown`, in CSS pixels. */
  readonly startX: number;
  /** Panel width at `pointerdown`, in CSS pixels. */
  readonly startWidth: number;
}

/**
 * Inline style carrying the panel width as a CSS custom property.
 *
 * The custom property name is declared in
 * {@link LOG_DRAWER_WIDTH_CSS_VAR} and reused by the width utility of the
 * panel, so there is exactly one string literal for it in the package. A named
 * type (not an inline object, not a cast) because `CSSProperties` alone rejects
 * unknown keys.
 */
export type LogDrawerWidthStyle = CSSProperties &
  Readonly<Record<typeof LOG_DRAWER_WIDTH_CSS_VAR, string>>;

/**
 * Props of {@link LogDrawer}.
 *
 * The drawer is **presentational only**: it owns no filter state, no page
 * window, no width and no data. `entries` is the already-sliced,
 * **newest-first** row list the host decided to show; `hasMore` says whether
 * the buffer holds older rows, and every interaction — including every resize
 * intent — is reported through a callback.
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
  /**
   * Current panel width in CSS pixels, as the host's controller holds it.
   *
   * Rendered as the `--log-drawer-width` custom property; below `md` the panel
   * is full width and the value has no visual effect (AIS-150).
   */
  readonly width: number;
  /** Bounds the handle clamps to; also supplies the double-click reset value. */
  readonly widthRange: LogDrawerSizeRange;
  /**
   * `true` while a pointer drag is in progress.
   *
   * Owned by the host: it starts on `pointerdown` and ends on
   * `pointerup`/`pointercancel`. The panel drops its transform transition in
   * this state, so a drag never animates against the pointer.
   */
  readonly isResizing: boolean;
  /** A pointer move or a key press asked for a new width; the host clamps and stores it. */
  readonly onWidthChange: (next: number) => void;
  /** A drag began — the host flips its `isResizing` flag. */
  readonly onResizeStart: () => void;
  /** A drag ended (pointer up or cancel) — the host flips the flag back. */
  readonly onResizeEnd: () => void;
  /** Double click on the handle; the host restores the default width. */
  readonly onWidthReset: () => void;
}
