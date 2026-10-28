import {
  OPENAPI_JSON_PATH,
  OPENAPI_JSON_ROUTE,
  OPENAPI_SECURITY_SCHEME_NAME,
  OPENAPI_SECURITY_SCHEMES,
  OPENAPI_VERSION,
  SWAGGER_UI_ROUTE_PREFIX,
  isOpenApiDocsEnabled,
  isResponseAssertEnabled,
} from './openapi.config.js';

/**
 * The exposure rules are the security-relevant part of AIS-98: the Swagger UI
 * must never be mounted in prod, while the machine-readable document must stay
 * available. Both predicates are pure, so all three environments are asserted
 * without booting anything.
 */

describe('openapi config', () => {
  describe('isOpenApiDocsEnabled', () => {
    it('exposes the UI in local', () => {
      expect(isOpenApiDocsEnabled('local')).toBe(true);
    });

    it('exposes the UI in dev', () => {
      expect(isOpenApiDocsEnabled('dev')).toBe(true);
    });

    it('does not expose the UI in prod', () => {
      expect(isOpenApiDocsEnabled('prod')).toBe(false);
    });
  });

  describe('isResponseAssertEnabled', () => {
    it('validates responses in local', () => {
      expect(isResponseAssertEnabled('local')).toBe(true);
    });

    it('validates responses in dev', () => {
      expect(isResponseAssertEnabled('dev')).toBe(true);
    });

    it('never validates responses in prod', () => {
      expect(isResponseAssertEnabled('prod')).toBe(false);
    });
  });

  it('mounts the document under the shared api prefix', () => {
    expect(OPENAPI_JSON_ROUTE).toBe('openapi.json');
    expect(OPENAPI_JSON_PATH).toBe('/api/openapi.json');
  });

  it('mounts the UI under the shared api prefix', () => {
    expect(SWAGGER_UI_ROUTE_PREFIX).toBe('/api/docs');
  });

  it('targets OpenAPI 3.1', () => {
    expect(OPENAPI_VERSION).toBe('3.1.0');
  });

  it('prepares a bearer security scheme without requiring it', () => {
    expect(OPENAPI_SECURITY_SCHEME_NAME).toBe('bearerAuth');
    expect(OPENAPI_SECURITY_SCHEMES[OPENAPI_SECURITY_SCHEME_NAME]).toEqual(
      expect.objectContaining({ type: 'http', scheme: 'bearer' }),
    );
  });
});
