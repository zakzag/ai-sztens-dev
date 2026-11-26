/**
 * The single seam for "who performed this write" (AIS-177, `AIS-14` `D-A`).
 *
 * The admin API has no authentication yet, so today every row says
 * `system`. When the auth story (AIS-73/74) lands, it implements this interface
 * once and nothing else changes: the writer already asks the provider, the
 * column already stores the answer.
 */

import type { AuditActor } from './audit.interface.js';

/** Resolves the actor of the current write. */
export interface AuditActorProvider {
  /**
   * @returns the actor to record. Never `null`: an unattributable write still
   *   has *a* truth ("system did it"), and a `NOT NULL` column keeps the log
   *   sorted.
   */
  resolve(): AuditActor;
}
