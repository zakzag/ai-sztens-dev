import { COMBOBOX_OPTION_ID_INFIX } from './combobox.const.js';
import type { ComboboxOption } from './combobox.interface.js';

/** Direction of an arrow-key move inside the option list. */
export type ComboboxDirection = 1 | -1;

/**
 * Normalises a string for accent- and case-insensitive matching.
 *
 * Hungarian labels are full of accents (`Áttekintő`), and a user typing
 * `attekinto` must still find them, so the comparison strips the combining
 * marks instead of comparing raw strings.
 *
 * @param value - the raw text.
 * @returns the lowercased, accent-free, trimmed text.
 */
export function normalizeQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filters the options by label.
 *
 * An empty query returns every option (copy, never the caller's array).
 * Disabled options stay visible: hiding them would make the list jump while the
 * user types and would hide why a value cannot be chosen.
 *
 * @param options - all options in display order.
 * @param query - the current input text.
 * @returns the matching options in the original order.
 */
export function filterOptions(
  options: readonly ComboboxOption[],
  query: string,
): readonly ComboboxOption[] {
  const needle = normalizeQuery(query);

  if (needle.length === 0) {
    return [...options];
  }

  return options.filter((option) =>
    normalizeQuery(option.label).includes(needle),
  );
}

/**
 * Clamps an active index into the bounds of the current option list.
 *
 * @param index - the wanted index, possibly `-1` (nothing active).
 * @param count - the number of rendered options.
 * @returns `-1` for an empty list, otherwise an index in `[0, count - 1]`.
 */
export function clampActiveIndex(index: number, count: number): number {
  if (count <= 0) {
    return -1;
  }

  if (index < 0) {
    return 0;
  }

  return index > count - 1 ? count - 1 : index;
}

/**
 * Computes the next active index for an arrow key, wrapping at both ends.
 *
 * @param index - the current active index, `-1` when nothing is active.
 * @param direction - `1` for ArrowDown, `-1` for ArrowUp.
 * @param count - the number of rendered options.
 * @returns `-1` for an empty list, otherwise the next index.
 */
export function nextActiveIndex(
  index: number,
  direction: ComboboxDirection,
  count: number,
): number {
  if (count <= 0) {
    return -1;
  }

  if (index < 0) {
    return direction === 1 ? 0 : count - 1;
  }

  return (index + direction + count) % count;
}

/**
 * Builds the DOM id of an option, used by `aria-activedescendant`.
 *
 * @param listboxId - the listbox id.
 * @param index - the index of the option in the rendered list.
 * @returns the stable id of that option.
 */
export function toComboboxOptionId(listboxId: string, index: number): string {
  return `${listboxId}${COMBOBOX_OPTION_ID_INFIX}${index}`;
}
