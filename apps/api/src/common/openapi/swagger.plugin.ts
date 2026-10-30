/**
 * Registration of the Swagger UI plugin pair (AIS-98, plan §8.3 / §8.6).
 *
 * Why `@fastify/swagger` in **static** mode: the document is already generated
 * from the shared registry ({@link openApiDocument}), so nothing has to be
 * derived from decorators at runtime. Static mode hands the pre-built object to
 * `@fastify/swagger-ui`, which fetches it from its own `/json` route — the
 * machine-readable document itself is served by `OpenApiController`.
 *
 * Why no `@nestjs/swagger`: it describes shapes with `@ApiProperty` decorators on
 * DTO classes — a second, independent description of the same data (plan §8.2).
 */

import swaggerPlugin from '@fastify/swagger';
import swaggerUiPlugin from '@fastify/swagger-ui';
import { SWAGGER_UI_ROUTE_PREFIX } from './openapi.config.js';
import type { FastifyHost, OpenApiDocument } from './openapi.interface.js';

/** Options `@fastify/swagger` is registered with (derived, never restated). */
type SwaggerPluginOptions = Parameters<typeof swaggerPlugin>[1];

/** The options variant that serves a pre-built document. */
type StaticSwaggerOptions = Extract<
  NonNullable<SwaggerPluginOptions>,
  { mode: 'static' }
>;

/**
 * The document type `@fastify/swagger`'s static mode expects.
 *
 * Derived from the plugin signature so this file never has to name
 * `openapi-types` (a transitive dependency).
 */
type SwaggerDocument = NonNullable<
  Extract<
    NonNullable<StaticSwaggerOptions['specification']>,
    { document: unknown }
  >['document']
>;

/**
 * Bridges the generator's document type to the plugin's.
 *
 * The two libraries describe the same JSON with two independently maintained
 * type packages (`openapi3-ts` in the generator, `openapi-types` in
 * `@fastify/swagger`), and they disagree on details that do not exist in our
 * document — e.g. `servers[].variables[].enum` is `string[]` on one side and
 * `string[] | number[] | boolean[]` on the other. Neither type is assignable to
 * the other, so the value is passed through its **JSON form**, which is what both
 * libraries actually receive at runtime, and the result of that parse is
 * asserted to the plugin's type.
 *
 * The round trip is deliberate: it also strips `undefined` members, so the UI
 * renders exactly the bytes `/api/openapi.json` serves.
 *
 * @param document - the generated document.
 * @returns the same document in the plugin's declared type.
 */
export function toSwaggerDocument(document: OpenApiDocument): SwaggerDocument {
  return JSON.parse(JSON.stringify(document)) as SwaggerDocument;
}

/**
 * Mounts `/api/docs`.
 *
 * Called only when the environment exposes the UI
 * (`isOpenApiDocsEnabled`), which is why this function has no env branch of its
 * own — a caller that forgets the guard is caught by the module wiring test
 * instead of shipping a prod docs page.
 *
 * @param host - the Fastify instance behind Nest's adapter.
 * @param document - the generated document to render.
 */
export function registerSwaggerDocs(
  host: FastifyHost,
  document: OpenApiDocument,
): void {
  host.register(swaggerPlugin, {
    mode: 'static',
    specification: { document: toSwaggerDocument(document) },
  });

  host.register(swaggerUiPlugin, {
    routePrefix: SWAGGER_UI_ROUTE_PREFIX,
    // The UI ships its own inline scripts; the default CSP would block them.
    staticCSP: true,
  });
}
