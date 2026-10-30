import { API_ENDPOINTS, ENVELOPE_EXEMPTIONS } from '@callback/shared';
import { ApiKeysController } from '../../api-keys/api-keys.controller.js';
import { AppController } from '../../app.controller.js';
import { HealthController } from '../../health/health.controller.js';
import { VapiWebhooksController } from '../../vapi-webhooks/vapi-webhooks.controller.js';
import { OpenApiController } from '../openapi/openapi.controller.js';
import {
  findUnregisteredRoutes,
  sortUnique,
  toRouteTable,
} from './test/support/envelope-route.js';

/**
 * `@SkipEnvelope()` ⇄ `ENVELOPE_EXEMPTIONS` agreement (AIS-92, plan `D9`).
 *
 * The decorator is what `ApiExceptionFilter` reads at runtime; the registry is
 * what the OpenAPI generator, the client authors and reviewers read. A route
 * that is decorated but not listed (or listed but not decorated) is a silent
 * contract break: either a consumer that expects a bare body suddenly gets an
 * envelope, or a documented exemption does not exist.
 *
 * This spec runs on every Node version because it inspects the controllers
 * directly instead of booting `AppModule`. The inventory below is therefore
 * explicit — `apps/api/test/envelope-exemptions.e2e-spec.ts` discovers the
 * controllers from the real module graph and catches a controller that is
 * missing here (on the Node versions where that suite can boot).
 */

/** Every route controller of the API, kept complete by the e2e twin. */
const ROUTE_CONTROLLERS = [
  AppController,
  HealthController,
  ApiKeysController,
  VapiWebhooksController,
  OpenApiController,
];

/** The registry's exempt paths, normalised the same way the routes are. */
const REGISTERED_EXEMPTIONS = sortUnique(
  ENVELOPE_EXEMPTIONS.map((entry) => entry.path),
);

/**
 * Enveloped routes deliberately absent from the versioned registry.
 *
 * Only the root probe: every registry path must live under `/api/`, and `GET /`
 * is a greeting used to prove the envelope is wired, not a client resource.
 */
const UNDOCUMENTED_ENVELOPED_ROUTES: readonly string[] = ['/api'];

describe('envelope exemption coverage', () => {
  const routes = toRouteTable(ROUTE_CONTROLLERS);

  it('decorates exactly the routes listed in ENVELOPE_EXEMPTIONS', () => {
    expect(routes.exempt).toEqual(REGISTERED_EXEMPTIONS);
  });

  it('keeps the health probe raw', () => {
    expect(routes.exempt).toContain('/healthz');
  });

  it('keeps the generated OpenAPI document raw', () => {
    expect(routes.exempt).toContain('/api/openapi.json');
  });

  it('keeps both VAPI webhooks raw', () => {
    expect(routes.exempt).toContain('/api/vapi/webhooks/tool-calls');
    expect(routes.exempt).toContain('/api/vapi/webhooks/end-of-call-report');
  });

  it('classifies the enveloped routes of the api-keys surface', () => {
    expect(routes.enveloped).toEqual(
      expect.arrayContaining([
        '/api/api-keys',
        '/api/api-keys/:identifier',
        '/api',
      ]),
    );
  });

  it('registers every enveloped route or excuses it with a written reason', () => {
    expect(
      findUnregisteredRoutes(
        routes,
        API_ENDPOINTS.map((entry) => entry.path),
        UNDOCUMENTED_ENVELOPED_ROUTES,
      ),
    ).toEqual([]);
  });
});
