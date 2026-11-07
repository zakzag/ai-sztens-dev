import {
  LOG_DRAWER_CLOSE_LABEL,
  LOG_DRAWER_OPEN_LABEL,
  LOG_DRAWER_WIDTH_CSS_VAR,
  LOG_DRAWER_WIDTH_STEP,
  LOG_DRAWER_WIDTH_STEP_LARGE,
} from './log-drawer.const.js';
import type {
  LogDrawerSizeRange,
  LogDrawerWidthStyle,
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
 * Converts a pointer position into a panel width.
 *
 * The panel is pinned to the **right** edge, so the visible width is the
 * distance from the pointer to the right edge of the viewport. Clamping through
 * `clampDrawerWidth` makes an out-of-window pointer harmless.
 *
 * @param clientX - pointer x coordinate in CSS pixels.
 * @param viewportWidth - current viewport width in CSS pixels.
 * @param range - bounds and fallback widths.
 * @returns the clamped width the pointer asks for.
 */
export function toWidthFromPointer(
  clientX: number,
  viewportWidth: number,
  range: LogDrawerSizeRange,
): number {
  return clampDrawerWidth(viewportWidth - clientX, range);
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
