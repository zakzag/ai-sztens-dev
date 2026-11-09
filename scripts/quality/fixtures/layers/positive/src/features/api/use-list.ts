/** Positive layer fixture — the shared infra feature, importable by any page. */
import { format } from '../../lib/format.js';

export function useList(): string {
  return format('list');
}
