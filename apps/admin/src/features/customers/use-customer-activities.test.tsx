/**
 * Tests of the activity feed hooks (AIS-181).
 *
 * The mock point is the **network** (MSW), so the real service and transport run
 * and only the wire is replaced. The write cases assert the request body through
 * `createRequestRecorder`, because there is no service double: the payload the
 * client sent is the only place that fact lives.
 */

import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActivityListQuery } from '@callback/shared';
import { VALID_ACTIVITY, VALID_ACTIVITY_LIST } from '@callback/shared';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import type { RequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customerActivityCreateSuccess,
  customerActivityRemoveSuccess,
  customerActivityUpdateStaleWrite,
  customerActivityUpdateSuccess,
  customersActivitiesEmpty,
  customersActivitiesServerError,
} from '../../test/mocks/handlers/customers.handlers.js';
import {
  useCreateActivityMutation,
  useCustomerActivities,
  useRemoveActivityMutation,
  useUpdateActivityMutation,
} from './use-customer-activities.js';

/** The customer the hooks are bound to. */
const CUSTOMER_ID = VALID_ACTIVITY.customerId;

/** The entry the writes address. */
const ACTIVITY_ID = VALID_ACTIVITY.id;

/** A defaulted feed query, as the tab passes it. */
const QUERY: ActivityListQuery = { page: 1, limit: 20, order: 'desc' };

/** One recorder per test, stopped afterwards so no listener leaks. */
let recorder: RequestRecorder | null = null;

afterEach(() => {
  recorder?.stop();
  recorder = null;
});

describe('useCustomerActivities', () => {
  it('starts loading with the frozen empty list', () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerActivities(CUSTOMER_ID, QUERY),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.activities).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('returns the rows and the pagination block', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerActivities(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toHaveLength(VALID_ACTIVITY_LIST.length);
    expect(result.current.meta?.pagination.total).toBe(
      VALID_ACTIVITY_LIST.length,
    );
    expect(result.current.errorMessage).toBeNull();
  });

  it('returns an empty page when the customer has no entry', async () => {
    server.use(customersActivitiesEmpty);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerActivities(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.meta?.pagination.totalPages).toBe(0);
  });

  it('maps a 500 onto the page surface with a message', async () => {
    server.use(customersActivitiesServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerActivities(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.activities).toEqual([]);
  });
});

describe('useCreateActivityMutation', () => {
  it('posts the entry and answers the written row', async () => {
    server.use(customerActivityCreateSuccess);
    recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useCreateActivityMutation(CUSTOMER_ID),
    );

    let written: unknown;

    await act(async () => {
      written = await result.current.createActivity({
        type: 'note',
        body: 'Új megjegyzés',
      });
    });

    expect(written).toEqual(VALID_ACTIVITY);

    const posted = recorder.requests.find((request) => request.method === 'POST');
    expect(posted?.url).toContain(`/customers/${CUSTOMER_ID}/activities`);
    expect(posted?.body).toEqual({ type: 'note', body: 'Új megjegyzés' });
  });
});

describe('useUpdateActivityMutation', () => {
  it('sends the concurrency token with the new body', async () => {
    server.use(customerActivityUpdateSuccess);
    recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useUpdateActivityMutation(CUSTOMER_ID, ACTIVITY_ID),
    );

    await act(async () => {
      await result.current.updateActivity({
        body: 'Módosított szöveg',
        updatedAt: '2026-11-23T09:00:00.000Z',
      });
    });

    const patched = recorder.requests.find(
      (request) => request.method === 'PATCH',
    );
    expect(patched?.url).toContain(
      `/customers/${CUSTOMER_ID}/activities/${ACTIVITY_ID}`,
    );
    expect(patched?.body).toEqual({
      body: 'Módosított szöveg',
      updatedAt: '2026-11-23T09:00:00.000Z',
    });
  });

  it('surfaces a 409 STALE_WRITE as a mapped failure', async () => {
    server.use(customerActivityUpdateStaleWrite);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateActivityMutation(CUSTOMER_ID, ACTIVITY_ID),
    );

    await act(async () => {
      await expect(
        result.current.updateActivity({
          body: 'Módosított szöveg',
          updatedAt: '2026-11-23T09:00:00.000Z',
        }),
      ).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.errorMessage).not.toBeNull();
  });
});

describe('useRemoveActivityMutation', () => {
  it('soft-deletes the entry and answers null', async () => {
    server.use(customerActivityRemoveSuccess);
    recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useRemoveActivityMutation(CUSTOMER_ID, ACTIVITY_ID),
    );

    let removed: null | undefined;

    await act(async () => {
      removed = await result.current.removeActivity();
    });

    expect(removed).toBeNull();

    const deleted = recorder.requests.find(
      (request) => request.method === 'DELETE',
    );
    expect(deleted?.url).toContain(
      `/customers/${CUSTOMER_ID}/activities/${ACTIVITY_ID}`,
    );
  });
});
