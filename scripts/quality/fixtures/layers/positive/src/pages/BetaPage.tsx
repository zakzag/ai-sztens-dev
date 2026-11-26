/** Positive layer fixture — a flat page may import a shared infra feature. */
import { useList } from '../features/api/use-list.js';

export function BetaPage() {
  return <p>{useList()}</p>;
}
