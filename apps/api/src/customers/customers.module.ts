/**
 * Feature module of the customer aggregate (AIS-178).
 *
 * Imports `DatabaseModule` explicitly instead of relying on a global: the
 * dependency on Postgres stays visible in the module graph (see the docblock of
 * `DatabaseModule`). It also imports `AuditModule`, which is what makes
 * `AUDIT_WRITER` resolvable — a write without a ledger row must not be
 * expressible, so the dependency is declared rather than optional.
 *
 * Both collaborators are bound to string tokens, so the service depends on
 * *interfaces* and a spec can substitute plain objects.
 */

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { HttpModule } from '../common/http/http.module.js';
import { DatabaseModule } from '../db/database.module.js';
import { CUSTOMERS_REPOSITORY } from './customers.const.js';
import { CustomersController } from './customers.controller.js';
import { DrizzleCustomersRepository } from './customers.repository.js';
import { CustomersService } from './customers.service.js';
import { CUSTOMER_CONTACTS_REPOSITORY } from './customers-contacts.const.js';
import { CustomerContactsController } from './customers-contacts.controller.js';
import { DrizzleCustomerContactsRepository } from './customers-contacts.repository.js';
import { CustomerContactsService } from './customers-contacts.service.js';

@Module({
  imports: [DatabaseModule, HttpModule, AuditModule],
  controllers: [CustomersController, CustomerContactsController],
  providers: [
    CustomersService,
    CustomerContactsService,
    { provide: CUSTOMERS_REPOSITORY, useClass: DrizzleCustomersRepository },
    {
      provide: CUSTOMER_CONTACTS_REPOSITORY,
      useClass: DrizzleCustomerContactsRepository,
    },
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
