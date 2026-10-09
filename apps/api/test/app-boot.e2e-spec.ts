import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * Boots the *real* `AppModule` graph.
 *
 * This is the test that would have caught the `VapiSignatureGuard` DI failure:
 * the first version of the guard injected `ConfigService` through a type-only
 * import, so `emitDecoratorMetadata` wrote `design:paramtypes = [Function]`,
 * Nest could not resolve the provider and **the whole API refused to boot**
 * with `UnknownDependenciesException` — while every unit test still passed,
 * because they built the guard by hand.
 *
 * `src/vapi-webhooks/vapi-webhooks.module.spec.ts` covers the same failure
 * without the environment caveat; this spec additionally proves that the
 * module is wired into `AppModule` and that the webhook routes are mounted.
 *
 * The `AppModule` import is dynamic, and the test self-skips with a warning
 * when Jest cannot load the CommonJS-only `@nestjs/config` (Node < 24.9) —
 * see `test/lib/app-module-gate.ts`.
 */
describe('AppModule bootstrap (e2e)', () => {
  it('builds the full application graph and mounts the VAPI webhook routes', async () => {
    const AppModule = await loadAppModuleOrSkip();
    if (AppModule === null) return; // runtime limitation, warning already logged

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: NestFastifyApplication =
      moduleRef.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
        { rawBody: true },
      );
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    await app.init();

    // An unsigned request must reach the guard (not 404): proof that the
    // module is registered and the route exists.
    const response = await app.inject({
      method: 'POST',
      url: '/api/vapi/webhooks/end-of-call-report',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(response.statusCode).not.toBe(404);
    expect([401, 500]).toContain(response.statusCode);

    await app.close();
  });
});
