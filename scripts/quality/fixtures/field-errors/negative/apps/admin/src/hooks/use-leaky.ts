/**
 * Negative field-error fixture — one file per rule shape that the first-match
 * ordering would otherwise mask (see `Leaky.tsx` for the `error.*` forms).
 */
import { ApiError } from '@callback/api-client';

export function isApiError(error: unknown): boolean {
  return error instanceof ApiError;
}

export function isConflictCode(failure: { code?: string }): boolean {
  return failure.code === 'CONFLICT';
}
