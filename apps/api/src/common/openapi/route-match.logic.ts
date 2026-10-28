/**
 * Route → registry-entry lookup (AIS-98, plan §8.4 job 4).
 *
 * Pure, so the interceptor stays a thin adapter and the matching rules are
 * testable without an HTTP request.
 *
 * The comparison is textual on purpose: Nest mounts a controller route with the
 * global prefix, and Fastify reports the matched **pattern** in
 * `request.routeOptions.url` (`/api/api-keys/:identifier`) — the same notation
 * the registry stores. Both come from the same declaration, so no segment
 * parsing (and no chance of a matcher bug) is involved.
 */

import { API_ENDPOINTS } from '@callback/shared';
import type { ApiEndpointContract } from '@callback/shared';

/**
 * Normalises the raw HTTP verb of a Fastify request.
 *
 * The request shape is structurally typed (`unknown` fields) so the interceptor
 * stays testable with plain objects; an unrecognised value becomes `''`, which
 * matches no registry entry and therefore asserts nothing.
 *
 * @param method - raw `request.method`.
 * @returns the upper-cased verb, or `''` when it is not a string.
 */
function normaliseMethod(method: unknown): string {
  return typeof method === 'string' ? method.toUpperCase() : '';
}

/**
 * Finds the registry entry an incoming request belongs to.
 *
 * @param method - HTTP method as the server sees it (`GET`, `POST`, …).
 * @param routePattern - matched route pattern, or `undefined` when the request
 *   never reached a Nest route (404, plugin-served asset).
 * @param endpoints - registry to search; injectable for tests.
 * @returns the matching entry, or `undefined` for an exempt/unregistered route.
 */
export function findEndpointByRoute(
  method: unknown,
  routePattern: unknown,
  endpoints: readonly ApiEndpointContract[] = API_ENDPOINTS,
): ApiEndpointContract | undefined {
  if (typeof routePattern !== 'string' || routePattern.length === 0) {
    return undefined;
  }

  const verb = normaliseMethod(method);

  return endpoints.find(
    (entry) => entry.method === verb && entry.path === routePattern,
  );
}
