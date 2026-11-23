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
 * and a spec can substitute a plain object.
 *
 * Exactly **two** tokens are exported:
 *
 * - `AUDIT_WRITER` — the single append path. It takes the caller's transaction
 *   handle, so a ledger row can never land outside the write it describes.
 * - `AUDIT_ACTOR_PROVIDER` — the read-only actor seam. Exported because a consumer
 *   that writes its **own** business row still has to stamp its `author_*`
 *   columns from the same actor (the activity feed, AIS-178/f `F3`); injecting it
 *   appends nothing.
 *
 * `AUDIT_REPOSITORY` stays private: with it in reach, appending a ledger row
 * would stop being the writer's exclusive job.
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
  exports: [AUDIT_WRITER, AUDIT_ACTOR_PROVIDER],
})
export class AuditModule {}
