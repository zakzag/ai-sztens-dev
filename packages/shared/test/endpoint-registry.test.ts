import {
  API_ENDPOINTS,
  API_KEYS_ENDPOINTS,
  API_KEYS_PATH,
  ENVELOPE_EXEMPTIONS,
  findEndpoint,
} from '../src/index.js';

/**
 * The registry is the seed of the generated OpenAPI document and of the future
 * route-coverage gate, so its invariants are asserted here once instead of being
 * rediscovered by every consumer.
 */
describe('endpoint registry', () => {
  it('registers the three api-keys endpoints', () => {
    expect(API_KEYS_ENDPOINTS.map((entry) => entry.operationId)).toEqual([
      'apiKeys.list',
      'apiKeys.findByIdentifier',
      'apiKeys.create',
    ]);
  });

  it('keeps operationIds unique across the whole registry', () => {
    const ids = API_ENDPOINTS.map((entry) => entry.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mounts every path under the global api prefix', () => {
    for (const entry of API_ENDPOINTS) {
      expect(entry.path.startsWith('/api/')).toBe(true);
    }
  });

  it('documents the create endpoint with a request schema and a 201', () => {
    const create = findEndpoint('apiKeys.create');

    expect(create?.method).toBe('POST');
    expect(create?.successStatus).toBe(201);
    expect(create?.requestSchema).toBeDefined();
    expect(create?.envelope).toBe(true);
  });

  it('documents the list endpoint on the collection path', () => {
    expect(findEndpoint('apiKeys.list')?.path).toBe(API_KEYS_PATH);
  });

  it('returns undefined for an unknown operationId', () => {
    expect(findEndpoint('nope.none')).toBeUndefined();
  });

  it('gives every envelope exemption a written reason', () => {
    expect(ENVELOPE_EXEMPTIONS.length).toBeGreaterThan(0);
    for (const exemption of ENVELOPE_EXEMPTIONS) {
      expect(exemption.path.length).toBeGreaterThan(0);
      expect(exemption.reason.length).toBeGreaterThan(10);
    }
  });

  it('never registers an exempt route twice', () => {
    const paths = ENVELOPE_EXEMPTIONS.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
