/**
 * Copy, severities and code allow-lists of the error-surface classifier.
 *
 * Every Hungarian sentence the banner and the page error state render lives
 * here, next to the `toErrorMessage` table, so the wording stays reviewable in
 * one place (plan `D4`, `D11`). The server's `message` is never used as copy.
 */

import { API_ERROR_CODE } from '@callback/shared';
import {
  SERVICE_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from './error-message.const.js';
import type { BannerCondition, BannerCopy } from './error-surface.interface.js';

/** Banner copy when the browser reports no connectivity. */
export const NETWORK_OFFLINE_BANNER_TITLE = 'Nincs internetkapcsolat.';
export const NETWORK_OFFLINE_BANNER_MESSAGE =
  'A kérések nem mennek ki, amíg a kapcsolat helyre nem áll.';

/** Banner copy for a `401`. */
export const SESSION_EXPIRED_BANNER_TITLE = 'Lejárt a munkamenet.';

/** CTA of the session-expired banner; clicking it clears the token. */
export const SESSION_EXPIRED_BANNER_ACTION_LABEL = 'Bejelentkezés';

/** Banner copy for a `503`. */
export const SERVICE_UNAVAILABLE_BANNER_TITLE = 'A szolgáltatás átmenetileg nem elérhető.';

/** Accessible name of the banner close control. */
export const BANNER_DISMISS_LABEL = 'Értesítés bezárása';

/** Default labels of `PageErrorState`. */
export const PAGE_ERROR_RETRY_LABEL = 'Újrapróbálás';
export const PAGE_ERROR_RETRY_PENDING_LABEL = 'Próbálkozás…';

/**
 * The only error codes that may claim “this input is wrong” (plan `D1`).
 *
 * Single source of truth: `features/api-keys/api-keys.const.ts` re-exports it as
 * `FIELD_ERROR_CODES`, so the classifier and the form mapping cannot drift.
 */
export const FIELD_SURFACE_CODES: readonly string[] = Object.freeze([
  API_ERROR_CODE.VALIDATION_FAILED,
  API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
]);

/**
 * Resolved copy per banner condition.
 *
 * A `401` is `danger` because the session is unusable until the user acts; the
 * other two are `warning` because they resolve without user intervention.
 */
export const BANNER_COPY: Readonly<Record<BannerCondition, BannerCopy>> = Object.freeze({
  offline: {
    variant: 'warning',
    title: NETWORK_OFFLINE_BANNER_TITLE,
    message: NETWORK_OFFLINE_BANNER_MESSAGE,
    actionLabel: null,
  },
  'session-expired': {
    variant: 'danger',
    title: SESSION_EXPIRED_BANNER_TITLE,
    message: SESSION_EXPIRED_MESSAGE,
    actionLabel: SESSION_EXPIRED_BANNER_ACTION_LABEL,
  },
  unavailable: {
    variant: 'warning',
    title: SERVICE_UNAVAILABLE_BANNER_TITLE,
    message: SERVICE_UNAVAILABLE_MESSAGE,
    actionLabel: null,
  },
});

/**
 * Conditions in the order they win when several are present at once.
 *
 * `offline` comes first because a request that never got a response makes every
 * other symptom stale — including a cached `401`. A stale session then hides the
 * transient outage, because it is the one the user can act on. Exactly one
 * condition is rendered, so two sentences can never stack.
 */
export const BANNER_CONDITION_PRIORITY: readonly BannerCondition[] = Object.freeze([
  'offline',
  'session-expired',
  'unavailable',
]);

/** Error `name` values that mean “the caller cancelled”. */
export const ABORT_LIKE_ERROR_NAMES: readonly string[] = Object.freeze([
  'AbortError',
  'CancelledError',
]);
