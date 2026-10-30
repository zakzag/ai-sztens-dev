/**
 * The single classifier that decides *where* a failure becomes visible
 * (plan `D11`, tiers 2–3) plus the pure banner-model builder.
 *
 * Why one function instead of scattered `if`s: the tiers overlap visually (an
 * offline banner next to a page alert for the same failed request would say the
 * same thing twice), so the precedence has to live in one place that can be
 * tested branch by branch. No React, no I/O — callers pass the error in and get
 * a surface name back.
 */

import { ApiError, HTTP_STATUS } from '@callback/api-client';
import {
  ABORT_LIKE_ERROR_NAMES,
  BANNER_CONDITION_PRIORITY,
  BANNER_COPY,
  BANNER_DISMISS_LABEL,
  FIELD_SURFACE_CODES,
} from './error-surface.const.js';
import type {
  BannerCondition,
  BannerModel,
  ErrorSurface,
  NamedErrorLike,
} from './error-surface.interface.js';

/**
 * @param error - anything a query or mutation rejected with; never trusted.
 * @returns `true` when the failure is a cancellation, i.e. the user (or a
 *   component unmount) walked away and there is nothing to report.
 */
export function isAbortLike(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { name } = error as NamedErrorLike;

  return typeof name === 'string' && ABORT_LIKE_ERROR_NAMES.includes(name);
}

/**
 * Narrows a thrown value to the transport's own error type.
 *
 * @param error - anything a query or mutation rejected with.
 * @returns the `ApiError`, or `null` when the failure did not come from the
 *   transport (a render bug, a programming error, a cancelled request).
 */
export function toApiError(error: unknown): ApiError | null {
  return error instanceof ApiError ? error : null;
}

/**
 * @param error - a normalised API failure.
 * @returns `true` when the failure may claim “this specific input is wrong”.
 */
function isFieldFailure(error: ApiError): boolean {
  return (
    error.issues.length > 0 &&
    error.code !== null &&
    FIELD_SURFACE_CODES.includes(error.code)
  );
}

/**
 * Maps one failure onto the tier that has to render it.
 *
 * Decision order matters and is frozen here:
 * cancellation → unknown throwable → no response (offline) → `401` → `503` →
 * addressable field error → everything else.
 *
 * @param error - anything a query or mutation rejected with.
 * @returns the surface; never `null`, so a caller cannot forget a branch.
 */
export function toErrorSurface(error: unknown): ErrorSurface {
  if (isAbortLike(error)) {
    return 'silent';
  }

  if (!(error instanceof ApiError)) {
    return 'page';
  }

  if (error.status === null) {
    return 'banner';
  }

  if (
    error.status === HTTP_STATUS.UNAUTHORIZED ||
    error.status === HTTP_STATUS.SERVICE_UNAVAILABLE
  ) {
    return 'banner';
  }

  return isFieldFailure(error) ? 'field' : 'page';
}

/**
 * @param status - HTTP status of a banner-classified failure.
 * @returns the banner condition, or `null` for a status the banner ignores.
 */
function toBannerConditionFromStatus(status: number): BannerCondition | null {
  if (status === HTTP_STATUS.UNAUTHORIZED) {
    return 'session-expired';
  }

  if (status === HTTP_STATUS.SERVICE_UNAVAILABLE) {
    return 'unavailable';
  }

  return null;
}

/**
 * Picks the one condition the banner has to express right now.
 *
 * Offline wins over everything: while the browser reports no connectivity no
 * request can be made, so a cached `401` is a stale symptom, not the cause. A
 * failure with no response at all (`status === null`) is treated the same way,
 * because the browser claiming to be online proves nothing about reachability.
 * When several banner-classified errors are cached,
 * {@link BANNER_CONDITION_PRIORITY} decides — the condition is never combined, so
 * two sentences cannot stack.
 *
 * @param isOnline - `navigator.onLine`, or the value the UI reacted to.
 * @param errors - every cached query error, in any order.
 * @returns the condition, or `null` when no banner is due.
 */
export function toBannerCondition(
  isOnline: boolean,
  errors: readonly unknown[],
): BannerCondition | null {
  if (!isOnline) {
    return 'offline';
  }

  const present = new Set<BannerCondition>();

  for (const error of errors) {
    if (toErrorSurface(error) !== 'banner' || !(error instanceof ApiError)) {
      continue;
    }

    if (error.status === null) {
      present.add('offline');
      continue;
    }

    const condition = toBannerConditionFromStatus(error.status);

    if (condition !== null) {
      present.add(condition);
    }
  }

  return (
    BANNER_CONDITION_PRIORITY.find((condition) => present.has(condition)) ??
    null
  );
}

/**
 * Resolves the copy and severity of a condition.
 *
 * @param condition - the condition {@link toBannerCondition} selected.
 * @returns a ready-to-render banner model; the component only maps it to markup.
 */
export function toBannerModel(condition: BannerCondition): BannerModel {
  return {
    condition,
    ...BANNER_COPY[condition],
    dismissLabel: BANNER_DISMISS_LABEL,
  };
}
