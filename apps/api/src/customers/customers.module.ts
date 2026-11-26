/**
 * Feature module of the customer aggregate (AIS-178).
 *
 * Imports `DatabaseModule` explicitly instead of relying on a global: the
 * dependency on Postgres stays visible in the module graph (see the docblock of
 * `DatabaseModule`). It also imports `AuditModule`, which is what makes
 * `AUDIT_WRITER` **and** `AUDIT_ACTOR_PROVIDER` resolvable — a write without a
 * ledger row must not be expressible, so the dependency is declared rather than
 * optional, and the activity feed stamps its author from that same actor seam
 * (slice f `F3`).
 *
 * Six sub-resources live here, one controller and one repository token each:
 * the customer itself (slice b), its contacts (d), its tags and its login users
 * (e), and its activity feed plus the read-only audit log (f). Every repository
 * is bound to a string token, so a service depends on an *interface* and a spec
 * can substitute a plain object.
 */

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { HttpModule } from '../common/http/http.module.js';
import { DatabaseModule } from '../db/database.module.js';
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
import { CUSTOMER_CONTACTS_REPOSITORY } from './customers-contacts.const.js';
import { CustomerContactsController } from './customers-contacts.controller.js';
import { DrizzleCustomerContactsRepository } from './customers-contacts.repository.js';
import { CustomerContactsService } from './customers-contacts.service.js';
import { CUSTOMER_TAGS_REPOSITORY } from './customers-tags.const.js';
import { CustomerTagsController } from './customers-tags.controller.js';
import { DrizzleCustomerTagsRepository } from './customers-tags.repository.js';
import { CustomerTagsService } from './customers-tags.service.js';
import { CUSTOMER_USERS_REPOSITORY } from './customers-users.const.js';
import { CustomerUsersController } from './customers-users.controller.js';
import { DrizzleCustomerUsersRepository } from './customers-users.repository.js';
import { CustomerUsersService } from './customers-users.service.js';

@Module({
  imports: [DatabaseModule, HttpModule, AuditModule],
  controllers: [
    CustomersController,
    CustomerContactsController,
    CustomerTagsController,
    CustomerUsersController,
    CustomerActivitiesController,
    CustomerAuditLogsController,
  ],
  providers: [
    CustomersService,
    CustomerContactsService,
    CustomerTagsService,
    CustomerUsersService,
    CustomerActivitiesService,
    CustomerAuditLogsService,
    { provide: CUSTOMERS_REPOSITORY, useClass: DrizzleCustomersRepository },
    {
      provide: CUSTOMER_CONTACTS_REPOSITORY,
      useClass: DrizzleCustomerContactsRepository,
    },
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
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
