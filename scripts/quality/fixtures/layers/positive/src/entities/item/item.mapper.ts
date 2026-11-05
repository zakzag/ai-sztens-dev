/** Positive layer fixture — `entities` → `lib` is legal. */
import { format } from '../../lib/format.js';

export function toItemLabel(value: string): string {
  return format(value);
}
