import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * E2E for the dedicated liveness endpoint.
 *
 * The test mirrors `main.ts` setup so the global prefix / exclusion rules
 * are exercised exactly as they will be in production:
 *   - `setGlobalPrefix('api', { exclude: ['healthz'] })`
 *   - no auth, no validation, no global guards on the health route
 *
 * Keeping this in sync with main.ts is intentional; the contract tested
 * here is "GET /healthz returns 200 + status:'ok'".
 *
 * `AppModule` is imported dynamically (see `test/lib/app-module-gate.ts`):
 * Jest's ESM runner cannot load the CommonJS-only `@nestjs/config` on
 * Node < 24.9, so these tests self-skip with a warning there instead of
 * failing to load.
 */

/**
 * Mirrors the return type of `HealthController.check()`.
 *
 * `FastifyInjectResponse.json()` is typed as `any`, so we narrow it through
 * `unknown` plus a type guard rather than a `as unknown as HealthBody`
 * assertion: the latter is treated by `@typescript-eslint/no-unsafe-*` as
 * still-unsafe under `recommendedTypeChecked` (and trips
 * `no-unused-vars` because the cast happens to erase the symbol from the
 * program's type graph).
 */
interface HealthBody {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

function isHealthBody(value: unknown): value is HealthBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['status'] === 'ok' &&
    typeof v['uptime'] === 'number' &&
    typeof v['timestamp'] === 'string'
  );
}

/**
 * Boots the application the way `main.ts` does, or returns `null` when the
 * runtime cannot load `AppModule` under Jest.
 */
async function bootApp(): Promise<NestFastifyApplication | null> {
  const AppModule = await loadAppModuleOrSkip();
  if (AppModule === null) return null;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  // Same prefix config as production (see src/main.ts).
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  await app.init();
  return app;
}

describe('HealthController (e2e)', () => {
  it('/healthz (GET) returns 200 and a JSON status', async () => {
    const app = await bootApp();
    if (app === null) return;
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      const body: unknown = response.json();
      // Type-guard narrows `unknown` -> `HealthBody`; `expect()` would not.
      if (!isHealthBody(body)) throw new Error('health body shape mismatch');
      expect(body.status).toBe('ok');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof body.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('/healthz is NOT served under the /api prefix', async () => {
    const app = await bootApp();
    if (app === null) return;
    try {
      // Sanity check: the exclude list must keep /healthz at the root, not under /api.
      const response = await app.inject({
        method: 'GET',
        url: '/api/healthz',
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
