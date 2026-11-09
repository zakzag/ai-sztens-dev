/**
 * Positive field-error fixture — a component that consumes the decision
 * function's result and never looks at `status` / `code` itself.
 */
import type { ErrorSurface } from '../lib/error-surface.logic.js';

export function Clean({ surface }: { surface: ErrorSurface }) {
  return surface === 'page' ? <p>Something went wrong.</p> : null;
}
