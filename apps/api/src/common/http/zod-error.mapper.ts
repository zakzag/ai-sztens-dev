/**
 * Turns a `ZodError` into the contract's `details[]` shape (plan `D13`).
 *
 * The point of the mapping is that the admin no longer parses strings to find
 * out **which** field is wrong: every issue becomes `{ path, message }` with a
 * dot path (`identifier`, `lines.2.quantity`). A whole-payload issue has an empty
 * path, which is how the UI decides between a field error and a page alert.
 */

import type { ZodError } from 'zod';
import type { ApiErrorDetail } from '@callback/shared';

/**
 * @param error - the failed `safeParse` result's error.
 * @returns one entry per issue, in the order zod reported them.
 */
export function toApiErrorDetails(error: ZodError): readonly ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}
