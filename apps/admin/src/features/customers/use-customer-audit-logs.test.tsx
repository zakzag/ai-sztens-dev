/**
 * Tests of the read-only audit-log hook (AIS-181).
 *
 * Beyond the four states, one property is specific to this hook: **it never
 * writes.** The assertion is made on the recorder (the requests the client
 * actually sent), so a mutation accidentally wired into the module would show up
 * here as a non-`GET` request.
 */

import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuditLogListQuery } from '@callback/shared';
import { VALID_AUDIT_LOG_LIST } from '@callback/shared';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import type { RequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderHookWithQueryClient } from '../../test/mocks/render-hook-with-query.mock.js';
import { server } from '../../test/mocks/server.js';
import {
  customersAuditLogsEmpty,
  customersAuditLogsServerError,
} from '../../test/mocks/handlers/customers.handlers.js';
import { useCustomerAuditLogs } from './use-customer-audit-logs.js';

/** The customer the hook is bound to. */
const CUSTOMER_ID = VALID_AUDIT_LOG_LIST[0]?.customerId ?? '';

/** A defaulted ledger query, as the tab passes it. */
const QUERY: AuditLogListQuery = { page: 1, limit: 20, order: 'desc' };

/** One recorder per test, stopped afterwards so no listener leaks. */
let recorder: RequestRecorder | null = null;

afterEach(() => {
  recorder?.stop();
  recorder = null;
});

describe('useCustomerAuditLogs', () => {
  it('starts loading with the frozen empty list', () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, QUERY),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.auditLogs).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('returns the rows and the pagination block', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.auditLogs).toHaveLength(VALID_AUDIT_LOG_LIST.length);
    expect(result.current.meta?.pagination.total).toBe(
      VALID_AUDIT_LOG_LIST.length,
    );
    expect(result.current.errorMessage).toBeNull();
  });

  it('sends every filter of the query to the server', async () => {
    recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, {
        page: 2,
        limit: 50,
        order: 'desc',
        tableName: 'customers',
        operation: 'update',
        actorId: 'actor-1',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-02T00:00:00.000Z',
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const request = recorder.requests.find((entry) => entry.method === 'GET');

    expect(request?.url).toContain('tableName=customers');
    expect(request?.url).toContain('operation=update');
    expect(request?.url).toContain('actorId=actor-1');
    expect(request?.url).toContain('page=2');
    expect(request?.url).toContain('limit=50');
    expect(request?.url).toContain('from=2026-11-01');
    expect(request?.url).toContain('to=2026-11-02');
  });

  it('returns an empty page when the filter finds nothing', async () => {
    server.use(customersAuditLogsEmpty);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.auditLogs).toEqual([]);
    expect(result.current.meta?.pagination.totalPages).toBe(0);
  });

  it('maps a 500 onto the page surface with a message', async () => {
    server.use(customersAuditLogsServerError);

    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.auditLogs).toEqual([]);
  });

  it('never issues a write request', async () => {
    recorder = createRequestRecorder();

    const { result } = renderHookWithQueryClient(() =>
      useCustomerAuditLogs(CUSTOMER_ID, QUERY),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(recorder.requests.every((entry) => entry.method === 'GET')).toBe(true);
  });
});
