/**
 * Pure helpers of {@link SelectMenu}.
 *
 * Both functions are lookups on the caller's option list: no hook, no DOM, so
 * they stay testable as plain functions (React coding standards §5).
 */

import type { SelectMenuOption } from './select-menu.interface.js';

/**
 * Finds the option the trigger has to render.
 *
 * @param options - the caller's option list.
 * @param value - the currently chosen value.
 * @returns the matching option, or `undefined` when the value is not in the
 *   list (a stale value must not crash the header).
 */
export function toSelectedOption(
  options: readonly SelectMenuOption[],
  value: string,
): SelectMenuOption | undefined {
  return options.find((option) => option.value === value);
}

/**
 * Builds the accessible name of the trigger.
 *
 * `"<label>: <chosen label>"` keeps the visible text inside the accessible
 * name, so voice control can still say what it sees.
 *
 * @param label - the accessible name of the whole control.
 * @param option - the chosen option, `undefined` when nothing matches.
 * @returns the trigger's `aria-label`.
 */
export function toTriggerLabel(
  label: string,
  option: SelectMenuOption | undefined,
): string {
  return option === undefined ? label : `${label}: ${option.label}`;
}
