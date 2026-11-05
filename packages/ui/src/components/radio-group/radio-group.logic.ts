import type { RadioOption } from './radio-group.interface.js';

/** Direction of the arrow-key move inside a radio group. */
export type RadioDirection = 1 | -1;

/**
 * Returns the id of a radio input, derived from the group name and the value.
 *
 * Exported so callers can point `aria-describedby` or tests at the exact input
 * without re-implementing the naming rule.
 *
 * @param name - the shared group name.
 * @param value - the option value.
 * @returns the DOM id of that radio.
 */
export function toRadioId(name: string, value: string): string {
  return `${name}-${value}`;
}

/**
 * Computes the value an arrow key should move the selection to.
 *
 * Wraps at both ends (the platform behaviour for radio groups) and skips
 * disabled options, so a disabled entry never swallows the keystroke. With
 * nothing selected yet, ArrowDown selects the first and ArrowUp the last
 * enabled option.
 *
 * @param options - the rendered options in order.
 * @param currentValue - the currently selected value.
 * @param direction - `1` for down/right, `-1` for up/left.
 * @returns the value to select, or `null` when no enabled option exists.
 */
export function nextOptionValue(
  options: readonly RadioOption[],
  currentValue: string,
  direction: RadioDirection,
): string | null {
  const enabled = options.filter((option) => !option.disabled);

  if (enabled.length === 0) {
    return null;
  }

  const currentIndex = enabled.findIndex(
    (option) => option.value === currentValue,
  );
  const baseIndex =
    currentIndex === -1 ? (direction === 1 ? -1 : 0) : currentIndex;
  const nextIndex = (baseIndex + direction + enabled.length) % enabled.length;

  return enabled[nextIndex].value;
}
