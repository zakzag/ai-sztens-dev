/**
 * Tests of {@link toApiErrorView}.
 *
 * Every branch is decided here rather than in a hook, so this suite is the whole
 * proof of the failure projection: which field keeps the raw error, which one
 * renders copy, and which tier owns the failure.
 */

import { describe, expect, it } from 'vitest';
import {
  NETWORK_ERROR_USER_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../../lib/error-message.const.js';
import {
  createAbortError,
  createNetworkError,
  createServerError,
  createStatusError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import { toApiErrorView } from './api-hooks.logic.js';

describe('toApiErrorView', () => {
  it('maps “no failure” to three nulls', () => {
    expect(toApiErrorView(null)).toEqual({
      error: null,
      errorMessage: null,
      errorSurface: null,
    });
    expect(toApiErrorView(undefined)).toEqual({
      error: null,
      errorMessage: null,
      errorSurface: null,
    });
  });

  it('keeps the raw ApiError and routes a 500 to the page tier', () => {
    const failure = createServerError();

    const view = toApiErrorView(failure);

    expect(view.error).toBe(failure);
    expect(view.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    expect(view.errorSurface).toBe('page');
  });

  it('routes a 401 to the banner tier', () => {
    expect(toApiErrorView(createStatusError(401)).errorSurface).toBe('banner');
  });

  it('routes an addressable field failure to the field tier', () => {
    expect(toApiErrorView(createValidationError()).errorSurface).toBe('field');
  });

  it('describes a non-ApiError instead of swallowing it', () => {
    const view = toApiErrorView(new Error('render blew up'));

    // Not an `ApiError`, so the raw slot stays empty — but the failure is still
    // reported as a page-level problem rather than disappearing.
    expect(view.error).toBeNull();
    expect(view.errorSurface).toBe('page');
    expect(view.errorMessage).not.toBeNull();
  });

  it('maps a request without a response to the banner tier and the offline copy', () => {
    const view = toApiErrorView(createNetworkError());

    expect(view.errorSurface).toBe('banner');
    expect(view.errorMessage).toBe(NETWORK_ERROR_USER_MESSAGE);
  });

  it('routes a cancellation to the silent tier', () => {
    expect(toApiErrorView(createAbortError()).errorSurface).toBe('silent');
  });
});
