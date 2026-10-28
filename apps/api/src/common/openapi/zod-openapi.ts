/**
 * The bridge between the shared Zod contract and the OpenAPI document (AIS-98,
 * plan §8.1 / §8.3).
 *
 * Three rules shape this file:
 *
 * 1. **The envelope is described once.** `ApiEnvelope` is a component with an
 *    untyped `data`; every operation composes its own payload in with `allOf`
 *    plus a `$ref` to that component. No endpoint restates `data` + `meta`.
 * 2. **The error envelope is described once.** `ApiErrorEnvelope` is a single
 *    component; each documented failure status points at it.
 * 3. **Nothing here is a second description of a payload.** Payload components
 *    are *the shared schemas*, registered under a display name. If an endpoint
 *    is added with a schema that has no name, generation fails loudly instead of
 *    inventing one.
 *
 * No `z.openapi()` metadata is used (and `extendZodWithOpenApi` is not called):
 * refs, descriptions and examples are supplied by the generator loop, so the
 * shared schemas stay free of presentation concerns.
 */

import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import {
  HTTP_STATUS,
  apiErrorDetailSchema,
  apiErrorEnvelopeSchema,
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
  paginationMetaSchema,
  responseMetaSchema,
  resolveApiErrorStatus,
} from '@callback/shared';
import type { ApiErrorCode } from '@callback/shared';
import { UnregisteredPayloadSchemaError } from './openapi.errors.js';
import type {
  OpenApiParameter,
  OpenApiResponseConfig,
  OpenApiResponseSchema,
} from './openapi.interface.js';
import { z } from 'zod';

/**
 * Adds `.openapi()` to every zod schema.
 *
 * `OpenAPIRegistry#register()` marks the schema with `.openapi({ ref })` when it
 * stores it as a component, so the extension has to be installed before the first
 * registration. It is a prototype patch of the *same* zod instance the shared
 * contract is built from, which is why it is called exactly once, here, and not
 * in every consumer.
 */
extendZodWithOpenApi(z);

/** Component name of the success envelope. */
export const API_ENVELOPE_COMPONENT = 'ApiEnvelope';

/** Component name of the error envelope. */
export const API_ERROR_ENVELOPE_COMPONENT = 'ApiErrorEnvelope';

/**
 * Envelope component used by the generator.
 *
 * Written as an explicit schema object instead of a zod skeleton for two
 * reasons: `data` has no shape of its own (each operation narrows it with
 * `allOf`), and `z.any()` is reported as *optional* by the generator — the
 * envelope would then look as if `data` may be missing, which the runtime
 * contract forbids.
 *
 * The runtime envelope (`successEnvelopeSchema`) is not reused because it ends
 * in a `transform`, which carries no schema information for the generator.
 */
const envelopeComponentSchema = {
  type: 'object' as const,
  required: ['data', 'meta'],
  properties: {
    data: {},
    meta: { $ref: schemaRef('ResponseMeta') },
  },
};

/**
 * Display name of every payload schema that can appear in the document.
 *
 * This is a naming table, **not** a second contract: each entry is the very
 * schema the server validates and the client parses with.
 */
const PAYLOAD_COMPONENTS: ReadonlyMap<z.ZodTypeAny, string> = new Map<
  z.ZodTypeAny,
  string
>([
  [apiKeySchema, 'ApiKey'],
  [apiKeyListSchema, 'ApiKeyList'],
  [createApiKeySchema, 'CreateApiKey'],
]);

/**
 * Every failure status the contract can produce.
 *
 * Registered once and inherited by every operation, so a new endpoint does not
 * have to remember which failures exist (plan §8.3, decision 2).
 */
export const CANONICAL_ERROR_STATUSES: readonly number[] = [
  HTTP_STATUS.BAD_REQUEST,
  HTTP_STATUS.UNAUTHORIZED,
  HTTP_STATUS.FORBIDDEN,
  HTTP_STATUS.NOT_FOUND,
  HTTP_STATUS.CONFLICT,
  HTTP_STATUS.PAYLOAD_TOO_LARGE,
  HTTP_STATUS.UNPROCESSABLE_ENTITY,
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
];

/** Fixed `meta` of the published examples (no clock, so the spec is stable). */
export const EXAMPLE_META = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
} as const;

/**
 * @param name - component name.
 * @returns the `$ref` string of a schema component.
 */
export function schemaRef(name: string): string {
  return `#/components/schemas/${name}`;
}

/**
 * Registers the envelope, meta and error components exactly once.
 *
 * @param registry - registry the document is generated from.
 */
export function registerEnvelopeComponents(registry: OpenAPIRegistry): void {
  registry.register('ResponseMeta', responseMetaSchema);
  registry.register('PaginationMeta', paginationMetaSchema);
  registry.register('ApiErrorDetail', apiErrorDetailSchema);
  registry.registerComponent(
    'schemas',
    API_ENVELOPE_COMPONENT,
    envelopeComponentSchema,
  );
  registry.register(API_ERROR_ENVELOPE_COMPONENT, apiErrorEnvelopeSchema);
}

/**
 * Registers every named payload schema as a component.
 *
 * @param registry - registry the document is generated from.
 */
export function registerPayloadComponents(registry: OpenAPIRegistry): void {
  for (const [schema, name] of PAYLOAD_COMPONENTS) {
    registry.register(name, schema);
  }
}

/**
 * Looks up the component name of a payload schema by identity.
 *
 * @param schema - the registry entry's `dataSchema`.
 * @param operationId - registry entry, only used for the error message.
 * @returns the component name registered for that schema.
 * @throws UnregisteredPayloadSchemaError when the schema has no name yet.
 */
export function payloadComponentName(
  schema: z.ZodTypeAny,
  operationId: string,
): string {
  const name = PAYLOAD_COMPONENTS.get(schema);

  if (name === undefined) {
    throw new UnregisteredPayloadSchemaError(operationId);
  }

  return name;
}

/**
 * Builds the `allOf` response schema of one enveloped operation.
 *
 * The shared envelope contributes `data` (untyped) + `meta`; the second branch
 * narrows `data` to this endpoint's payload. `data` is required in both
 * branches, so a body without it is invalid.
 *
 * @param dataSchema - payload schema of the endpoint (must be a named component).
 * @param operationId - registry entry, for the error message.
 * @returns the schema of the whole response body.
 */
export function envelopeOf(
  dataSchema: z.ZodTypeAny,
  operationId: string,
): OpenApiResponseSchema {
  return {
    allOf: [
      { $ref: schemaRef(API_ENVELOPE_COMPONENT) },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            $ref: schemaRef(payloadComponentName(dataSchema, operationId)),
          },
        },
      },
    ],
  };
}

/**
 * Builds the documented failures of one operation.
 *
 * The canonical statuses are always present (a new endpoint inherits them); the
 * entry's own `errors` add nothing new today but are resolved through the shared
 * catalogue, so a domain code that maps to a status outside the canonical list
 * would still be documented.
 *
 * @param errors - codes the endpoint can answer with.
 * @returns `responses` entries keyed by status code.
 */
export function openApiErrorResponses(
  errors: readonly ApiErrorCode[],
): Record<string, OpenApiResponseConfig> {
  const statuses = new Set<number>(CANONICAL_ERROR_STATUSES);

  for (const code of errors) {
    statuses.add(resolveApiErrorStatus(code));
  }

  const responses: Record<string, OpenApiResponseConfig> = {};

  for (const status of statuses) {
    responses[String(status)] = {
      description: `Error envelope with HTTP ${status} (see ${API_ERROR_ENVELOPE_COMPONENT}).`,
      content: {
        'application/json': {
          schema: { $ref: schemaRef(API_ERROR_ENVELOPE_COMPONENT) },
        },
      },
    };
  }

  return responses;
}

/**
 * Converts a Nest route pattern into an OpenAPI path template.
 *
 * `/api/api-keys/:identifier` → `/api/api-keys/{identifier}`.
 *
 * @param path - registry path in Nest notation.
 * @returns the same path in OpenAPI notation.
 */
export function toOpenApiPath(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? `{${segment.slice(1)}}` : segment,
    )
    .join('/');
}

/**
 * Declares the path parameters a route pattern contains.
 *
 * @param path - registry path in Nest notation.
 * @returns one required string parameter per `:placeholder`.
 */
export function pathParameters(path: string): OpenApiParameter[] {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => ({
      in: 'path' as const,
      name: segment.slice(1),
      required: true,
      schema: { type: 'string' as const },
    }));
}
