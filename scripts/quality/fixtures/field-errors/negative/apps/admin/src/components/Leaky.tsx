/**
 * Negative field-error fixture — a component branching on the transport-level
 * error shape instead of an `errorSurface` / `errorMessage`.
 */
import { ApiError } from '@callback/api-client';

export function Leaky({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 503) {
    return <p>Service unavailable</p>;
  }

  const isConflict = error.code === 'CONFLICT';

  return <p>{String(isConflict)}</p>;
}
