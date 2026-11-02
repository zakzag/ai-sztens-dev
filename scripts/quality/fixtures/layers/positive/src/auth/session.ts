/** Positive layer fixture — `auth` → `lib` is legal. */
import { format } from '../lib/format.js';

export function readTokenSignal(token: string): string {
  return format(token);
}
