import { API_KEYS_ENDPOINTS } from '@callback/shared';
import { findEndpointByRoute } from './route-match.logic.js';

/**
 * The interceptor only validates the route it can identify, so a false positive
 * (validating an exempt route) and a false negative (silently skipping a
 * registered one) are both real defects. The matcher is textual, which makes all
 * of them cheap to pin down here.
 */

describe('findEndpointByRoute', () => {
  it('matches a registered collection route', () => {
    expect(findEndpointByRoute('GET', '/api/api-keys')?.operationId).toBe(
      'apiKeys.list',
    );
  });

  it('matches the Nest pattern of a parameterised route', () => {
    expect(
      findEndpointByRoute('GET', '/api/api-keys/:identifier')?.operationId,
    ).toBe('apiKeys.findByIdentifier');
  });

  it('ignores the verb case of the incoming request', () => {
    expect(findEndpointByRoute('post', '/api/api-keys')?.operationId).toBe(
      'apiKeys.create',
    );
  });

  it('does not match a different verb on the same path', () => {
    expect(findEndpointByRoute('DELETE', '/api/api-keys')).toBeUndefined();
  });

  it('does not match an exempt route', () => {
    expect(findEndpointByRoute('GET', '/healthz')).toBeUndefined();
  });

  it('returns undefined when the request never reached a route', () => {
    expect(findEndpointByRoute('GET', undefined)).toBeUndefined();
  });

  it('returns undefined for an empty route pattern', () => {
    expect(findEndpointByRoute('GET', '')).toBeUndefined();
  });

  it('ignores a non-string verb instead of throwing', () => {
    expect(findEndpointByRoute(undefined, '/api/api-keys')).toBeUndefined();
    expect(findEndpointByRoute(42, '/api/api-keys')).toBeUndefined();
  });

  it('searches the endpoints it is given', () => {
    expect(findEndpointByRoute('GET', '/api/api-keys', [])).toBeUndefined();
    expect(
      findEndpointByRoute('GET', '/api/api-keys', API_KEYS_ENDPOINTS),
    ).toBeDefined();
  });
});
