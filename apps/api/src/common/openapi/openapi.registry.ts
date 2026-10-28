/**
 * Generation of the OpenAPI 3.1 document from the shared endpoint registry
 * (AIS-98, plan §8.1 / §8.4 job 5).
 *
 * Pure and deterministic: no Nest, no clock, no `process.env`, no I/O. Two calls
 * with the same registry produce a deep-equal object, which is what makes the
 * future committed baseline (`AIS-99`) and the response validator trustworthy —
 * both read exactly the structure this file builds.
 *
 * The direction is one-way (plan §8.1): registry → document → consumers. The
 * document is never edited by hand and never becomes the place where an endpoint
 * is designed.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { API_ENDPOINTS } from '@callback/shared';
import type { ApiEndpointContract } from '@callback/shared';
import {
  OPENAPI_DESCRIPTION,
  OPENAPI_INFO_VERSION,
  OPENAPI_SECURITY_SCHEME_NAME,
  OPENAPI_SECURITY_SCHEMES,
  OPENAPI_SERVERS,
  OPENAPI_TAGS,
  OPENAPI_TITLE,
  OPENAPI_VERSION,
} from './openapi.config.js';
import type {
  OpenApiDocument,
  OpenApiHttpVerb,
  OpenApiResponseConfig,
} from './openapi.interface.js';
import {
  EXAMPLE_META,
  envelopeOf,
  openApiErrorResponses,
  pathParameters,
  payloadComponentName,
  registerEnvelopeComponents,
  registerPayloadComponents,
  schemaRef,
  toOpenApiPath,
} from './zod-openapi.js';

/** Registry verb → OpenAPI verb, so a new HTTP method cannot be misspelled. */
const VERB_BY_METHOD: Readonly<
  Record<ApiEndpointContract['method'], OpenApiHttpVerb>
> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
};

/**
 * Builds the response body example of one endpoint.
 *
 * The published example is the **whole body**, not just the payload, so a reader
 * of the Swagger UI sees the envelope too. `meta` is a fixed sample: a generated
 * timestamp would make the document change on every generation.
 *
 * @param entry - registry entry.
 * @returns the example body, or `undefined` when the entry has no sample.
 */
function exampleOf(entry: ApiEndpointContract): unknown {
  if (entry.example === undefined) {
    return undefined;
  }

  return entry.envelope
    ? { data: entry.example, meta: EXAMPLE_META }
    : entry.example;
}

/**
 * Documents one registry entry.
 *
 * @param registry - registry being filled.
 * @param entry - endpoint contract from `@callback/shared`.
 */
function registerEntry(
  registry: OpenAPIRegistry,
  entry: ApiEndpointContract,
): void {
  const success: OpenApiResponseConfig = {
    description: `Success: ${entry.summary}`,
    content: {
      'application/json': {
        schema: envelopeOf(entry.dataSchema, entry.operationId),
        example: exampleOf(entry),
      },
    },
  };

  registry.registerPath({
    method: VERB_BY_METHOD[entry.method],
    path: toOpenApiPath(entry.path),
    summary: entry.summary,
    operationId: entry.operationId,
    tags: [entry.tag],
    parameters: pathParameters(entry.path),
    request:
      entry.requestSchema === undefined
        ? undefined
        : {
            body: {
              required: true,
              content: {
                'application/json': {
                  // Referenced, not inlined: the request schema is the same
                  // component the server validates with, so the spec cannot
                  // drift from the contract.
                  schema: {
                    $ref: schemaRef(
                      payloadComponentName(
                        entry.requestSchema,
                        entry.operationId,
                      ),
                    ),
                  },
                },
              },
            },
          },
    responses: {
      [String(entry.successStatus)]: success,
      ...openApiErrorResponses(entry.errors),
    },
  });
}

/**
 * Builds the document.
 *
 * @returns a fresh OpenAPI 3.1 document; never cached here (see {@link openApiDocument}).
 */
export function buildOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  registerEnvelopeComponents(registry);
  registerPayloadComponents(registry);
  registry.registerComponent(
    'securitySchemes',
    OPENAPI_SECURITY_SCHEME_NAME,
    OPENAPI_SECURITY_SCHEMES[OPENAPI_SECURITY_SCHEME_NAME],
  );

  for (const entry of API_ENDPOINTS) {
    registerEntry(registry, entry);
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: OPENAPI_VERSION,
    info: {
      title: OPENAPI_TITLE,
      version: OPENAPI_INFO_VERSION,
      description: OPENAPI_DESCRIPTION,
    },
    servers: [...OPENAPI_SERVERS],
    tags: [...OPENAPI_TAGS],
  });
}

/** Memoised document; the registry is static, so one build per process is enough. */
let cachedDocument: OpenApiDocument | undefined;

/**
 * @returns the process-wide document instance served by `/api/openapi.json`.
 */
export function openApiDocument(): OpenApiDocument {
  cachedDocument ??= buildOpenApiDocument();

  return cachedDocument;
}
