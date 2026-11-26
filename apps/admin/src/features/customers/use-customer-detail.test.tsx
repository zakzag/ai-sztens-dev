/**
 * Tests of the customer detail hook (AIS-20).
 *
 * The mock point is the **network** (MSW), so the real `customersService` and
 * transport run and only the wire is replaced — the same choice the list hook's
 * test makes. The four states the ticket asks for are asserted here: loading,
 * success, `404` and `500`.
 */

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { isNotFoundFailure } from '../../lib/error-surface.logic.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersDetailNotFound,
  customersDetailServerError,
  customersDetailSuccess,
} from '../../test/mocks/handlers/customers.handlers.js';
import { useCustomerDetail } from './use-customer-detail.js';

const CUSTOMER_ID = VALID_CUSTOMER_DETAIL.id;

describe('useCustomerDetail', () => {
  it('starts loading without a payload', () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail(CUSTOMER_ID),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.errorSurface).toBeNull();
  });

  it('returns the detail payload of the requested customer', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail(CUSTOMER_ID),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.id).toBe(CUSTOMER_ID);
    // The detail carries the children the page needs in one round trip.
    expect(result.current.data?.contacts).toHaveLength(
      VALID_CUSTOMER_DETAIL.contacts.length,
    );
    expect(result.current.data?.tags).toHaveLength(
      VALID_CUSTOMER_DETAIL.tags.length,
    );
    expect(result.current.errorMessage).toBeNull();
  });

  it('maps an unknown id onto the page surface as a not-found failure', async () => {
    server.use(customersDetailNotFound);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail('00000000-0000-4000-8000-000000000000'),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(isNotFoundFailure(result.current.error)).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('maps a 500 onto the page surface with a user message', async () => {
    server.use(customersDetailServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail(CUSTOMER_ID),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(isNotFoundFailure(result.current.error)).toBe(false);
    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('issues no request while the id is missing', () => {
    // A failing handler is registered: a request would surface as an error, so
    // the absence of one proves the `enabled: false` branch.
    server.use(customersDetailServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail(undefined),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('refetches when the retry is called', async () => {
    server.use(customersDetailServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerDetail(CUSTOMER_ID),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    server.use(customersDetailSuccess);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data?.id).toBe(CUSTOMER_ID);
    });
    expect(result.current.errorMessage).toBeNull();
  });
});
