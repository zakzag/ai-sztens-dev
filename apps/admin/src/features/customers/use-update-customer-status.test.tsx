/**
 * Tests of the dedicated status-change hook (AIS-21).
 *
 * The status has its own route on the server, so the two facts worth pinning are
 * the **address** (`…/:id/status`) and the **body** (`status` + `updatedAt` only)
 * — a field `PATCH` must never be able to carry it.
 */

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { isStaleWriteFailure } from '../../lib/error-surface.logic.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersStatusStaleWrite,
  customersStatusSuccess,
} from '../../test/mocks/handlers/customers.handlers.js';
import { useUpdateCustomerStatusMutation } from './use-update-customer-status.js';

const CUSTOMER_ID = VALID_CUSTOMER_DETAIL.id;
const UPDATED_AT = '2026-11-20T09:00:00.000Z';

describe('useUpdateCustomerStatusMutation', () => {
  it('patches the status route with the status and the token only', async () => {
    server.use(customersStatusSuccess);
    const recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerStatusMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await result.current.updateCustomerStatus({
        status: 'active',
        updatedAt: UPDATED_AT,
      });
    });

    await waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    const request = recorder.requests[0];

    expect(request?.method).toBe('PATCH');
    expect(request?.url).toContain(
      `/api/admin/customers/${CUSTOMER_ID}/status`,
    );
    expect(request?.body).toEqual({ status: 'active', updatedAt: UPDATED_AT });

    recorder.stop();
  });

  it('reports a stale write as a page-tier failure', async () => {
    server.use(customersStatusStaleWrite);

    const { result } = renderHookWithQueryClient(() =>
      useUpdateCustomerStatusMutation(CUSTOMER_ID),
    );

    await act(async () => {
      await expect(
        result.current.updateCustomerStatus({
          status: 'suspended',
          updatedAt: UPDATED_AT,
        }),
      ).rejects.toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(isStaleWriteFailure(result.current.error)).toBe(true);
    expect(result.current.isPending).toBe(false);
  });
});
