import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  API_ERROR_CODE,
  HTTP_STATUS,
  apiKeySchema,
  createApiKeySchema,
} from '@callback/shared';
import { UnregisteredPayloadSchemaError } from './openapi.errors.js';
import {
  API_ENVELOPE_COMPONENT,
  API_ERROR_ENVELOPE_COMPONENT,
  CANONICAL_ERROR_STATUSES,
  envelopeOf,
  openApiErrorResponses,
  pathParameters,
  registerEnvelopeComponents,
  registerPayloadComponents,
  toOpenApiPath,
} from './zod-openapi.js';

/**
 * The bridge to the document is where the "one envelope, one error shape"
 * promise is either kept or quietly broken, so the assertions here are exact
 * (`toEqual`) rather than partial: a payload that starts restating `meta` fails.
 */

/** Registry with every component of the contract registered. */
function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  registerEnvelopeComponents(registry);
  registerPayloadComponents(registry);

  return registry;
}

describe('toOpenApiPath', () => {
  it('converts Nest parameters into OpenAPI templates', () => {
    expect(toOpenApiPath('/api/api-keys/:identifier')).toBe(
      '/api/api-keys/{identifier}',
    );
  });

  it('leaves a parameterless path unchanged', () => {
    expect(toOpenApiPath('/api/api-keys')).toBe('/api/api-keys');
  });
});

describe('pathParameters', () => {
  it('declares one required string parameter per placeholder', () => {
    expect(pathParameters('/api/api-keys/:identifier')).toEqual([
      {
        in: 'path',
        name: 'identifier',
        required: true,
        schema: { type: 'string' },
      },
    ]);
  });

  it('declares nothing for a parameterless path', () => {
    expect(pathParameters('/api/api-keys')).toEqual([]);
  });
});

describe('envelopeOf', () => {
  it('composes the shared envelope with the payload, never restating it', () => {
    expect(envelopeOf(apiKeySchema, 'apiKeys.findByIdentifier')).toEqual({
      allOf: [
        { $ref: `#/components/schemas/${API_ENVELOPE_COMPONENT}` },
        {
          type: 'object',
          required: ['data'],
          properties: {
            data: { $ref: '#/components/schemas/ApiKey' },
          },
        },
      ],
    });
  });

  it('throws when a payload schema has no component name', () => {
    expect(() => envelopeOf(z.string(), 'unknown.endpoint')).toThrow(
      UnregisteredPayloadSchemaError,
    );
  });
});

describe('openApiErrorResponses', () => {
  it('documents every canonical failure status', () => {
    const responses = openApiErrorResponses([]);

    expect(
      Object.keys(responses)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...CANONICAL_ERROR_STATUSES].sort((a, b) => a - b));
  });

  it('points every failure at the single error envelope component', () => {
    const responses = openApiErrorResponses([]);

    for (const status of CANONICAL_ERROR_STATUSES) {
      const response = responses[String(status)];

      expect(response?.content).toEqual({
        'application/json': {
          schema: {
            $ref: `#/components/schemas/${API_ERROR_ENVELOPE_COMPONENT}`,
          },
        },
      });
      expect(response?.description).toContain(`HTTP ${status}`);
    }
  });

  it('adds the status of a domain-specific code', () => {
    const responses = openApiErrorResponses([
      API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
    ]);

    expect(responses[String(HTTP_STATUS.CONFLICT)]).toBeDefined();
  });
});

describe('component registration', () => {
  const components = new OpenApiGeneratorV31(
    buildRegistry().definitions,
  ).generateComponents();

  it('registers the envelope, meta and error components once', () => {
    expect(Object.keys(components.components?.schemas ?? {}).sort()).toEqual([
      'ApiEnvelope',
      'ApiErrorDetail',
      'ApiErrorEnvelope',
      'ApiKey',
      'ApiKeyList',
      'CreateApiKey',
      'PaginationMeta',
      'ResponseMeta',
    ]);
  });

  it('keeps data and meta required in the envelope component', () => {
    expect(components.components?.schemas?.[API_ENVELOPE_COMPONENT]).toEqual({
      type: 'object',
      required: ['data', 'meta'],
      properties: {
        data: {},
        meta: { $ref: '#/components/schemas/ResponseMeta' },
      },
    });
  });

  it('names the request schema of the create endpoint', () => {
    const createApiKey = JSON.stringify(
      components.components?.schemas?.CreateApiKey,
    );

    expect(createApiKey).toContain('"identifier"');
    expect(createApiKey).toContain('"additionalProperties":false');
    expect(createApiKeySchema).toBeDefined();
  });
});
