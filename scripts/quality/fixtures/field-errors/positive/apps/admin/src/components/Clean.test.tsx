/**
 * Positive field-error fixture — test code asserts on error shapes on purpose,
 * so `*.test.ts(x)` is out of scope. This file must **not** be reported.
 */
import { ApiError } from '@callback/api-client';

export function assertServerError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}
