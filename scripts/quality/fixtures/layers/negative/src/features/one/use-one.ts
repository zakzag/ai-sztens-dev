/** Negative layer fixture — feature → feature import. */
import { useTwo } from '../two/use-two.js';

export function useOne(): string {
  return useTwo();
}
