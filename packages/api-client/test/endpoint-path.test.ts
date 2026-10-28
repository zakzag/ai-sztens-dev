import { API_ENDPOINTS, API_PATH_PREFIX } from '@callback/shared';
import {
  InvalidEndpointPathError,
  UnknownEndpointError,
  clientPathOf,
  toClientPath,
} from '../src/endpoint-path.js';

/**
 * Unit tests for `src/endpoint-path.ts` (AIS-89).
 *
 * The point of this module is that a service never writes a route by hand, so
 * the tests pin both directions of the contract: a registry path becomes a
 * transport path, and an id that is not registered fails loudly instead of
 * producing `/undefined`.
 */

describe('toClientPath', () => {
  it('strips the global api prefix', () => {
    expect(toClientPath(`${API_PATH_PREFIX}/api-keys`)).toBe('/api-keys');
  });

  it('keeps a nested resource path intact', () => {
    expect(toClientPath(`${API_PATH_PREFIX}/vapi/webhooks/tool-calls`)).toBe(
      '/vapi/webhooks/tool-calls',
    );
  });

  it('keeps the Nest path parameter so a caller can still substitute it', () => {
    expect(toClientPath(`${API_PATH_PREFIX}/api-keys/:identifier`)).toBe(
      '/api-keys/:identifier',
    );
  });

  it('rejects a path without the api prefix', () => {
    expect(() => toClientPath('/healthz')).toThrow(InvalidEndpointPathError);
  });

  it('rejects a path that merely starts with the same letters', () => {
    // `/apifoo/x` must not be mistaken for a prefixed path: slicing it would
    // silently produce `foo/x` and send the request to a route that does not exist.
    expect(() => toClientPath(`${API_PATH_PREFIX}foo/x`)).toThrow(
      InvalidEndpointPathError,
    );
  });

  it('rejects a relative path', () => {
    expect(() => toClientPath('api-keys')).toThrow(InvalidEndpointPathError);
  });

  it('rejects the bare prefix without a resource', () => {
    expect(() => toClientPath(API_PATH_PREFIX)).toThrow(
      InvalidEndpointPathError,
    );
  });

  it('reports the offending path on the error', () => {
    try {
      toClientPath('/healthz');
      throw new Error('expected toClientPath to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEndpointPathError);
      expect((error as InvalidEndpointPathError).endpointPath).toBe('/healthz');
      expect((error as InvalidEndpointPathError).name).toBe(
        'InvalidEndpointPathError',
      );
    }
  });
});

describe('clientPathOf', () => {
  it('resolves the api-keys collection', () => {
    expect(clientPathOf('apiKeys.list')).toBe('/api-keys');
  });

  it('resolves the single-resource route with its placeholder', () => {
    expect(clientPathOf('apiKeys.findByIdentifier')).toBe(
      '/api-keys/:identifier',
    );
  });

  it('throws for an unregistered operationId', () => {
    expect(() => clientPathOf('nope.none')).toThrow(UnknownEndpointError);
  });

  it('reports the offending operationId on the error', () => {
    try {
      clientPathOf('nope.none');
      throw new Error('expected clientPathOf to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownEndpointError);
      expect((error as UnknownEndpointError).operationId).toBe('nope.none');
      expect((error as UnknownEndpointError).name).toBe('UnknownEndpointError');
    }
  });

  it('converts every registered endpoint without throwing', () => {
    for (const endpoint of API_ENDPOINTS) {
      const clientPath = clientPathOf(endpoint.operationId);

      expect(clientPath.startsWith('/')).toBe(true);
      // The prefix itself must be gone, not merely present as a substring:
      // `/api-keys` is fine, `/api/api-keys` would be a doubled prefix.
      expect(clientPath.startsWith(`${API_PATH_PREFIX}/`)).toBe(false);
    }
  });
});
