/**
 * Tests of the customer **create** hook (AIS-182).
 *
 * The mock point is the network (MSW), so the real `customersService` and the
 * transport run and only the wire is replaced — the same harness the other write
 * hooks use. The interesting facts are the three the wizard depends on: exactly
 * one `POST`, the created row back, the `customers` prefix invalidated, and a
 * failure projected as an error view (never thrown away).
 */

import { act, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMERS_PATH,
  VALID_CUSTOMER,
  type CreateCustomerInput,
} from '@callback/shared';
import { successResponse } from '../../test/mocks/handlers/handler-envelope.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersCreateServerError,
  customersCreateSuccess,
  customersCreateTaxConflict,
} from '../../test/mocks/handlers/customers.handlers.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';
import { useCreateCustomerMutation } from './use-create-customer.js';

/** The smallest body the contract accepts. */
const INPUT: CreateCustomerInput = {
  type: 'company',
  legalName: 'Példa Kft.',
};

describe('useCreateCustomerMutation', () => {
  it('starts idle', () => {
    server.use(customersCreateSuccess);

    const { result } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    expect(result.current.isPending).toBe(false);
    expect(result.current.errorSurface).toBeNull();
  });

  it('POSTs the body once and returns the created row', async () => {
    server.use(customersCreateSuccess);
    const recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    let createdId: string | undefined;

    await act(async () => {
      createdId = (await result.current.createCustomer(INPUT)).id;
    });

    expect(createdId).toBe(VALID_CUSTOMER.id);

    await waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    const request = recorder.requests[0];

    expect(request?.method).toBe('POST');
    expect(request?.url).toContain(CUSTOMERS_PATH);
    expect(request?.body).toEqual(INPUT);

    recorder.stop();
  });

  it('invalidates the customers prefix after a successful write', async () => {
    server.use(customersCreateSuccess);

    const { result, client } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => {
      await result.current.createCustomer(INPUT);
    });

    // A new row changes the list page, its `meta.pagination.total` and the empty
    // state, so the whole prefix is refreshed — a hand-patched entry would drift.
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: CUSTOMERS_QUERY_KEYS.all,
    });
  });

  it('reports that the write is in flight until it settles', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.post(CUSTOMERS_PATH, async () => {
        await gate;

        return successResponse(VALID_CUSTOMER);
      }),
    );

    const { result } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    let pending: Promise<unknown> = Promise.resolve();

    act(() => {
      pending = result.current.createCustomer(INPUT);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    release();
    await act(async () => {
      await pending;
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it('projects a duplicate tax number as a mapped failure', async () => {
    server.use(customersCreateTaxConflict);

    const { result } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    await act(async () => {
      await expect(result.current.createCustomer(INPUT)).rejects.toThrow();
    });

    // The hook never swallows: the surface and the message are what the wizard
    // routes to a step, and `error` stays the raw value for the field mapping.
    expect(result.current.error).not.toBeNull();
    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.errorSurface).toBe('field');
  });

  it('projects a server failure as a page-tier failure', async () => {
    server.use(customersCreateServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCreateCustomerMutation(),
    );

    await act(async () => {
      await expect(result.current.createCustomer(INPUT)).rejects.toThrow();
    });

    expect(result.current.errorSurface).not.toBe('field');
    expect(result.current.errorMessage).not.toBeNull();
  });
});
