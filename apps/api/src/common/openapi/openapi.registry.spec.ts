import { API_ENDPOINTS, HTTP_STATUS } from '@callback/shared';
import { API_KEYS_ENDPOINTS } from '@callback/shared';
import {
  OPENAPI_SECURITY_SCHEME_NAME,
  OPENAPI_TITLE,
  OPENAPI_VERSION,
} from './openapi.config.js';
import type { OpenApiDocument, OpenApiOperation } from './openapi.interface.js';
import { buildOpenApiDocument, openApiDocument } from './openapi.registry.js';
import {
  API_ENVELOPE_COMPONENT,
  API_ERROR_ENVELOPE_COMPONENT,
  CANONICAL_ERROR_STATUSES,
} from './zod-openapi.js';

/**
 * The document is generated, so the only way it can be wrong is by drifting away
 * from the registry. Every assertion below therefore compares the document
 * **against the registry itself** instead of against a hand-written expectation:
 * a new endpoint without documentation, a renamed operation or a re-inlined
 * envelope fails here without anyone updating a fixture.
 */

/** HTTP verbs an operation can be documented under. */
const VERBS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * @param document - generated document.
 * @returns every operation of every path.
 */
function operationsOf(document: OpenApiDocument): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];

  for (const path of Object.keys(document.paths)) {
    const item = document.paths[path];

    for (const verb of VERBS) {
      const operation = item?.[verb];

      if (operation !== undefined) {
        operations.push(operation);
      }
    }
  }

  return operations;
}

describe('buildOpenApiDocument', () => {
  const document = buildOpenApiDocument();

  it('emits an OpenAPI 3.1 document', () => {
    expect(document.openapi).toBe(OPENAPI_VERSION);
    expect(OPENAPI_VERSION).toBe('3.1.0');
  });

  it('carries the configured info block', () => {
    expect(document.info.title).toBe(OPENAPI_TITLE);
    expect(document.info.version).toBe('0.0.1');
  });

  it('documents the origin it was served from', () => {
    expect(document.servers).toEqual([
      { url: '/', description: 'The origin this document was served from' },
    ]);
  });

  it('documents one operation per registry entry', () => {
    expect(operationsOf(document)).toHaveLength(API_ENDPOINTS.length);
  });

  it('converts Nest parameters into OpenAPI templates', () => {
    const paths = Object.keys(document.paths);

    expect(paths).toContain('/api/api-keys');
    expect(paths).toContain('/api/api-keys/{identifier}');
    expect(paths.some((path) => path.includes(':'))).toBe(false);
  });

  it('keeps the registry operationIds and tags', () => {
    const operations = operationsOf(document);

    for (const entry of API_KEYS_ENDPOINTS) {
      const operation = operations.find(
        (candidate) => candidate.operationId === entry.operationId,
      );

      expect(operation).toBeDefined();
      expect(operation?.tags).toEqual([entry.tag]);
      expect(operation?.summary).toBe(entry.summary);
    }
  });

  it('documents the success status of every operation', () => {
    const operations = operationsOf(document);

    for (const entry of API_KEYS_ENDPOINTS) {
      const operation = operations.find(
        (candidate) => candidate.operationId === entry.operationId,
      );

      expect(operation?.responses?.[String(entry.successStatus)]).toBeDefined();
    }
  });

  it('references the shared envelope instead of restating it', () => {
    const list = document.paths['/api/api-keys']?.get;
    const serialised = JSON.stringify(
      list?.responses?.[String(HTTP_STATUS.OK)],
    );

    expect(serialised).toContain(
      `#/components/schemas/${API_ENVELOPE_COMPONENT}`,
    );
    expect(serialised).toContain('#/components/schemas/ApiKeyList');
  });

  it('references the shared error envelope for every documented failure', () => {
    const list = document.paths['/api/api-keys']?.get;
    // `ResponsesObject` is indexed with `any`; widening it once keeps the loop
    // body type-safe instead of leaking `any` into every assertion.
    const responses: Record<string, unknown> = list?.responses ?? {};

    for (const status of CANONICAL_ERROR_STATUSES) {
      const response = responses[String(status)];

      expect(response).toBeDefined();
      expect(JSON.stringify(response)).toContain(
        `#/components/schemas/${API_ERROR_ENVELOPE_COMPONENT}`,
      );
    }
  });

  it('publishes the registry example on the success response', () => {
    expect(JSON.stringify(document)).toContain('vapi-prod');
  });

  it('documents the request body of the create endpoint', () => {
    const create = document.paths['/api/api-keys']?.post;

    expect(create?.requestBody).toBeDefined();
    expect(JSON.stringify(create?.requestBody)).toContain(
      '#/components/schemas/CreateApiKey',
    );
  });

  it('declares the path parameter of the single-resource route', () => {
    const operation = document.paths['/api/api-keys/{identifier}']?.get;

    expect(JSON.stringify(operation?.parameters)).toContain(
      '"name":"identifier"',
    );
    expect(JSON.stringify(operation?.parameters)).toContain('"in":"path"');
  });

  it('registers the envelope and error components', () => {
    const schemas = document.components?.schemas ?? {};

    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining([
        API_ENVELOPE_COMPONENT,
        API_ERROR_ENVELOPE_COMPONENT,
        'ApiErrorDetail',
        'ResponseMeta',
      ]),
    );
  });

  it('prepares the bearer security scheme', () => {
    expect(
      document.components?.securitySchemes?.[OPENAPI_SECURITY_SCHEME_NAME],
    ).toEqual(expect.objectContaining({ type: 'http', scheme: 'bearer' }));
  });

  it('is deterministic', () => {
    expect(buildOpenApiDocument()).toEqual(buildOpenApiDocument());
  });

  it('memoises the served document', () => {
    expect(openApiDocument()).toBe(openApiDocument());
  });
});
