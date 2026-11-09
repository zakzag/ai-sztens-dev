/**
 * Tests of the event → entry mapping (AIS-84, structured rows since AIS-152).
 *
 * The functions are pure, so every row of the capture matrix is one assertion —
 * no query client, no DOM, no store. The matrix itself is documented in
 * `docs/Specs/UI-Architecture.md` §4.1.3.
 */

import { describe, expect, it } from 'vitest';
import {
  createAbortError,
  createCodedError,
  createConflictError,
  createMultiFieldValidationError,
  createNetworkError,
  createServerError,
  createServerErrorWithRequestId,
  createStatusError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import { createTestHttpEvent, createTestHttpEventMeta } from '../../test/mocks/http-event.fixture.js';
import { toErrorMessage } from '../../lib/error-message.js';
import {
  DETAIL_LABEL_BODY_PREVIEW,
  DETAIL_LABEL_CODE,
  DETAIL_LABEL_COMPONENT_STACK,
  DETAIL_LABEL_DURATION,
  DETAIL_LABEL_ERROR_NAME,
  DETAIL_LABEL_ISSUES,
  DETAIL_LABEL_MESSAGE,
  DETAIL_LABEL_METHOD,
  DETAIL_LABEL_OPERATION,
  DETAIL_LABEL_OUTCOME,
  DETAIL_LABEL_PATH,
  DETAIL_LABEL_QUERY,
  DETAIL_LABEL_REQUEST_ID,
  DETAIL_LABEL_RESPONSE_TIMESTAMP,
  DETAIL_LABEL_SOURCE,
  DETAIL_LABEL_STACK,
  DETAIL_LABEL_STATUS,
  DETAIL_LABEL_SURFACE,
  DETAIL_LABEL_TOTAL_ITEMS,
  DETAIL_LABEL_URL,
  HTTP_EVENT_SEPARATOR,
  HTTP_NETWORK_ERROR_LABEL,
  MUTATION_KEY_DETAIL_LABEL,
  NOTIFICATION_KEY_LENGTH_LIMIT,
  NOTIFICATION_KEY_UNSERIALIZABLE,
  QUERY_KEY_DETAIL_LABEL,
} from './notification.const.js';
import {
  readOperationMeta,
  readSuccessMessage,
  toErrorDetail,
  toFailureDetails,
  toFailureToast,
  toHttpDetails,
  toHttpEntry,
  toMutationErrorEntry,
  toMutationSuccessEntry,
  toQueryErrorEntry,
  toRuntimeDetails,
} from './notification-events.logic.js';

describe('toHttpEntry', () => {
  it('files a successful attempt as a log-only system entry', () => {
    expect(toHttpEntry(createTestHttpEvent(), null)).toMatchObject({
      level: 'system',
      source: 'api',
      message: `GET /api-keys${HTTP_EVENT_SEPARATOR}200`,
      detail: '42 ms',
      toast: false,
    });
  });

  it('files a failed attempt as an error entry that still does not toast', () => {
    const entry = toHttpEntry(
      createTestHttpEvent({ status: 404, outcome: 'error' }),
      null,
    );

    expect(entry.level).toBe('error');
    expect(entry.source).toBe('api');
    expect(entry.message).toBe(`GET /api-keys${HTTP_EVENT_SEPARATOR}404`);
    expect(entry.toast).toBe(false);
  });

  it('labels a missing response as a network failure', () => {
    const entry = toHttpEntry(
      createTestHttpEvent({
        status: null,
        outcome: 'error',
        requestId: null,
        responseMeta: null,
      }),
      null,
    );

    expect(entry.message).toBe(
      `GET /api-keys${HTTP_EVENT_SEPARATOR}${HTTP_NETWORK_ERROR_LABEL}`,
    );
  });

  it('carries the structured rows too, without touching the one-line detail', () => {
    const entry = toHttpEntry(createTestHttpEvent(), '/api-keys');

    expect(entry.detail).toBe('42 ms');
    expect(entry.details).toEqual(
      toHttpDetails(createTestHttpEvent(), '/api-keys'),
    );
  });
});

describe('toHttpDetails', () => {
  it('builds every row in reading order', () => {
    expect(
      toHttpDetails(
        createTestHttpEvent({
          method: 'PATCH',
          path: '/api-keys/abc',
          query: 'page=1',
          status: 409,
          durationMs: 12,
          outcome: 'error',
          requestId: 'req-1',
          bodyPreview: '{"name":"first"}',
          responseMeta: createTestHttpEventMeta({ totalItems: 3 }),
        }),
        '/api-keys/$identifier',
      ),
    ).toEqual([
      { label: DETAIL_LABEL_METHOD, value: 'PATCH' },
      { label: DETAIL_LABEL_PATH, value: '/api-keys/abc', mono: true },
      { label: DETAIL_LABEL_QUERY, value: 'page=1', mono: true },
      { label: DETAIL_LABEL_STATUS, value: '409' },
      { label: DETAIL_LABEL_DURATION, value: '12 ms' },
      { label: DETAIL_LABEL_OUTCOME, value: 'error' },
      { label: DETAIL_LABEL_REQUEST_ID, value: 'req-1', mono: true },
      {
        label: DETAIL_LABEL_RESPONSE_TIMESTAMP,
        value: '2026-11-07T10:00:00.000Z',
        mono: true,
      },
      { label: DETAIL_LABEL_TOTAL_ITEMS, value: '3' },
      {
        label: DETAIL_LABEL_BODY_PREVIEW,
        value: '{"name":"first"}',
        mono: true,
      },
      { label: DETAIL_LABEL_OPERATION, value: '/api-keys/$identifier' },
      { label: DETAIL_LABEL_SOURCE, value: 'api' },
    ]);
  });

  it('skips a row whose value is unknown', () => {
    const labels = toHttpDetails(
      createTestHttpEvent({
        requestId: null,
        responseMeta: null,
        bodyPreview: null,
      }),
      null,
    ).map((field) => field.label);

    expect(labels).not.toContain(DETAIL_LABEL_QUERY);
    expect(labels).not.toContain(DETAIL_LABEL_REQUEST_ID);
    expect(labels).not.toContain(DETAIL_LABEL_RESPONSE_TIMESTAMP);
    expect(labels).not.toContain(DETAIL_LABEL_TOTAL_ITEMS);
    expect(labels).not.toContain(DETAIL_LABEL_BODY_PREVIEW);
    expect(labels).not.toContain(DETAIL_LABEL_OPERATION);
  });

  it('labels a missing response with the network label', () => {
    const status = toHttpDetails(
      createTestHttpEvent({ status: null, outcome: 'error' }),
      null,
    ).find((field) => field.label === DETAIL_LABEL_STATUS);

    expect(status?.value).toBe(HTTP_NETWORK_ERROR_LABEL);
  });
});

describe('toFailureDetails', () => {
  it('opens one row per field issue', () => {
    const fields = toFailureDetails(
      createMultiFieldValidationError(),
      QUERY_KEY_DETAIL_LABEL,
      undefined,
      'field',
    );

    expect(fields).toEqual([
      { label: DETAIL_LABEL_CODE, value: 'VALIDATION_FAILED' },
      { label: DETAIL_LABEL_STATUS, value: '400' },
      {
        label: 'name',
        value: 'String must contain at least 1 character(s)',
      },
      {
        label: 'apiKey',
        value: 'String must contain at least 8 character(s)',
      },
      { label: 'metadata.owner', value: 'Unrecognized key' },
      { label: DETAIL_LABEL_URL, value: '/api/api-keys', mono: true },
      { label: DETAIL_LABEL_SURFACE, value: 'field' },
      { label: DETAIL_LABEL_ERROR_NAME, value: 'ApiError' },
    ]);
  });

  it('files an issue without a path under the issues label', () => {
    const fields = toFailureDetails(
      createCodedError({
        status: 400,
        code: 'VALIDATION_FAILED',
        issues: [{ path: '', message: 'the whole payload is wrong' }],
      }),
      QUERY_KEY_DETAIL_LABEL,
      undefined,
      'page',
    );

    expect(fields).toContainEqual({
      label: DETAIL_LABEL_ISSUES,
      value: 'the whole payload is wrong',
    });
  });

  it('adds no issue row for a failure without issues', () => {
    const labels = toFailureDetails(
      createServerError(),
      QUERY_KEY_DETAIL_LABEL,
      undefined,
      'page',
    ).map((field) => field.label);

    expect(labels).toEqual([
      DETAIL_LABEL_CODE,
      DETAIL_LABEL_STATUS,
      DETAIL_LABEL_URL,
      DETAIL_LABEL_SURFACE,
      DETAIL_LABEL_ERROR_NAME,
    ]);
  });

  it('records the request id and the resource key when they exist', () => {
    const fields = toFailureDetails(
      createConflictError(),
      MUTATION_KEY_DETAIL_LABEL,
      ['api-keys', 'update'],
      'field',
    );

    expect(fields).toContainEqual({
      label: DETAIL_LABEL_REQUEST_ID,
      value: 'req-conflict',
      mono: true,
    });
    expect(fields).toContainEqual({
      label: MUTATION_KEY_DETAIL_LABEL,
      value: '["api-keys","update"]',
      mono: true,
    });
  });

  it('describes a non-ApiError by its name only', () => {
    expect(
      toFailureDetails(new TypeError('boom'), QUERY_KEY_DETAIL_LABEL, undefined, 'page'),
    ).toEqual([
      { label: DETAIL_LABEL_ERROR_NAME, value: 'TypeError' },
      { label: DETAIL_LABEL_SURFACE, value: 'page' },
    ]);
  });
});

describe('toRuntimeDetails', () => {
  /** @returns a crash report with a known stack. */
  function createReport(): Parameters<typeof toRuntimeDetails>[0] {
    const error = new Error('boom');
    error.stack = 'at Component (file.tsx:1:1)';

    return { error, componentStack: 'at <Page> (file.tsx:2:2)' };
  }

  it('records the name and the message without the stack by default', () => {
    expect(toRuntimeDetails(createReport(), false)).toEqual([
      { label: DETAIL_LABEL_ERROR_NAME, value: 'Error' },
      { label: DETAIL_LABEL_MESSAGE, value: 'boom' },
      {
        label: DETAIL_LABEL_COMPONENT_STACK,
        value: 'at <Page> (file.tsx:2:2)',
        mono: true,
      },
    ]);
  });

  it('records the stack only when the caller allows it', () => {
    const fields = toRuntimeDetails(createReport(), true);

    expect(fields).toContainEqual({
      label: DETAIL_LABEL_STACK,
      value: 'at Component (file.tsx:1:1)',
      mono: true,
    });
  });

  it('skips the message of a thrown non-Error value', () => {
    expect(
      toRuntimeDetails({ error: 'boom', componentStack: null }, true),
    ).toEqual([{ label: DETAIL_LABEL_ERROR_NAME, value: 'string' }]);
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
      toQueryErrorEntry(createAbortError(), {
        queryKey: ['api-keys'],
        operation: null,
      }),
    ).toBeNull();
  });

  it('toasts an offline failure even though the banner also speaks', () => {
    const entry = toQueryErrorEntry(createNetworkError(), {
      queryKey: ['api-keys'],
      operation: null,
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.level).toBe('error');
    expect(entry?.message).toBe(toErrorMessage(createNetworkError()));
  });

  it('toasts a banner-classified 401 failure', () => {
    expect(
      toQueryErrorEntry(createStatusError(401), {
        queryKey: ['api-keys'],
        operation: null,
      })?.toast,
    ).toBe(true);
  });

  it('toasts a banner-classified 503 failure', () => {
    expect(
      toQueryErrorEntry(createStatusError(503), {
        queryKey: ['api-keys'],
        operation: null,
      })?.toast,
    ).toBe(true);
  });

  it('logs without a toast when a form field is blamed', () => {
    const entry = toQueryErrorEntry(createValidationError(), {
      queryKey: ['api-keys'],
      operation: null,
    });

    expect(entry?.toast).toBe(false);
    expect(entry).not.toBeNull();
  });

  it('toasts a page-level failure and carries the resource key', () => {
    const entry = toQueryErrorEntry(createServerError(), {
      queryKey: ['api-keys', 'list'],
      operation: 'api-keys.list',
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.detail).toContain('queryKey=["api-keys","list"]');
    // The operation is a row of the structured half, never part of `detail`.
    expect(entry?.details).toContainEqual({
      label: DETAIL_LABEL_OPERATION,
      value: 'api-keys.list',
    });
  });

  it('toasts a thrown non-ApiError, which the classifier files under page', () => {
    expect(
      toQueryErrorEntry(new TypeError('boom'), {
        queryKey: ['api-keys'],
        operation: null,
      })?.toast,
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
      operation: null,
    });

    expect(entry?.toast).toBe(true);
    expect(entry?.detail).toContain('mutationKey=["api-keys","create"]');
  });

  it('treats a field-level write failure as log only', () => {
    const entry = toMutationErrorEntry(createValidationError(), {
      operation: null,
    });

    expect(entry?.toast).toBe(false);
    expect(entry?.detail).not.toContain('mutationKey');
  });

  it('stays silent on a cancellation', () => {
    expect(
      toMutationErrorEntry(createAbortError(), { operation: null }),
    ).toBeNull();
  });
});

describe('toMutationSuccessEntry', () => {
  it('announces the caller copy when meta carries it', () => {
    const entry = toMutationSuccessEntry({
      meta: { successMessage: '  Az API kulcs létrejött.  ' },
      mutationKey: ['api-keys', 'create'],
      operation: null,
    });

    expect(entry).toEqual({
      level: 'success',
      source: 'form',
      message: 'Az API kulcs létrejött.',
      detail: 'mutationKey=["api-keys","create"]',
      details: [
        {
          label: MUTATION_KEY_DETAIL_LABEL,
          value: '["api-keys","create"]',
          mono: true,
        },
      ],
      toast: true,
    });
  });

  it('carries the operation row when the caller declared one', () => {
    const entry = toMutationSuccessEntry({
      meta: { successMessage: 'Mentve.', operation: 'api-keys.create' },
      operation: 'api-keys.create',
    });

    expect(entry?.details).toEqual([
      { label: DETAIL_LABEL_OPERATION, value: 'api-keys.create' },
    ]);
  });

  it('stays silent without meta', () => {
    expect(
      toMutationSuccessEntry({ meta: undefined, operation: null }),
    ).toBeNull();
  });

  it('stays silent when the meta object carries no copy', () => {
    expect(
      toMutationSuccessEntry({ meta: {}, operation: null }),
    ).toBeNull();
    expect(
      toMutationSuccessEntry({ meta: { successMessage: 42 }, operation: null }),
    ).toBeNull();
    expect(
      toMutationSuccessEntry({
        meta: { successMessage: '   ' },
        operation: null,
      }),
    ).toBeNull();
    expect(
      toMutationSuccessEntry({ meta: 'successMessage', operation: null }),
    ).toBeNull();
    expect(
      toMutationSuccessEntry({ meta: null, operation: null }),
    ).toBeNull();
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

describe('readOperationMeta', () => {
  it('returns the trimmed operation', () => {
    expect(readOperationMeta({ operation: ' api-keys.update ' })).toBe(
      'api-keys.update',
    );
  });

  it('rejects everything that is not a non-empty string', () => {
    expect(readOperationMeta(undefined)).toBeNull();
    expect(readOperationMeta({})).toBeNull();
    expect(readOperationMeta({ operation: '' })).toBeNull();
    expect(readOperationMeta({ operation: '   ' })).toBeNull();
    expect(readOperationMeta({ operation: 42 })).toBeNull();
    expect(readOperationMeta('operation')).toBeNull();
  });
});
