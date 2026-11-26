import type { HTMLAttributes } from 'react';
import type { ToastVariants } from './toast.variants.js';

/**
 * Severity vocabulary of a notification.
 *
 * Declared in `packages/ui` on purpose (AIS-81 D1). The notifications core
 * (AIS-79 D1) declares its own `NotificationLevel` union with the same five
 * literals instead of aliasing this type, because that package is
 * framework-free and importing the UI kit would pull React types in. The two
 * vocabularies are therefore kept in sync by **pinned tests on both sides**
 * (`NOTIFICATION_LEVELS` and the `TOAST_LEVEL_GLYPHS` keys), so a change on one
 * side fails a suite instead of drifting silently.
 */
export type ToastLevel = 'success' | 'error' | 'warning' | 'info' | 'system';

/**
 * One toast as the notification store hands it to {@link ToastStack}.
 *
 * Structurally typed so a `NotificationEntry` is assignable without a mapper
 * (same approach as `PaginationMeta`, AIS-116 D1).
 */
export interface ToastItem {
  readonly id: string;
  readonly level: ToastLevel;
  readonly message: string;
  /** Stack trace, HTTP status or request URL; rendered truncated to two lines. */
  readonly detail?: string;
  /** Duplicate counter of the collector; a value above `1` renders an `×N` badge. */
  readonly repeatCount?: number;
}

/**
 * Props of {@link Toast}.
 *
 * `onPause` is omitted from the DOM attributes deliberately: the media event of
 * the same name would clash with the timer callback the host passes in.
 */
export interface ToastProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onPause'>,
    ToastVariants {
  /** Severity; drives the accent token and the announced ARIA role. */
  readonly level: ToastLevel;
  readonly message: string;
  readonly detail?: string;
  readonly repeatCount?: number;
  /** Called once when the close control is activated. */
  readonly onDismiss: () => void;
  /** Pointer entered the card — the host stops its auto-dismiss timer. */
  readonly onPause?: () => void;
  /** Pointer left the card — the host resumes its auto-dismiss timer. */
  readonly onResume?: () => void;
}

/**
 * Props of {@link ToastStack}.
 */
export interface ToastStackProps {
  /**
   * **Newest first**: index `0` is the newest toast.
   *
   * The stack renders the first `TOAST_MAX_VISIBLE` items only, so the store
   * never has to know about layout, and the newest card is always the visible
   * one when the list overflows.
   */
  readonly toasts: readonly ToastItem[];
  readonly onDismiss: (id: string) => void;
  readonly onPause?: (id: string) => void;
  readonly onResume?: (id: string) => void;
}
