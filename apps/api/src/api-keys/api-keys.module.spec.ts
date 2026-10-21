import { Test } from '@nestjs/testing';
import { JEST_CAN_REQUIRE_ESM } from '../../test/lib/app-module-gate.js';
import { DATABASE, DATABASE_CLIENT } from '../db/database.const.js';
import { createSqlClientMock } from '../db/test/mocks/postgres.mock.js';
import { API_KEYS_REPOSITORY } from './api-keys.const.js';
import { ApiKeysController } from './api-keys.controller.js';
import { DrizzleApiKeysRepository } from './api-keys.repository.js';
import { ApiKeysService } from './api-keys.service.js';
import { createDatabaseMock } from './test/mocks/database.mock.js';

/**
 * DI wiring regression tests.
 *
 * Why this matters: the repository is bound to the `API_KEYS_REPOSITORY` string
 * token, and `@Inject(DATABASE)` is the only thing that can satisfy it. A typo
 * in either the token or the provider list surfaces as
 * `UnknownDependenciesException` at bootstrap — the API simply would not start —
 * while every hand-constructed unit test keeps passing.
 *
 * Two layers of protection:
 *
 * 1. a test that always runs: it compiles a module from the same three provider
 *    entries the feature uses (token → `DrizzleApiKeysRepository`, service,
 *    controller) with `DATABASE` stubbed. This is the part that can fail for a
 *    real coding mistake;
 * 2. a test that compiles the **real** `ApiKeysModule`, gated on
 *    {@link JEST_CAN_REQUIRE_ESM}. `ApiKeysModule` imports `DatabaseModule`,
 *    which imports the CommonJS-only `@nestjs/config`; Jest's ESM runner can
 *    only load that on Node >= 24.9 (same limitation as `AppModule`, see
 *    `test/lib/app-module-gate.ts`). On older runtimes — including the local
 *    Node 20 — it self-skips with a warning instead of failing to load, and the
 *    full graph is exercised by the e2e suite and by `pnpm start`.
 */
async function loadApiKeysModule(): Promise<
  (typeof import('./api-keys.module.js'))['ApiKeysModule'] | null
> {
  if (!JEST_CAN_REQUIRE_ESM) {
    console.warn(
      `[api-keys.module.spec] skipped real-module compile: Jest's ESM runner ` +
        `needs Node >= 24.9 to load the CommonJS-only @nestjs/config ` +
        `(running on ${process.versions.node})`,
    );
    return null;
  }

  const { ApiKeysModule } = await import('./api-keys.module.js');
  return ApiKeysModule;
}

describe('ApiKeysModule', () => {
  it('resolves the repository through the API_KEYS_REPOSITORY token', async () => {
    const database = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        ApiKeysService,
        { provide: API_KEYS_REPOSITORY, useClass: DrizzleApiKeysRepository },
        { provide: DATABASE, useValue: database.db },
      ],
    }).compile();

    expect(moduleRef.get(ApiKeysController)).toBeInstanceOf(ApiKeysController);
    expect(moduleRef.get(ApiKeysService)).toBeInstanceOf(ApiKeysService);
    expect(moduleRef.get(API_KEYS_REPOSITORY)).toBeInstanceOf(
      DrizzleApiKeysRepository,
    );

    await moduleRef.close();
  });

  it('resolves the controller, the service and the repository from the real module', async () => {
    const ApiKeysModule = await loadApiKeysModule();
    if (ApiKeysModule === null) {
      return;
    }

    const database = createDatabaseMock();
    const client = createSqlClientMock();

    const moduleRef = await Test.createTestingModule({
      imports: [ApiKeysModule],
    })
      .overrideProvider(DATABASE)
      .useValue(database.db)
      .overrideProvider(DATABASE_CLIENT)
      .useValue(client.client)
      .compile();

    expect(moduleRef.get(ApiKeysController)).toBeInstanceOf(ApiKeysController);
    expect(moduleRef.get(ApiKeysService)).toBeInstanceOf(ApiKeysService);
    expect(moduleRef.get(API_KEYS_REPOSITORY)).toBeInstanceOf(
      DrizzleApiKeysRepository,
    );

    await moduleRef.init();
    await moduleRef.close();

    // DatabaseModule's lifecycle hook must close the pool exactly once.
    expect(client.end).toHaveBeenCalledTimes(1);
  });
});
