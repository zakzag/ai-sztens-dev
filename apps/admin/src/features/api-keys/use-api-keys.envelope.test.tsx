/**
 * Contract-drift path of the `api-keys` query, run through the real transport.
 *
 * This is the DoD bullet “service test: malformed payload → `ApiError`
 * `UNEXPECTED_PAYLOAD`”: the handler answers `200` with a body that is **not** a
 * success envelope, and the assertion proves the client really unwrapped the
 * envelope instead of passing a bare payload through.
 */

import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UNEXPECTED_PAYLOAD_CODE } from '@callback/api-client';
import type { ApiKeyListQuery } from '@callback/shared';
import { apiKeysListMalformedPayload } from '../../test/mocks/handlers/api-keys.handlers.js';
import { server } from '../../test/mocks/server.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import { UNEXPECTED_PAYLOAD_USER_MESSAGE } from '../../lib/error-message.const.js';
import { useApiKeysQuery } from './use-api-keys.js';

/** The list query every read test starts from (the contract defaults). */
const LIST_PARAMS: ApiKeyListQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

describe('useApiKeysQuery — contract drift', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('turns a non-envelope 200 body into an UNEXPECTED_PAYLOAD ApiError', async () => {
    server.use(apiKeysListMalformedPayload);

    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: ({ children }) => (
        <TestQueryProvider client={client}>{children}</TestQueryProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.code).toBe(UNEXPECTED_PAYLOAD_CODE);
    expect(result.current.errorMessage).toBe(UNEXPECTED_PAYLOAD_USER_MESSAGE);
    expect(result.current.apiKeys).toEqual([]);
  });
});
