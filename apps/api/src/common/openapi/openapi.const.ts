/**
 * DI token of the generated document (AIS-98).
 *
 * A string token keeps the controller and the module independent of *how* the
 * document is produced: today a pure factory over the shared registry, later a
 * cached or file-backed one, without touching the consumer.
 */

/** Injection token of the generated {@link OpenApiDocument}. */
export const OPENAPI_DOCUMENT = 'OPENAPI_DOCUMENT';
