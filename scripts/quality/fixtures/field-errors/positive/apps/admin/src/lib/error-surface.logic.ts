/**
 * Positive field-error fixture — the pure decision function. This file is on
 * the allowlist, so branching on `status` / `code` is exactly what it is for.
 */
import { ApiError } from '@callback/api-client';

export type ErrorSurface = 'silent' | 'page' | 'banner' | 'field';

export function toErrorSurface(error: unknown): ErrorSurface {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'banner';
    }

    if (error.code === 'SERVICE_UNAVAILABLE') {
      return 'banner';
    }
  }

  return 'page';
}
