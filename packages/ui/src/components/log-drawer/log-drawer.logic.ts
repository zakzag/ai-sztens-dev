import {
  LOG_DRAWER_CLOSE_LABEL,
  LOG_DRAWER_OPEN_LABEL,
  LOG_DRAWER_WIDTH_CSS_VAR,
  LOG_DRAWER_WIDTH_STEP,
  LOG_DRAWER_WIDTH_STEP_LARGE,
  LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE,
  LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN,
  LOG_ENTRY_REQUEST_ID_FIELD_LABEL,
} from './log-drawer.const.js';
import type {
  LogDetailField,
  LogDrawerSizeRange,
  LogDrawerWidthStyle,
  LogEntryItem,
  LogEntryJson,
} from './log-drawer.interface.js';

/**
 * Builds the accessible name of the single drawer handle.
 *
 * The handle is present in **both** states (AIS-136 `D4`), so its name has to
 * say what activating it would *do*: open the panel while it is collapsed, close
 * it while it is open. The badge is decorative, so an unseen count must also be
 * part of the name — otherwise a screen reader user would never learn that new
 * entries arrived (AIS-82 decision D7).
 *
 * @param unseenCount - number of entries not seen yet; `0` means none.
 * @param isOpen - whether the panel is currently open.
 * @returns the action label alone, or with the count in parentheses.
 */
export function toLogDrawerHandleLabel(
  unseenCount: number,
  isOpen: boolean,
): string {
  const label = isOpen ? LOG_DRAWER_CLOSE_LABEL : LOG_DRAWER_OPEN_LABEL;

  if (unseenCount <= 0) {
    return label;
  }

  return `${label} (${unseenCount} új)`;
}

/**
 * Clamps a candidate width into the accepted range.
 *
 * This is the single place the panel's width boundary is decided, so the
 * pointer, the keyboard, the restore path and the host's controller all agree.
 * A value that is not a finite number is not a width at all — a corrupt stored
 * preference or a `NaN` from arithmetic falls back to the range's `initial`
 * instead of producing `width: NaNpx`.
 *
 * @param value - candidate width in CSS pixels.
 * @param range - bounds and fallback widths.
 * @returns a finite width between `range.min` and `range.max`.
 */
export function clampDrawerWidth(
  value: number,
  range: LogDrawerSizeRange,
): number {
  const fallback = clampBetween(range.initial, range.min, range.max);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return clampBetween(value, range.min, range.max);
}

/**
 * Converts the pointer travel of a drag into a panel width.
 *
 * The width is anchored to the two things a drag actually knows — the width the
 * gesture started with and how far the pointer has moved since — and never to a
 * viewport edge. Two defects of the former edge-anchored calculation
 * (`window.innerWidth - clientX`) are gone with it: `window.innerWidth` counts
 * the classic scrollbar while a `fixed right-0` panel ends at
 * `document.documentElement.clientWidth` (so every step overshot by the
 * scrollbar width), and a layout shift under a stationary pointer can no longer
 * feed back into the width, because the delta of a pointer that has not moved is
 * `0` for any `currentX === startX` — which is what kept the panel ratcheting
 * towards `min`/`max` while the user only hovered the separator.
 *
 * The handle sits on the panel's **left** edge, so moving the pointer left
 * (`currentX < startX`) widens the panel.
 *
 * @param startX - pointer x at `pointerdown`, in CSS pixels.
 * @param currentX - pointer x of the current `pointermove`, in CSS pixels.
 * @param startWidth - panel width when the drag started, in CSS pixels.
 * @param range - bounds and fallback widths.
 * @returns the clamped width the drag asks for.
 */
export function toWidthFromDrag(
  startX: number,
  currentX: number,
  startWidth: number,
  range: LogDrawerSizeRange,
): number {
  return clampDrawerWidth(startWidth - (currentX - startX), range);
}

/**
 * Converts a key press on the handle into a panel width.
 *
 * A right-edge panel grows while the divider moves **left**, so `ArrowLeft`
 * widens it and `ArrowRight` narrows it — the divider follows the arrow, not the
 * panel. `Shift` takes the large step, `Home`/`End` jump to the bounds, and any
 * other key leaves the width untouched (so a caller can distinguish "handled"
 * from "ignored" by comparing the result with `current`).
 *
 * @param key - `KeyboardEvent.key` of the handle.
 * @param current - current width in CSS pixels.
 * @param range - bounds and fallback widths.
 * @param isShiftPressed - whether `Shift` was held; selects the large step.
 * @returns the clamped width the key press asks for, or `current` when the key
 *   is not a resize key.
 */
export function toWidthFromKey(
  key: string,
  current: number,
  range: LogDrawerSizeRange,
  isShiftPressed = false,
): number {
  const step = isShiftPressed
    ? LOG_DRAWER_WIDTH_STEP_LARGE
    : LOG_DRAWER_WIDTH_STEP;

  switch (key) {
    case 'ArrowLeft':
      return clampDrawerWidth(current + step, range);
    case 'ArrowRight':
      return clampDrawerWidth(current - step, range);
    case 'Home':
      return clampDrawerWidth(range.min, range);
    case 'End':
      return clampDrawerWidth(range.max, range);
    default:
      return current;
  }
}

/**
 * Builds the inline style that publishes the panel width.
 *
 * The width travels as a CSS custom property, because the responsive rule is
 * `w-full md:w-[var(--log-drawer-width)]`: below `md` the panel ignores the
 * value entirely, so no JavaScript media query is needed (AIS-150 D3).
 *
 * @param width - current width in CSS pixels.
 * @returns a style object with exactly one custom property.
 */
export function toWidthStyle(width: number): LogDrawerWidthStyle {
  return { [LOG_DRAWER_WIDTH_CSS_VAR]: `${width}px` };
}

/**
 * Builds the accessible name of a row's expandable header button.
 *
 * The header button carries a glyph, the level text and the timestamp, none of
 * which describe the affordance, so the name has to say what a press would do —
 * and it **flips** with the state, exactly like the drawer's own handle
 * (`toLogDrawerHandleLabel`). The number of facts is appended when there is
 * something to reveal, because "open the details" on a row with no facts is a
 * promise the panel cannot keep.
 *
 * @param isOpen - whether the row's detail region is expanded.
 * @param detailCount - number of `details` the entry carries; `0` means none.
 * @returns the action label, with the fact count in parentheses when any exist.
 */
export function toEntryToggleLabel(
  isOpen: boolean,
  detailCount: number,
): string {
  const label = isOpen
    ? LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE
    : LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN;

  if (detailCount <= 0) {
    return label;
  }

  return `${label} (${detailCount} részlet)`;
}

/**
 * Projects one entry into the deterministic payload of the "copy JSON" control.
 *
 * Pure and locale-free on purpose: `createdAt` stays the raw epoch
 * millisecond value handed in by the store, so two calls with the same entry
 * always produce byte-identical output — which is what makes the copy control
 * testable at all. Serialising a formatted date or a `Date` instance would put
 * the host's locale (and the machine's timezone) into the clipboard.
 *
 * Field order comes from {@link LogEntryJson}; `JSON.stringify` drops the
 * `undefined` optional fields, so a minimal entry yields a minimal object.
 *
 * @param entry - the row that was expanded.
 * @returns pretty-printed JSON, stable across calls.
 */
export function toEntryJson(entry: LogEntryItem): string {
  const details = entry.details ?? [];
  const payload: LogEntryJson = {
    id: entry.id,
    level: entry.level,
    message: entry.message,
    detail: entry.detail,
    createdAt: entry.createdAt,
    details: details.length === 0 ? undefined : details,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Finds the field whose value the request-id copy control should copy.
 *
 * The label is emitter-owned text (`NOTIFICATION_DETAIL_*`, AIS-151), so it may
 * arrive as `requestId`, `Request-Id` or `requestID`; comparing loosely keeps
 * the control available without imposing a spelling on every emitter. When no
 * such field exists the control must **not** be rendered at all — an enabled
 * button that copies an empty string is worse than no button.
 *
 * @param details - the entry's structured facts, if any.
 * @returns the matching field, or `null` when the entry carries none.
 */
export function findRequestIdField(
  details: readonly LogDetailField[] | undefined,
): LogDetailField | null {
  if (details === undefined) {
    return null;
  }

  const wanted = LOG_ENTRY_REQUEST_ID_FIELD_LABEL.toLowerCase();

  return (
    details.find((field) => field.label.trim().toLowerCase() === wanted) ?? null
  );
}

/**
 * Constrains a number to a closed interval.
 *
 * @param value - number to constrain; callers guarantee it is finite.
 * @param min - lower bound.
 * @param max - upper bound.
 * @returns `value` when it lies inside the interval, the nearer bound otherwise.
 */
function clampBetween(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
