import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module.js';

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
 */
describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    // Same prefix config as production (see src/main.ts).
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    await app.init();
  });

  it('/healthz (GET) returns 200 and a JSON status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('/healthz is NOT served under the /api prefix', async () => {
    // Sanity check: the exclude list must keep /healthz at the root, not under /api.
    const response = await app.inject({
      method: 'GET',
      url: '/api/healthz',
    });

    expect(response.statusCode).toBe(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
