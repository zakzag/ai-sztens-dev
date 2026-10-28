/**
 * Types of the OpenAPI layer, **derived** from the generator and from Nest's
 * Fastify adapter (AIS-98).
 *
 * Nothing here restates an OpenAPI shape by hand: if `@asteasolutions/zod-to-openapi`
 * changes its document type, these aliases follow. That keeps the generator, the
 * controller, the interceptor and the tests on one definition — the same rule the
 * shared contract applies to the wire shapes.
 */

import type {
  OpenApiGeneratorV31,
  ResponseConfig,
} from '@asteasolutions/zod-to-openapi';
import type { FastifyInstance } from 'fastify';

/** The generated OpenAPI 3.1 document object. */
export type OpenApiDocument = ReturnType<
  OpenApiGeneratorV31['generateDocument']
>;

/** One entry of an operation's `responses` map. */
export type OpenApiResponseConfig = ResponseConfig;

/**
 * The `schema` slot of a JSON response body.
 *
 * Derived instead of imported so the envelope helper never has to name
 * `openapi3-ts` (a transitive dependency) in this package.
 */
export type OpenApiResponseSchema = NonNullable<
  NonNullable<ResponseConfig['content']>[string]
>['schema'];

/** One path item of the document (`paths['/api/api-keys']`). */
export type OpenApiPathItem = NonNullable<OpenApiDocument['paths']>[string];

/** One operation of a path item. */
export type OpenApiOperation = NonNullable<OpenApiPathItem['get']>;

/** One entry of an operation's `parameters` list. */
export type OpenApiParameter = NonNullable<
  OpenApiOperation['parameters']
>[number];

/**
 * The Fastify instance behind Nest's adapter.
 *
 * `fastify` is a direct dependency of `apps/api` (same major as the one
 * `@nestjs/platform-fastify` bundles, so pnpm resolves a single instance). Using
 * the real type is what makes the plugin registration — `mode: 'static'`,
 * `specification.document` — compile-checked instead of a blind call.
 */
export type FastifyHost = FastifyInstance;

/** One documented HTTP method of a registry entry. */
export type OpenApiHttpVerb = 'get' | 'post' | 'put' | 'patch' | 'delete';
