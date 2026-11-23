import { Test } from '@nestjs/testing';
import { AuditModule } from '../audit/audit.module.js';
import { AUDIT_WRITER } from '../audit/audit.const.js';
import { AuditWriterService } from '../audit/audit-writer.service.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { DATABASE, DATABASE_CLIENT } from '../db/database.const.js';
import { createSqlClientMock } from '../db/test/mocks/postgres.mock.js';
import { JEST_CAN_REQUIRE_ESM } from '../../test/lib/app-module-gate.js';
import { CUSTOMERS_REPOSITORY } from './customers.const.js';
import { CustomersController } from './customers.controller.js';
import { DrizzleCustomersRepository } from './customers.repository.js';
import { CustomersService } from './customers.service.js';
import { createCustomersDatabaseMock } from './test/mocks/database.mock.js';
import { createAuditWriterMock } from './test/mocks/customers.mock.js';

/**
 * DI wiring regression tests (AIS-178).
 *
 * Why this matters: the repository is bound to the `CUSTOMERS_REPOSITORY` string
 * token and the service depends on `AUDIT_WRITER` through another one. A typo in
 * either token, or a forgotten `AuditModule` import, surfaces as
 * `UnknownDependenciesException` at bootstrap — the API simply would not start —
 * while every hand-constructed unit test keeps passing.
 *
 * Two layers of protection:
 *
 * 1. a test that always runs: it compiles a module from the same provider
 *    entries the feature uses (token → `DrizzleCustomersRepository`, service,
 *    controller, writer) with `DATABASE` stubbed. This is the part that can fail
 *    for a real coding mistake;
 * 2. a test that compiles the **real** `CustomersModule`, gated on
 *    {@link JEST_CAN_REQUIRE_ESM}. The module imports `DatabaseModule`, which
 *    imports the CommonJS-only `@nestjs/config`; Jest's ESM runner can only load
 *    that on Node >= 24.9 (same limitation as `AppModule`, see
 *    `test/lib/app-module-gate.ts`). On older runtimes it self-skips with a
 *    warning instead of failing to load, and the full graph is exercised by the
 *    e2e suite and by `pnpm start`.
 */

async function loadCustomersModule(): Promise<
  (typeof import('./customers.module.js'))['CustomersModule'] | null
> {
  if (!JEST_CAN_REQUIRE_ESM) {
    console.warn(
      `[customers.module.spec] skipped real-module compile: Jest's ESM runner ` +
        `needs Node >= 24.9 to load the CommonJS-only @nestjs/config ` +
        `(running on ${process.versions.node})`,
    );
    return null;
  }

  const { CustomersModule } = await import('./customers.module.js');
  return CustomersModule;
}

describe('CustomersModule', () => {
  it('resolves the repository and the audit writer through their tokens', async () => {
    const database = createCustomersDatabaseMock();
    const audit = createAuditWriterMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        CustomersService,
        // The controller wraps its payload, so it needs the envelope service —
        // provided by the global `HttpModule` in the real graph.
        ApiResponseService,
        { provide: CUSTOMERS_REPOSITORY, useClass: DrizzleCustomersRepository },
        { provide: AUDIT_WRITER, useValue: audit.writer },
        { provide: DATABASE, useValue: database.db },
      ],
    }).compile();

    expect(moduleRef.get(CustomersController)).toBeInstanceOf(
      CustomersController,
    );
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(moduleRef.get(CUSTOMERS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomersRepository,
    );
    expect(moduleRef.get(AUDIT_WRITER)).toBe(audit.writer);

    await moduleRef.close();
  });

  it('binds AUDIT_WRITER through the real AuditModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();

    // The writer is the module's only export: nothing can append a ledger row
    // without a diff, without an actor, or outside the business transaction.
    expect(moduleRef.get(AUDIT_WRITER)).toBeInstanceOf(AuditWriterService);

    await moduleRef.close();
  });

  it('resolves the whole feature from the real module', async () => {
    const CustomersModule = await loadCustomersModule();
    if (CustomersModule === null) {
      return;
    }

    const database = createCustomersDatabaseMock();
    const client = createSqlClientMock();

    const moduleRef = await Test.createTestingModule({
      imports: [CustomersModule],
    })
      .overrideProvider(DATABASE)
      .useValue(database.db)
      .overrideProvider(DATABASE_CLIENT)
      .useValue(client.client)
      .compile();

    expect(moduleRef.get(CustomersController)).toBeInstanceOf(
      CustomersController,
    );
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(moduleRef.get(CUSTOMERS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomersRepository,
    );
    expect(moduleRef.get(AUDIT_WRITER)).toBeInstanceOf(AuditWriterService);

    await moduleRef.init();
    await moduleRef.close();

    // DatabaseModule's lifecycle hook must close the pool exactly once.
    expect(client.end).toHaveBeenCalledTimes(1);
  });
});
