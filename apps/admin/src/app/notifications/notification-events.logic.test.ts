/**
 * Tests of the event → entry mapping (AIS-84).
 *
 * The functions are pure, so every row of the capture matrix is one assertion —
 * no query client, no DOM, no store. The matrix itself is documented in
 * `docs/Specs/UI-Architecture.md` §4.1.3.
 */

import type { HttpEvent } from '@callback/api-client';
import { describe, expect, it } from 'vitest';
import {
  createAbortError,
  createNetworkError,
  createServerError,
  createServerErrorWithRequestId,
  createStatusError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import { toErrorMessage } from '../../lib/error-message.js';
import {
  HTTP_EVENT_SEPARATOR,
  HTTP_NETWORK_ERROR_LABEL,
  NOTIFICATION_KEY_LENGTH_LIMIT,
  NOTIFICATION_KEY_UNSERIALIZABLE,
} from './notification.const.js';
import {
  readSuccessMessage,
  toErrorDetail,
  toFailureToast,
  toHttpEntry,
  toMutationErrorEntry,
  toMutationSuccessEntry,
  toQueryErrorEntry,
} from './notification-events.logic.js';

/**
 * @param overrides - fields that differ from a successful `GET`.
 * @returns a transport event.
 */
function createHttpEvent(overrides: Partial<HttpEvent> = {}): HttpEvent {
  return {
    method: 'GET',
    path: '/api-keys',
    status: 200,
    durationMs: 42,
    outcome: 'success',
    ...overrides,
  };
}

describe('toHttpEntry', () => {
  it('files a successful attempt as a log-only system entry', () => {
    expect(toHttpEntry(createHttpEvent())).toEqual({
      level: 'system',
      source: 'api',
      message: `GET /api-keys${HTTP_EVENT_SEPARATOR}200`,
      detail: '42 ms',
      toast: false,
    });
  });

  it('files a failed attempt as an error entry that still does not toast', () => {
    const entry = toHttpEntry(
      createHttpEvent({ status: 404, outcome: 'error' }),
    );

    expect(entry.level).toBe('error');
    expect(entry.source).toBe('api');
    expect(entry.message).toBe(`GET /api-keys${HTTP_EVENT_SEPARATOR}404`);
    expect(entry.toast).toBe(false);
  });

  it('labels a missing response as a network failure', () => {
    const entry = toHttpEntry(
      createHttpEvent({ status: null, outcome: 'error' }),
    );

    expect(entry.message).toBe(
      `GET /api-keys${HTTP_EVENT_SEPARATOR}${HTTP_NETWORK_ERROR_LABEL}`,
    );
  });
});

describe('toFailureToast', () => {
  it('never toasts a cancellation or a field failure', () => {
    expect(toFailureToast('silent')).toBe(false);
    expect(toFailureToast('field')).toBe(false);
  });

  it('toasts the banner and page tiers', () => {
    expect(toFailureToast('banner')).toBe(true);
    expect(toFailureToast('page')).toBe(true);
  });
});

describe('toQueryErrorEntry', () => {
  it('stays silent on a cancellation', () => {
    expect(
      toQueryErrorEntry(createAbortError(), { queryKey: ['api-keys'] }),
    ).toBeNull();
  });

  it('toasts an offline failure even though the banner also speaks', () => {
    const entry = toQueryErrorEntry(createNetworkError(), {
      queryKey: ['api-keys'],
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.level).toBe('error');
    expect(entry?.message).toBe(toErrorMessage(createNetworkError()));
  });

  it('toasts a banner-classified 401 failure', () => {
    expect(
      toQueryErrorEntry(createStatusError(401), { queryKey: ['api-keys'] })
        ?.toast,
    ).toBe(true);
  });

  it('toasts a banner-classified 503 failure', () => {
    expect(
      toQueryErrorEntry(createStatusError(503), { queryKey: ['api-keys'] })
        ?.toast,
    ).toBe(true);
  });

  it('logs without a toast when a form field is blamed', () => {
    const entry = toQueryErrorEntry(createValidationError(), {
      queryKey: ['api-keys'],
    });

    expect(entry?.toast).toBe(false);
    expect(entry).not.toBeNull();
  });

  it('toasts a page-level failure and carries the resource key', () => {
    const entry = toQueryErrorEntry(createServerError(), {
      queryKey: ['api-keys', 'list'],
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.detail).toContain('queryKey=["api-keys","list"]');
  });

  it('toasts a thrown non-ApiError, which the classifier files under page', () => {
    expect(
      toQueryErrorEntry(new TypeError('boom'), { queryKey: ['api-keys'] })
        ?.toast,
    ).toBe(true);
  });

  it('includes status, code and requestId in the detail', () => {
    const detail = toErrorDetail(
      createServerErrorWithRequestId(),
      'queryKey',
      ['api-keys'],
    );

    expect(detail).toContain('status=500');
    expect(detail).toContain('code=');
    expect(detail).toContain('requestId=');
  });

  it('omits the correlation id when the server did not send one', () => {
    const detail = toErrorDetail(createServerError(), 'queryKey', undefined);

    expect(detail).not.toContain('requestId=');
  });

  it('describes a non-ApiError by its name instead of pretending to know more', () => {
    expect(toErrorDetail(new TypeError('boom'), 'queryKey', undefined)).toBe(
      'error=TypeError',
    );
  });

  it('omits the key when none was declared', () => {
    expect(
      toErrorDetail(createStatusError(403), 'mutationKey', undefined),
    ).not.toContain('mutationKey');
  });

  it('truncates a very long key and survives a circular one', () => {
    const longKey = new Array(80).fill('segment');
    const longDetail = toErrorDetail(createStatusError(403), 'queryKey', longKey);

    expect(longDetail?.length).toBeLessThan(
      NOTIFICATION_KEY_LENGTH_LIMIT + 40,
    );

    const circular: unknown[] = ['api-keys'];
    circular.push(circular);

    expect(toErrorDetail(createStatusError(403), 'queryKey', circular)).toContain(
      NOTIFICATION_KEY_UNSERIALIZABLE,
    );
  });
});

describe('toMutationErrorEntry', () => {
  it('files a page-level write failure as a toastable entry', () => {
    const entry = toMutationErrorEntry(createServerError(), {
      mutationKey: ['api-keys', 'create'],
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.detail).toContain('mutationKey=["api-keys","create"]');
  });

  it('treats a field-level write failure as log only', () => {
    const entry = toMutationErrorEntry(createValidationError(), {});

    expect(entry?.toast).toBe(false);
    expect(entry?.detail).not.toContain('mutationKey');
  });

  it('stays silent on a cancellation', () => {
    expect(toMutationErrorEntry(createAbortError(), {})).toBeNull();
  });
});

describe('toMutationSuccessEntry', () => {
  it('announces the caller copy when meta carries it', () => {
    const entry = toMutationSuccessEntry({
      meta: { successMessage: '  Az API kulcs létrejött.  ' },
      mutationKey: ['api-keys', 'create'],
    });

    expect(entry).toEqual({
      level: 'success',
      source: 'form',
      message: 'Az API kulcs létrejött.',
      detail: 'mutationKey=["api-keys","create"]',
      toast: true,
    });
  });

  it('stays silent without meta', () => {
    expect(toMutationSuccessEntry({ meta: undefined })).toBeNull();
  });

  it('stays silent when the meta object carries no copy', () => {
    expect(toMutationSuccessEntry({ meta: {} })).toBeNull();
    expect(toMutationSuccessEntry({ meta: { successMessage: 42 } })).toBeNull();
    expect(toMutationSuccessEntry({ meta: { successMessage: '   ' } })).toBeNull();
    expect(toMutationSuccessEntry({ meta: 'successMessage' })).toBeNull();
    expect(toMutationSuccessEntry({ meta: null })).toBeNull();
  });
});

describe('readSuccessMessage', () => {
  it('returns the trimmed copy', () => {
    expect(readSuccessMessage({ successMessage: ' Mentve. ' })).toBe('Mentve.');
  });

  it('rejects everything that is not a non-empty string', () => {
    expect(readSuccessMessage(undefined)).toBeNull();
    expect(readSuccessMessage({})).toBeNull();
    expect(readSuccessMessage({ successMessage: '' })).toBeNull();
    expect(readSuccessMessage({ successMessage: null })).toBeNull();
    expect(readSuccessMessage([])).toBeNull();
  });
});
