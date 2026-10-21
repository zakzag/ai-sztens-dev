/**
 * Pure rules of the `api-keys` use case.
 *
 * No React, no I/O: what is decided here can be unit-tested with values alone,
 * which is exactly why the 409 handling lives here (plan decision **D4/D8**):
 * the decision must be made on `ApiError.status`, never by matching message
 * text, and a test can prove the text-matching variant fails.
 */

import { isConflict } from '@callback/api-client';
import { API_KEY_IDENTIFIER_CONFLICT_MESSAGE } from './api-keys.const.js';

/**
 * @param error - whatever the mutation rejected with.
 * @returns `true` only for a real HTTP 409; a look-alike message is not enough.
 */
export function isIdentifierConflict(error: unknown): boolean {
  return isConflict(error);
}

/**
 * Maps a create failure onto the `identifier` form field.
 *
 * A duplicate identifier is a *field* problem, not a page-level one: the user
 * must be able to fix it right where the value is typed.
 *
 * @param error - whatever the mutation rejected with.
 * @returns the field error message for a 409, otherwise `null` (the caller then
 *   reports the failure page-level through `toErrorMessage`).
 */
export function toIdentifierFieldError(error: unknown): string | null {
  return isIdentifierConflict(error) ? API_KEY_IDENTIFIER_CONFLICT_MESSAGE : null;
}
