import type { ToastLevel } from './toast.interface.js';

/**
 * How many toasts the stack renders at once.
 *
 * Older entries are not lost — they stay in the log buffer — but a fourth
 * simultaneous card would cover the page content.
 */
export const TOAST_MAX_VISIBLE = 3;

/**
 * Accessible name of the close control.
 *
 * A bare "✕" would be unreadable for a screen reader, so the glyph is
 * `aria-hidden` and this string is the label.
 */
export const TOAST_DISMISS_LABEL = 'Bezárás';

/** Accessible name of the live region, so it is a navigable landmark. */
export const TOAST_STACK_ARIA_LABEL = 'Értesítések';

/**
 * Stacking class of the stack.
 *
 * Overlay depth is **layout**, not colour: `theme.css` has no z-scale token and
 * the palette gate does not cover it (AIS-117 decision D5). The literal lives
 * here so no JSX repeats it. It sits above `DIALOG_CONTENT_Z_INDEX` (`z-50`),
 * because a toast must stay readable while a dialog or drawer is open.
 */
export const TOAST_STACK_Z_INDEX = 'z-60';

/**
 * Decorative glyph per level.
 *
 * Purely decorative: the meaning is carried by the accent token, the message
 * and the ARIA role, so the glyph is rendered `aria-hidden`.
 */
export const TOAST_LEVEL_GLYPHS: Record<ToastLevel, string> = {
  success: '✓',
  error: '!',
  warning: '⚠',
  info: 'i',
  system: '•',
};
