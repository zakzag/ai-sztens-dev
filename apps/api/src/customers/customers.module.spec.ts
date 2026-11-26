import { Test } from '@nestjs/testing';
import { AuditModule } from '../audit/audit.module.js';
import { AUDIT_ACTOR_PROVIDER, AUDIT_WRITER } from '../audit/audit.const.js';
import { AuditWriterService } from '../audit/audit-writer.service.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { DATABASE, DATABASE_CLIENT } from '../db/database.const.js';
import { createSqlClientMock } from '../db/test/mocks/postgres.mock.js';
import { JEST_CAN_REQUIRE_ESM } from '../../test/lib/app-module-gate.js';
import { CUSTOMERS_REPOSITORY } from './customers.const.js';
import { CustomersController } from './customers.controller.js';
import { DrizzleCustomersRepository } from './customers.repository.js';
import { CustomersService } from './customers.service.js';
import { CUSTOMER_ACTIVITIES_REPOSITORY } from './customers-activities.const.js';
import { CustomerActivitiesController } from './customers-activities.controller.js';
import { DrizzleCustomerActivitiesRepository } from './customers-activities.repository.js';
import { CustomerActivitiesService } from './customers-activities.service.js';
import { CUSTOMER_AUDIT_LOGS_REPOSITORY } from './customers-audit-logs.const.js';
import { CustomerAuditLogsController } from './customers-audit-logs.controller.js';
import { DrizzleCustomerAuditLogsRepository } from './customers-audit-logs.repository.js';
import { CustomerAuditLogsService } from './customers-audit-logs.service.js';
import { CUSTOMER_TAGS_REPOSITORY } from './customers-tags.const.js';
import { CustomerTagsController } from './customers-tags.controller.js';
import { DrizzleCustomerTagsRepository } from './customers-tags.repository.js';
import { CustomerTagsService } from './customers-tags.service.js';
import { CUSTOMER_USERS_REPOSITORY } from './customers-users.const.js';
import { CustomerUsersController } from './customers-users.controller.js';
import { DrizzleCustomerUsersRepository } from './customers-users.repository.js';
import { CustomerUsersService } from './customers-users.service.js';
import { createCustomersDatabaseMock } from './test/mocks/database.mock.js';
import { createAuditWriterMock } from './test/mocks/customers.mock.js';
import { createAuditActorProviderMock } from './test/mocks/customers-activities.mock.js';

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
  it('resolves every repository, controller and the audit writer through their tokens', async () => {
    const database = createCustomersDatabaseMock();
    const audit = createAuditWriterMock();
    const actors = createAuditActorProviderMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [
        CustomersController,
        CustomerTagsController,
        CustomerUsersController,
        CustomerActivitiesController,
        CustomerAuditLogsController,
      ],
      providers: [
        CustomersService,
        CustomerTagsService,
        CustomerUsersService,
        CustomerActivitiesService,
        CustomerAuditLogsService,
        // The controllers wrap their payload, so they need the envelope service —
        // provided by the global `HttpModule` in the real graph.
        ApiResponseService,
        { provide: CUSTOMERS_REPOSITORY, useClass: DrizzleCustomersRepository },
        {
          provide: CUSTOMER_TAGS_REPOSITORY,
          useClass: DrizzleCustomerTagsRepository,
        },
        {
          provide: CUSTOMER_USERS_REPOSITORY,
          useClass: DrizzleCustomerUsersRepository,
        },
        {
          provide: CUSTOMER_ACTIVITIES_REPOSITORY,
          useClass: DrizzleCustomerActivitiesRepository,
        },
        {
          provide: CUSTOMER_AUDIT_LOGS_REPOSITORY,
          useClass: DrizzleCustomerAuditLogsRepository,
        },
        { provide: AUDIT_WRITER, useValue: audit.writer },
        // The activity feed resolves its author from the same seam the ledger
        // uses; the real graph binds it through `AuditModule`.
        { provide: AUDIT_ACTOR_PROVIDER, useValue: actors.provider },
        { provide: DATABASE, useValue: database.db },
      ],
    }).compile();

    expect(moduleRef.get(CustomersController)).toBeInstanceOf(
      CustomersController,
    );
    expect(moduleRef.get(CustomerTagsController)).toBeInstanceOf(
      CustomerTagsController,
    );
    expect(moduleRef.get(CustomerUsersController)).toBeInstanceOf(
      CustomerUsersController,
    );
    expect(moduleRef.get(CustomerActivitiesController)).toBeInstanceOf(
      CustomerActivitiesController,
    );
    expect(moduleRef.get(CustomerAuditLogsController)).toBeInstanceOf(
      CustomerAuditLogsController,
    );
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(moduleRef.get(CustomerTagsService)).toBeInstanceOf(
      CustomerTagsService,
    );
    expect(moduleRef.get(CustomerUsersService)).toBeInstanceOf(
      CustomerUsersService,
    );
    expect(moduleRef.get(CustomerActivitiesService)).toBeInstanceOf(
      CustomerActivitiesService,
    );
    expect(moduleRef.get(CustomerAuditLogsService)).toBeInstanceOf(
      CustomerAuditLogsService,
    );
    expect(moduleRef.get(CUSTOMERS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomersRepository,
    );
    expect(moduleRef.get(CUSTOMER_TAGS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerTagsRepository,
    );
    expect(moduleRef.get(CUSTOMER_USERS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerUsersRepository,
    );
    expect(moduleRef.get(CUSTOMER_ACTIVITIES_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerActivitiesRepository,
    );
    expect(moduleRef.get(CUSTOMER_AUDIT_LOGS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerAuditLogsRepository,
    );
    expect(moduleRef.get(AUDIT_WRITER)).toBe(audit.writer);

    await moduleRef.close();
  });

  it('binds AUDIT_WRITER and AUDIT_ACTOR_PROVIDER through the real AuditModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();

    // Two exports, and both are required here: the writer appends the ledger row,
    // and the activity feed stamps its `author_*` columns from the same actor.
    // The repository stays private, so appending remains the writer's own job.
    expect(moduleRef.get(AUDIT_WRITER)).toBeInstanceOf(AuditWriterService);
    expect(moduleRef.get(AUDIT_ACTOR_PROVIDER)).toBeDefined();

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
    expect(moduleRef.get(CustomerActivitiesController)).toBeInstanceOf(
      CustomerActivitiesController,
    );
    expect(moduleRef.get(CustomerAuditLogsController)).toBeInstanceOf(
      CustomerAuditLogsController,
    );
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(moduleRef.get(CUSTOMER_ACTIVITIES_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerActivitiesRepository,
    );
    expect(moduleRef.get(CUSTOMER_AUDIT_LOGS_REPOSITORY)).toBeInstanceOf(
      DrizzleCustomerAuditLogsRepository,
    );
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
