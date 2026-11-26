/** Positive layer fixture — `components` → `lib` is legal. */
import { format } from '../lib/format.js';

export function Card({ title }: { title: string }) {
  return (
    <div className="rounded-card bg-surface-raised p-6">{format(title)}</div>
  );
}
