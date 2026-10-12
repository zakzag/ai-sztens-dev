import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * Root-endpoint e2e against the real `AppModule` graph.
 *
 * `AppModule` is imported dynamically because Jest's ESM runner cannot load
 * the CommonJS-only `@nestjs/config` package on Node < 24.9; see
 * `test/lib/app-module-gate.ts` for the full explanation and the self-skip
 * contract.
 */
describe('AppController (e2e)', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('/ (GET) answers 200 with the greeting from AppService', async () => {
    const AppModule = await loadAppModuleOrSkip();
    if (AppModule === null) return; // runtime limitation, warning already logged

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toBe('Hello World!');
  });
});
