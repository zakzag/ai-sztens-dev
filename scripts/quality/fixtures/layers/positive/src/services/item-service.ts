/** Positive layer fixture — `services` → `lib` is legal. */
import { format } from '../lib/format.js';

export function loadItem(value: string): string {
  return format(value);
}
