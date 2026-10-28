import { OPENAPI_JSON_PATH, OPENAPI_JSON_ROUTE } from './openapi.config.js';
import { OpenApiController } from './openapi.controller.js';
import { buildOpenApiDocument } from './openapi.registry.js';

/**
 * The controller is a one-line adapter; what matters is that it serves *the*
 * document (not a copy that could drift) and that its route resolves to
 * `/api/openapi.json` once the global prefix is applied.
 */

describe('OpenApiController', () => {
  it('returns the document it was given', () => {
    const document = buildOpenApiDocument();
    const controller = new OpenApiController(document);

    expect(controller.getDocument()).toBe(document);
  });

  it('declares the route segment the global prefix turns into /api/openapi.json', () => {
    expect(OPENAPI_JSON_ROUTE).toBe('openapi.json');
    expect(OPENAPI_JSON_PATH).toBe('/api/openapi.json');
  });
});
