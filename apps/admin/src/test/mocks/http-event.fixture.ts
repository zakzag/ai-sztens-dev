/**
 * `HttpEvent` and operation-reader doubles for the admin tests (AIS-152).
 *
 * The transport event grew four fields; keeping one factory here means a future
 * field is added once instead of in every spec — and no test file hand-crafts an
 * event, which is the project rule for mocks.
 */

import type { HttpEvent, HttpEventResponseMeta } from '@callback/api-client';
import type { OperationReader } from '../../app/notifications/notification.interface.js';

/** Fixed meta of the fixture events. */
export const TEST_HTTP_EVENT_META: HttpEventResponseMeta = {
  requestId: 'req-test-1',
  timestamp: '2026-11-07T10:00:00.000Z',
  totalItems: null,
};

/**
 * @param overrides - meta fields that differ from the fixture default.
 * @returns a complete `HttpEventResponseMeta`.
 */
export function createTestHttpEventMeta(
  overrides: Partial<HttpEventResponseMeta> = {},
): HttpEventResponseMeta {
  return { ...TEST_HTTP_EVENT_META, ...overrides };
}

/**
 * @param overrides - fields that differ from a successful `GET`.
 * @returns a complete transport event.
 */
export function createTestHttpEvent(
  overrides: Partial<HttpEvent> = {},
): HttpEvent {
  return {
    method: 'GET',
    path: '/api-keys',
    status: 200,
    durationMs: 42,
    outcome: 'success',
    requestId: TEST_HTTP_EVENT_META.requestId,
    query: '',
    bodyPreview: null,
    responseMeta: createTestHttpEventMeta(),
    ...overrides,
  };
}

/**
 * @param operation - what the reader must answer; `null` models “unknown”.
 * @returns an operation reader for the capture adapter.
 */
export function createTestOperationReader(
  operation: string | null,
): OperationReader {
  return () => operation;
}
