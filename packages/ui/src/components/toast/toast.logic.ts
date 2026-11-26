import type { ToastDepth } from './toast.variants.js';

/**
 * Maps a render index onto the visual stack depth.
 *
 * Kept as a pure function so the cast-free narrowing lives in one testable
 * place: the stack only ever passes `0`, `1`, `2`, but the variant type is a
 * closed union and a raw `number` must not be forced into it.
 *
 * @param index - zero-based position in the rendered list, `0` being the newest.
 * @returns the depth variant of that position; anything beyond the third card
 *   keeps the deepest look.
 */
export function toToastDepth(index: number): ToastDepth {
  if (index <= 0) {
    return 0;
  }

  return index === 1 ? 1 : 2;
}
