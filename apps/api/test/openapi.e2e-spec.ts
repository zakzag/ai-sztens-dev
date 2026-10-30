import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createFastifyAdapter } from '../src/common/http/create-fastify-adapter.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * The OpenAPI surface over the **real** module graph (AIS-98).
 *
 * Three things can only be proven by booting the app:
 *
 * 1. `GET /api/openapi.json` really resolves under the global `api` prefix and is
 *    served raw (no envelope) — the exemption list and the controller have to
 *    agree with the routing;
 * 2. the Swagger UI plugin is mounted at `/api/docs` in a non-prod environment
 *    (it is registered from `OpenApiModule.onModuleInit`, not from `main.ts`, so
 *    the test has to exercise the module);
 * 3. `/healthz` still answers with its bare body now that the plugin pair and the
 *    response validator exist.
 *
 * Like every `AppModule` suite it self-skips on Node < 24.9 (CommonJS
 * `@nestjs/config` + Jest ESM) — see `test/lib/app-module-gate.ts`.
 */

/** The subset of the served document this suite asserts on. */
interface ServedDocument {
  readonly openapi: string;
  readonly info: { readonly title: string; readonly version: string };
  readonly paths: Record<string, unknown>;
  readonly components?: {
    readonly schemas?: Record<string, unknown>;
  };
}

describe('OpenAPI surface (e2e)', () => {
  it('serves the generated document, the dev-only UI and keeps /healthz raw', async () => {
    const AppModule = await loadAppModuleOrSkip();
    if (AppModule === null) return; // runtime limitation, warning already logged

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: NestFastifyApplication =
      moduleRef.createNestApplication<NestFastifyApplication>(
        createFastifyAdapter(),
        { rawBody: true },
      );
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    await app.init();

    try {
      const documentResponse = await app.inject({
        method: 'GET',
        url: '/api/openapi.json',
      });

      expect(documentResponse.statusCode).toBe(200);

      const document = documentResponse.json<ServedDocument>();

      expect(document.openapi).toBe('3.1.0');
      expect(document.info.title).toBe('AIsztens API');
      expect(Object.keys(document.paths)).toEqual(
        expect.arrayContaining(['/api/api-keys', '/api/api-keys/{identifier}']),
      );
      expect(Object.keys(document.components?.schemas ?? {})).toEqual(
        expect.arrayContaining(['ApiEnvelope', 'ApiErrorEnvelope']),
      );

      const docsResponse = await app.inject({
        method: 'GET',
        url: '/api/docs',
      });

      expect(docsResponse.statusCode).toBe(200);
      expect(docsResponse.headers['content-type']).toContain('text/html');

      const healthResponse = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json<Record<string, unknown>>()).toEqual(
        expect.objectContaining({ status: 'oks' }),
      );
      expect(healthResponse.json<Record<string, unknown>>()).not.toHaveProperty(
        'data',
      );
    } finally {
      await app.close();
    }
  });
});
