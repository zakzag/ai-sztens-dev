import {
  API_ENDPOINTS,
  API_ERROR_CODE,
  API_KEYS_ENDPOINTS,
  API_KEYS_PATH,
  API_PATH_PREFIX,
  ENVELOPE_EXEMPTIONS,
  VALID_API_KEY,
  VALID_API_KEY_LIST,
  VALID_UPDATE_API_KEY_REQUEST,
  apiKeySchema,
  findEndpoint,
  successEnvelopeSchema,
  type ApiEndpointContract,
} from '../src/index.js';

/**
 * The registry is the seed of the generated OpenAPI document and of the future
 * route-coverage gate, so its invariants are asserted here once instead of being
 * rediscovered by every consumer.
 *
 * Two families of assertions live here:
 *
 * 1. **Runtime** invariants — every entry is complete, namespaced and points at
 *    a schema that actually parses a realistic payload.
 * 2. **Compile-time** invariants — the registry is a typed literal, so a
 *    misspelled verb or a missing field is a build error. The
 *    `@ts-expect-error` test below is the proof: ts-jest reports TS2578
 *    (“unused directive”) the moment the type stops rejecting it.
 */

/** `operationId` is `<namespace>.<action>`, both camelCase. */
const OPERATION_ID_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/**
 * A payload that every `api-keys` response schema must accept.
 *
 * Imported from the contract's own fixture (AIS-98): the same value is published
 * as the OpenAPI `example`, so the documented sample and the parsed sample can
 * never be two different objects.
 */
const VALID_KEY = VALID_API_KEY;

/**
 * One realistic payload per registered endpoint.
 *
 * Deliberately exhaustive by lookup rather than by index: an endpoint added
 * without a sample fails the “parses its own payload” test, which is cheaper
 * than discovering a broken `dataSchema` in the generated spec.
 */
const SAMPLE_PAYLOADS: Readonly<Record<string, unknown>> = {
  'apiKeys.list': VALID_API_KEY_LIST,
  'apiKeys.findByIdentifier': VALID_KEY,
  'apiKeys.create': VALID_KEY,
  'apiKeys.update': VALID_KEY,
  // A `DELETE` returns nothing, so its payload is `null` — a value, not an
  // absent field (see `no-payload.schema.ts`).
  'apiKeys.remove': null,
};

/** Minimal envelope `meta`; the registry only cares about the payload. */
const ENVELOPE_META = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
} as const;

/**
 * Extracts the namespace part of an `operationId` (`apiKeys.list` → `apiKeys`).
 *
 * @param operationId - a registry operation id.
 * @returns the part before the dot.
 */
function namespaceOf(operationId: string): string {
  return operationId.split('.')[0] ?? '';
}

/**
 * Converts a tag back to the camelCase namespace notation (`api-keys` → `apiKeys`).
 *
 * @param tag - the OpenAPI tag of a registry entry.
 * @returns the same name in camelCase.
 */
function camelCaseOf(tag: string): string {
  return tag.replace(/-([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

describe('endpoint registry', () => {
  it('registers the five api-keys endpoints', () => {
    expect(API_KEYS_ENDPOINTS.map((entry) => entry.operationId)).toEqual([
      'apiKeys.list',
      'apiKeys.findByIdentifier',
      'apiKeys.create',
      'apiKeys.update',
      'apiKeys.remove',
    ]);
  });

  it('documents the update endpoint as a PATCH on the single-resource path', () => {
    const update = findEndpoint('apiKeys.update');

    expect(update?.method).toBe('PATCH');
    expect(update?.path).toBe(`${API_KEYS_PATH}/:identifier`);
    expect(update?.successStatus).toBe(200);
    expect(update?.requestSchema).toBeDefined();
    expect(update?.envelope).toBe(true);
  });

  it('documents the delete endpoint as a DELETE on the single-resource path', () => {
    const remove = findEndpoint('apiKeys.remove');

    expect(remove?.method).toBe('DELETE');
    expect(remove?.path).toBe(`${API_KEYS_PATH}/:identifier`);
    expect(remove?.successStatus).toBe(200);
    expect(remove?.requestSchema).toBeUndefined();
    expect(remove?.envelope).toBe(true);
  });

  it('lists the mutation failure codes of the update endpoint', () => {
    const errors = findEndpoint('apiKeys.update')?.errors ?? [];

    expect(errors).toContain(API_ERROR_CODE.STALE_WRITE);
    expect(errors).toContain(API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED);
    expect(errors).toContain(API_ERROR_CODE.VALIDATION_FAILED);
    expect(errors).toContain(API_ERROR_CODE.NOT_FOUND);
  });

  it('parses the update fixture with the update request schema', () => {
    const schema = findEndpoint('apiKeys.update')?.requestSchema;

    expect(schema?.safeParse(VALID_UPDATE_API_KEY_REQUEST).success).toBe(true);
  });

  it('rejects an update body without the concurrency token', () => {
    const schema = findEndpoint('apiKeys.update')?.requestSchema;

    expect(schema?.safeParse({ name: 'Vapi production' }).success).toBe(false);
  });

  it('describes the delete payload as null', () => {
    const schema = findEndpoint('apiKeys.remove')?.dataSchema;

    expect(schema?.safeParse(null).success).toBe(true);
    expect(schema?.safeParse({}).success).toBe(false);
  });

  it('keeps operationIds unique across the whole registry', () => {
    const ids = API_ENDPOINTS.map((entry) => entry.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses a namespaced <resource>.<action> operationId', () => {
    for (const entry of API_ENDPOINTS) {
      expect(entry.operationId).toMatch(OPERATION_ID_PATTERN);
    }
  });

  it('tags every endpoint with the namespace of its operationId', () => {
    for (const entry of API_ENDPOINTS) {
      expect(entry.tag.length).toBeGreaterThan(0);
      expect(camelCaseOf(entry.tag)).toBe(namespaceOf(entry.operationId));
    }
  });

  it('mounts every path under the shared api prefix', () => {
    for (const entry of API_ENDPOINTS) {
      expect(entry.path.startsWith(`${API_PATH_PREFIX}/`)).toBe(true);
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

  it('lists only unique codes from the API_ERROR_CODE catalogue', () => {
    const catalogue = new Set<string>(Object.values(API_ERROR_CODE));

    for (const entry of API_ENDPOINTS) {
      expect(entry.errors.length).toBeGreaterThan(0);
      expect(new Set(entry.errors).size).toBe(entry.errors.length);
      for (const code of entry.errors) {
        expect(catalogue.has(code)).toBe(true);
      }
    }
  });

  it('parses a realistic payload with the schema of every endpoint', () => {
    for (const entry of API_ENDPOINTS) {
      const payload = SAMPLE_PAYLOADS[entry.operationId];
      expect(payload).toBeDefined();

      const envelope = successEnvelopeSchema(entry.dataSchema).safeParse({
        data: payload,
        meta: ENVELOPE_META,
      });

      expect(envelope.success).toBe(true);
    }
  });

  it('keeps exempt routes out of the enveloped registry', () => {
    const exemptPaths = new Set(ENVELOPE_EXEMPTIONS.map((entry) => entry.path));

    for (const entry of API_ENDPOINTS) {
      expect(entry.envelope).toBe(true);
      expect(exemptPaths.has(entry.path)).toBe(false);
    }
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

  it('rejects a misspelled method at compile time', () => {
    const base: ApiEndpointContract = {
      operationId: 'broken.typoMethod',
      method: 'GET',
      path: `${API_PATH_PREFIX}/broken`,
      summary: 'An entry whose verb the type has to reject',
      tag: 'broken',
      successStatus: 200,
      dataSchema: apiKeySchema,
      errors: [],
      envelope: true,
    };

    const broken: ApiEndpointContract = {
      ...base,
      // @ts-expect-error - `FETCH` is not an `ApiHttpMethod`; the registry is type-checked, not runtime-validated
      method: 'FETCH',
    };

    expect(broken.method).toBe('FETCH');
  });
});
