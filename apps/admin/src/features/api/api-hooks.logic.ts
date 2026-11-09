/**
 * Pure state→view mapping of the generic hook layer (AIS-114).
 *
 * No React and no I/O, so every branch is unit-testable with a value: the hooks
 * call exactly these functions and add nothing of their own. Keeping the
 * decision here is what makes `errorSurface === 'silent'` testable without
 * mounting a component with an aborted query.
 */

import { toErrorMessage } from '../../lib/error-message.js';
import { toApiError, toErrorSurface } from '../../lib/error-surface.logic.js';
import type { ApiErrorView } from './api-hooks.interface.js';

/**
 * Projects a thrown value onto the three failure fields the UI consumes.
 *
 * `null` and `undefined` mean “no failure” and map to three `null`s; anything
 * else goes through the shared classifier, so a non-`ApiError` (a render bug, a
 * programming error) is still described instead of being swallowed.
 *
 * @param error - whatever a query or mutation reported.
 * @returns the error view; never `null` itself.
 */
export function toApiErrorView(error: unknown): ApiErrorView {
  if (error === null || error === undefined) {
    return { error: null, errorMessage: null, errorSurface: null };
  }

  return {
    error: toApiError(error),
    errorMessage: toErrorMessage(error),
    errorSurface: toErrorSurface(error),
  };
}
