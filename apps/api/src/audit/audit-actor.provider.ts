/**
 * The actor provider used until the admin API has authentication (AIS-177).
 *
 * It is a class and not an inline object so the auth story can swap it in one
 * place (`{ provide: AUDIT_ACTOR_PROVIDER, useClass: SessionAuditActorProvider }`)
 * without touching `AuditWriter`, the schema or a single call site.
 *
 * Why not store `NULL`: `actor_type` and `actor_name` are `NOT NULL` on
 * purpose. An unattributable write still has a truth — "the system did it" —
 * and a column that may be empty invites nobody to fill it later.
 */

import { Injectable } from '@nestjs/common';
import { AUDIT_SYSTEM_ACTOR_NAME } from './audit.const.js';
import type { AuditActorProvider } from './audit-actor.interface.js';
import type { AuditActor } from './audit.interface.js';

/** Records every change as performed by the system itself. */
@Injectable()
export class SystemAuditActorProvider implements AuditActorProvider {
  /**
   * @returns the frozen system actor: `type = system`, no id, name `system`.
   */
  resolve(): AuditActor {
    return {
      type: 'system',
      id: null,
      name: AUDIT_SYSTEM_ACTOR_NAME,
    };
  }
}
