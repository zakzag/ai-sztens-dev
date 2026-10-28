/**
 * Query-cache fixtures for the error-surface tests.
 *
 * The app-level banner reads *errors* from the query cache, so a test needs a
 * cache that already holds a failed query — without mounting a component that
 * performs a request. Building the cache entry directly is the shortest honest
 * way to express “this query failed”.
 */

import type { QueryClient } from '@tanstack/react-query';

/** Key prefix of the synthetic queries these helpers create. */
const SEEDED_QUERY_KEY = 'seeded-error';

/**
 * Puts one failed query into the cache.
 *
 * @param client - the test's query client.
 * @param error - the failure to store (already `Error`-typed, as TanStack keeps it).
 * @param keySuffix - distinguishes several seeded failures in one cache.
 */
export function seedQueryError(
  client: QueryClient,
  error: Error,
  keySuffix = 'default',
): void {
  const query = client
    .getQueryCache()
    .build(client, { queryKey: [SEEDED_QUERY_KEY, keySuffix] });

  query.setState({ status: 'error', fetchStatus: 'idle', error });
}

/**
 * Empties the cache so the next assertion cannot see a leftover failure.
 *
 * @param client - the test's query client.
 */
export function clearQueryErrors(client: QueryClient): void {
  client.clear();
}
