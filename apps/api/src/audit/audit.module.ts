/**
 * Module of the audit ledger (AIS-177).
 *
 * **No `DatabaseModule` import, deliberately.** The repository never injects
 * `DATABASE`: it receives the *transaction handle* from the caller, which is the
 * whole point of the design (see `audit.repository.interface.ts`). Importing the
 * database module here would advertise a connection this module must not have —
 * with a pooled handle in reach, "write the audit row on its own connection"
 * stops being a compile error.
 *
 * Everything is bound to a string token, so a consumer depends on the interface
 * and a spec can substitute a plain object. Only `AUDIT_WRITER` is exported: the
 * repository and the actor provider stay private, so nothing can append a row
 * without a diff, without an actor, or outside the business transaction.
 */

import { Module } from '@nestjs/common';
import {
  AUDIT_ACTOR_PROVIDER,
  AUDIT_REPOSITORY,
  AUDIT_WRITER,
} from './audit.const.js';
import { SystemAuditActorProvider } from './audit-actor.provider.js';
import { DrizzleAuditRepository } from './audit.repository.js';
import { AuditWriterService } from './audit-writer.service.js';

@Module({
  providers: [
    { provide: AUDIT_REPOSITORY, useClass: DrizzleAuditRepository },
    { provide: AUDIT_ACTOR_PROVIDER, useClass: SystemAuditActorProvider },
    { provide: AUDIT_WRITER, useClass: AuditWriterService },
  ],
  exports: [AUDIT_WRITER],
})
export class AuditModule {}
