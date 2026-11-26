/**
 * Tests of the customers list hook (AIS-19).
 *
 * The mock point is the **network** (MSW), so the real service and transport run
 * and only the wire is replaced. The harness supplies a query client — the app
 * creates its own in `main.tsx`, so a hook test needs one of its own.
 */

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VALID_CUSTOMER_LIST } from '@callback/shared';
import { createCustomerListQuery } from '../../test/mocks/customer-list-query.mock.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersListEmpty,
  customersListServerError,
  customersListSingleRow,
} from '../../test/mocks/handlers/customers.handlers.js';
import { useCustomersList } from './use-customers-list.js';

const PARAMS = createCustomerListQuery();

describe('useCustomersList', () => {
  it('starts loading with the frozen empty list', () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(PARAMS),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.customers).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('returns the rows and the pagination block', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(PARAMS),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.customers).toHaveLength(VALID_CUSTOMER_LIST.length);
    expect(result.current.meta?.pagination.total).toBe(
      VALID_CUSTOMER_LIST.length,
    );
    expect(result.current.errorMessage).toBeNull();
  });

  it('returns an empty page when the server has no rows', async () => {
    server.use(customersListEmpty);

    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(PARAMS),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.customers).toEqual([]);
    expect(result.current.meta?.pagination.totalPages).toBe(0);
  });

  it('returns a narrowed page for a filtered query', async () => {
    server.use(customersListSingleRow);

    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(createCustomerListQuery({ status: 'prospect' })),
    );

    await waitFor(() => {
      expect(result.current.customers).toHaveLength(1);
    });
  });

  it('maps a 500 onto the page surface with a user message', async () => {
    server.use(customersListServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(PARAMS),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.customers).toEqual([]);
  });

  it('refetches when the retry is called', async () => {
    server.use(customersListServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomersList(PARAMS),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    server.use(customersListSingleRow);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.customers).toHaveLength(1);
    });
    expect(result.current.errorMessage).toBeNull();
  });
});
