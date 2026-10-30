/**
 * Tests of the error-surface classifier.
 *
 * The function is pure, so every branch of the `D11` decision table is one
 * assertion away — no query client, no DOM, no service double.
 */

import { HTTP_STATUS } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  createAbortError,
  createConflictError,
  createMultiFieldValidationError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
} from '../test/mocks/api-error.mock.js';
import {
  BANNER_DISMISS_LABEL,
  NETWORK_OFFLINE_BANNER_MESSAGE,
  NETWORK_OFFLINE_BANNER_TITLE,
  SESSION_EXPIRED_BANNER_ACTION_LABEL,
  SESSION_EXPIRED_BANNER_TITLE,
  SERVICE_UNAVAILABLE_BANNER_TITLE,
} from './error-surface.const.js';
import {
  isAbortLike,
  toBannerCondition,
  toBannerModel,
  toErrorSurface,
} from './error-surface.logic.js';

describe('isAbortLike', () => {
  it.each(['AbortError', 'CancelledError'])(
    'treats %s as a cancellation',
    (name) => {
      expect(isAbortLike({ name })).toBe(true);
    },
  );

  it('ignores values that cannot be a cancellation', () => {
    expect(isAbortLike(null)).toBe(false);
    expect(isAbortLike(undefined)).toBe(false);
    expect(isAbortLike('AbortError')).toBe(false);
    expect(isAbortLike({})).toBe(false);
    expect(isAbortLike({ name: 42 })).toBe(false);
    expect(isAbortLike(new Error('boom'))).toBe(false);
  });
});

describe('toErrorSurface', () => {
  it('silences a cancelled request', () => {
    expect(toErrorSurface(createAbortError())).toBe('silent');
  });

  it('sends a non-ApiError throwable to the page', () => {
    expect(
      toErrorSurface(new TypeError('Cannot read properties of undefined')),
    ).toBe('page');
    expect(toErrorSurface('boom')).toBe('page');
  });

  it('sends a request with no response to the banner', () => {
    expect(toErrorSurface(createNetworkError())).toBe('banner');
  });

  it('sends 401 and 503 to the banner', () => {
    expect(
      toErrorSurface(
        createStatusError(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHENTICATED'),
      ),
    ).toBe('banner');
    expect(
      toErrorSurface(createServerError(HTTP_STATUS.SERVICE_UNAVAILABLE)),
    ).toBe('banner');
  });

  it('sends an addressable validation failure to the field tier', () => {
    expect(toErrorSurface(createValidationError())).toBe('field');
    expect(toErrorSurface(createMultiFieldValidationError())).toBe('field');
    expect(toErrorSurface(createConflictError())).toBe('field');
  });

  it('sends an allowed code without issues to the page', () => {
    expect(
      toErrorSurface(
        createStatusError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_FAILED'),
      ),
    ).toBe('page');
  });

  it.each([
    HTTP_STATUS.BAD_REQUEST,
    HTTP_STATUS.FORBIDDEN,
    HTTP_STATUS.NOT_FOUND,
    HTTP_STATUS.CONFLICT,
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    // Proxy-generated statuses have no shared enum member; they still arrive
    // through the tolerant path and must land on the page.
    502,
    504,
  ])('sends %i to the page tier', (status) => {
    expect(toErrorSurface(createStatusError(status))).toBe('page');
  });

  it('treats an unknown 5xx as a page failure', () => {
    expect(toErrorSurface(createServerError(599))).toBe('page');
  });
});

describe('toBannerCondition', () => {
  it('reports offline when the browser says so, regardless of cached errors', () => {
    expect(toBannerCondition(false, [])).toBe('offline');
    expect(
      toBannerCondition(false, [createStatusError(HTTP_STATUS.UNAUTHORIZED)]),
    ).toBe('offline');
  });

  it('reports nothing while online and without a banner-classified error', () => {
    expect(toBannerCondition(true, [])).toBeNull();
    expect(
      toBannerCondition(true, [
        createServerError(HTTP_STATUS.INTERNAL_SERVER_ERROR),
      ]),
    ).toBeNull();
    expect(toBannerCondition(true, [createValidationError()])).toBeNull();
  });

  it('reports the request-without-response case as offline while online', () => {
    expect(toBannerCondition(true, [createNetworkError()])).toBe('offline');
  });

  it('maps 401 to the session condition and 503 to the outage condition', () => {
    expect(
      toBannerCondition(true, [createStatusError(HTTP_STATUS.UNAUTHORIZED)]),
    ).toBe('session-expired');
    expect(
      toBannerCondition(true, [
        createServerError(HTTP_STATUS.SERVICE_UNAVAILABLE),
      ]),
    ).toBe('unavailable');
  });

  it('prefers offline over a stale 401 and a 401 over an outage, in any order', () => {
    const unauthorized = createStatusError(HTTP_STATUS.UNAUTHORIZED);
    const unavailable = createServerError(HTTP_STATUS.SERVICE_UNAVAILABLE);

    expect(toBannerCondition(true, [unauthorized, unavailable])).toBe(
      'session-expired',
    );
    expect(toBannerCondition(true, [unavailable, unauthorized])).toBe(
      'session-expired',
    );
    expect(toBannerCondition(true, [createNetworkError(), unauthorized])).toBe(
      'offline',
    );
  });
});

describe('toBannerModel', () => {
  it('resolves the offline copy as a warning with no action', () => {
    expect(toBannerModel('offline')).toEqual({
      condition: 'offline',
      variant: 'warning',
      title: NETWORK_OFFLINE_BANNER_TITLE,
      message: NETWORK_OFFLINE_BANNER_MESSAGE,
      actionLabel: null,
      dismissLabel: BANNER_DISMISS_LABEL,
    });
  });

  it('resolves the session copy as a danger with a login CTA', () => {
    const model = toBannerModel('session-expired');

    expect(model.variant).toBe('danger');
    expect(model.title).toBe(SESSION_EXPIRED_BANNER_TITLE);
    expect(model.actionLabel).toBe(SESSION_EXPIRED_BANNER_ACTION_LABEL);
  });

  it('resolves the outage copy as a warning with no action', () => {
    const model = toBannerModel('unavailable');

    expect(model.variant).toBe('warning');
    expect(model.title).toBe(SERVICE_UNAVAILABLE_BANNER_TITLE);
    expect(model.actionLabel).toBeNull();
    expect(model.dismissLabel).toBe(BANNER_DISMISS_LABEL);
  });
});
