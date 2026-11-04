/**
 * Tests of the capture wiring (AIS-84).
 *
 * The adapters are exercised through the **real** query client factory and a
 * store double, so what is asserted is exactly what the app does: a failed read,
 * a failed write and an announced write each produce one `emit` with the mapped
 * payload — and a silent failure produces none.
 */

import type { HttpEvent } from '@callback/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  createAbortError,
  createNetworkError,
  createServerError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
import {
  createNotificationStoreSpy,
  type NotificationStoreSpy,
} from '../../test/mocks/notification-store.mock.js';
import { toErrorMessage } from '../../lib/error-message.js';
import { createAppQueryClient } from './app-query-client.js';
import {
  APP_QUERY_RETRY_ATTEMPTS,
  APP_REFETCH_ON_WINDOW_FOCUS,
} from './app-query-client.const.js';
import { createHttpEventEmitter } from './notification-capture.js';

/**
 * Runs one query that fails and swallows the rejection.
 *
 * `retry: false` is passed per query on purpose: the factory sets `retry: 1`, and
 * a retrying query would turn every assertion into a one-second wait.
 *
 * @param client - the client under test.
 * @param error - the failure the query reports.
 * @param queryKey - key the entry must carry.
 */
async function runFailingQuery(
  client: QueryClient,
  error: unknown,
  queryKey: readonly unknown[],
): Promise<void> {
  const query = client.getQueryCache().build(client, {
    queryKey,
    queryFn: () => Promise.reject(error),
    retry: false,
  });

  await query.fetch().catch(() => undefined);
}

/**
 * @param store - the store double the adapters write to.
 * @returns the message of every emitted entry, in order.
 */
function messagesOf(store: NotificationStoreSpy): readonly string[] {
  return store.emitted.map((entry) => entry.message);
}

describe('createHttpEventEmitter', () => {
  it('emits a log-only entry for a failed attempt', () => {
    const store = createNotificationStoreSpy();
    const event: HttpEvent = {
      method: 'PATCH',
      path: '/api-keys/abc',
      status: 500,
      durationMs: 12,
      outcome: 'error',
    };

    createHttpEventEmitter(store)(event);

    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0]).toMatchObject({
      level: 'error',
      source: 'api',
      message: 'PATCH /api-keys/abc — 500',
      detail: '12 ms',
      toast: false,
    });
  });

  it('emits a system entry for a successful attempt', () => {
    const store = createNotificationStoreSpy();

    createHttpEventEmitter(store)({
      method: 'GET',
      path: '/api-keys',
      status: 200,
      durationMs: 3,
      outcome: 'success',
    });

    expect(store.emitted[0]).toMatchObject({ level: 'system', toast: false });
  });
});

describe('createAppQueryClient — failure capture', () => {
  it('keeps the fetching defaults of the previous inline client', () => {
    const client = createAppQueryClient(createNotificationStoreSpy());
    const defaults = client.getDefaultOptions().queries;

    expect(defaults?.retry).toBe(APP_QUERY_RETRY_ATTEMPTS);
    expect(defaults?.refetchOnWindowFocus).toBe(APP_REFETCH_ON_WINDOW_FOCUS);
  });

  it('captures a page-level failure as a toastable entry', async () => {
    const store = createNotificationStoreSpy();
    const error = createServerError();

    await runFailingQuery(createAppQueryClient(store), error, [
      'api-keys',
      'list',
    ]);

    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0]).toMatchObject({
      level: 'error',
      source: 'api',
      message: toErrorMessage(error),
      toast: true,
    });
    expect(store.emitted[0]?.detail).toContain('queryKey=["api-keys","list"]');
  });

  it('captures a banner-level failure without asking for a toast', async () => {
    const store = createNotificationStoreSpy();

    await runFailingQuery(createAppQueryClient(store), createNetworkError(), [
      'api-keys',
    ]);

    expect(store.emitted[0]).toMatchObject({
      message: toErrorMessage(createNetworkError()),
      toast: false,
    });
  });

  it('captures a field-level failure as log only', async () => {
    const store = createNotificationStoreSpy();

    await runFailingQuery(createAppQueryClient(store), createValidationError(), [
      'api-keys',
    ]);

    expect(store.emitted[0]).toMatchObject({ toast: false });
  });

  it('captures nothing for a cancelled request', async () => {
    const store = createNotificationStoreSpy();

    await runFailingQuery(createAppQueryClient(store), createAbortError(), [
      'api-keys',
    ]);

    expect(store.emit).not.toHaveBeenCalled();
  });
});

describe('createAppQueryClient — mutation capture', () => {
  it('announces the caller copy on a successful write', async () => {
    const store = createNotificationStoreSpy();
    const client = createAppQueryClient(store);

    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['api-keys', 'create'],
      mutationFn: () => Promise.resolve({ id: 'abc' }),
      meta: { successMessage: 'Az API kulcs létrejött.' },
    });

    await mutation.execute(undefined);

    expect(messagesOf(store)).toEqual(['Az API kulcs létrejött.']);
    expect(store.emitted[0]).toMatchObject({
      level: 'success',
      source: 'form',
      toast: true,
    });
  });

  it('logs nothing when the write announced no copy', async () => {
    const store = createNotificationStoreSpy();
    const client = createAppQueryClient(store);

    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.resolve({ id: 'abc' }),
    });

    await mutation.execute(undefined);

    expect(store.emit).not.toHaveBeenCalled();
  });

  it('captures a failed write with its mutation key', async () => {
    const store = createNotificationStoreSpy();
    const client = createAppQueryClient(store);
    const error = createServerError();

    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['api-keys', 'create'],
      mutationFn: () => Promise.reject(error),
      retry: false,
    });

    await mutation.execute(undefined).catch(() => undefined);

    expect(store.emitted).toHaveLength(1);
    expect(store.emitted[0]?.detail).toContain(
      'mutationKey=["api-keys","create"]',
    );
  });
});
