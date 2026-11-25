/**
 * Tests of the customer field-update hook (AIS-21).
 *
 * The mock point is the **network** (MSW), so the real `customersService` and the
 * transport run and only the wire is replaced — the same harness the detail read
 * uses. The failure cases are the ones the edit form has to route: a `409` stale
 * write (page tier, with the recogniser the form uses), a `422` carrying an
 * addressable path, and a `500`.
 */

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VALID_CUSTOMER_DETAIL, type UpdateCustomerInput } from '@callback/shared';
import { isStaleWriteFailure } from '../../lib/error-surface.logic.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersUpdateServerError,
  customersUpdateStaleWrite,
  customersUpdateSuccess,
  customersUpdateTaxConflict,
  customersUpdateValidationError,
} from '../../test/mocks/handlers/customers.handlers.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';
import { useUpdateCustomerMutation } from './use-update-customer.js';

const CUSTOMER_ID = VALID_CUSTOMER_DETAIL.id;
const UPDATED_AT = '2026-11-20T09:00:00.000Z';

/** The smallest legal body: one changed field plus the concurrency token. */
const INPUT: UpdateCustomerInput = {
  legalName: 'Példa Kft.',
  updatedAt: UPDATED_AT,
};

describe('useUpdateCustomerMutation', () => {
  it('starts idle', () => {
    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    expect(result.current.isPending).toBe(false);
    expect(result.current.errorSurface).toBeNull();
  });

  it('sends the body to PATCH /:id and returns the written row', async () => {
    server.use(customersUpdateSuccess);
    const recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    let writtenId: string | undefined;

    await act(async () => {
      writtenId = (await result.current.updateCustomer(INPUT)).id;
    });

    expect(writtenId).toBe(CUSTOMER_ID);

    await waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    const request = recorder.requests[0];

    expect(request?.method).toBe('PATCH');
    expect(request?.url).toContain(`/api/admin/customers/${CUSTOMER_ID}`);
    expect(request?.body).toEqual(INPUT);

    recorder.stop();
  });

  it('invalidates the customers prefix after a successful write', async () => {
    server.use(customersUpdateSuccess);

    const { result, client } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => {
      await result.current.updateCustomer(INPUT);
    });

    // A **prefix**, never a hand-patched entry: the write changes the list row
    // (`hasMissingData` is derived) as well as the detail, and the mutation awaits
    // the invalidation, so a caller that navigates right away cannot leave a stale
    // page behind.
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: CUSTOMERS_QUERY_KEYS.all,
    });
  });

  it('reports a stale write as a page-tier failure the form can recognise', async () => {
    server.use(customersUpdateStaleWrite);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await expect(result.current.updateCustomer(INPUT)).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(isStaleWriteFailure(result.current.error)).toBe(true);
    expect(result.current.errorMessage).not.toBeNull();
  });

  it('keeps the addressable path of a semantic validation failure', async () => {
    server.use(customersUpdateValidationError);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await expect(result.current.updateCustomer(INPUT)).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.issues[0]?.path).toBe('legalName');
    expect(isStaleWriteFailure(result.current.error)).toBe(false);
  });

  it('treats a tax-number conflict as a field-tier failure', async () => {
    server.use(customersUpdateTaxConflict);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await expect(result.current.updateCustomer(INPUT)).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('field');
    });
  });

  it('maps a 500 onto the page surface with a message', async () => {
    server.use(customersUpdateServerError);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await expect(result.current.updateCustomer(INPUT)).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).not.toBeNull();
  });
});
