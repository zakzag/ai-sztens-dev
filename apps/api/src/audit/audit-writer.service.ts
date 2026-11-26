/**
 * The one and only place that appends to the audit ledger (AIS-177).
 *
 * Composition only — three collaborators, each with its own responsibility:
 *
 * - {@link diffAuditPayload} decides *what changed* (pure, no I/O);
 * - {@link AuditActorProvider} decides *who did it* (the auth seam);
 * - {@link AuditRepository} decides *how it is stored* (the only SQL in the
 *   module), on the caller's transaction handle.
 *
 * Everything the caller supplies is already resolved: the writer never opens a
 * transaction, never reads a request and never catches a database error. If the
 * insert fails, the business write must fail with it — that is the contract.
 */

import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_ACTOR_PROVIDER, AUDIT_REPOSITORY } from './audit.const.js';
import { diffAuditPayload } from './audit-diff.logic.js';
import { AuditPayloadIncompleteError } from './audit.errors.js';
import type { AuditActorProvider } from './audit-actor.interface.js';
import type { DatabaseTransaction } from './audit-transaction.interface.js';
import type { AuditRequestFacts, AuditWriteInput } from './audit.interface.js';
import type { AuditRepository } from './audit.repository.interface.js';
import type { AuditWriter } from './audit-writer.interface.js';

/** Appends one audit row per audited write, inside the caller's transaction. */
@Injectable()
export class AuditWriterService implements AuditWriter {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly repository: AuditRepository,
    @Inject(AUDIT_ACTOR_PROVIDER)
    private readonly actorProvider: AuditActorProvider,
  ) {}

  /** {@inheritDoc AuditWriter.write} */
  async write(
    input: AuditWriteInput,
    tx: DatabaseTransaction,
    facts: AuditRequestFacts,
  ): Promise<void> {
    assertPayloadCoherent(input);

    const diff = diffAuditPayload(input.before, input.after);

    // An update that changed nothing is not an audit fact. Writing it would
    // inflate the ledger with rows nobody can act on — and every "save" that
    // posts an unchanged form would add one.
    if (diff.hasChanges === false) {
      return;
    }

    const actor = this.actorProvider.resolve();

    await this.repository.insert(
      {
        customerId: input.customerId,
        tableName: input.tableName,
        recordId: input.recordId,
        operation: input.operation,
        beforeData: diff.before,
        afterData: diff.after,
        actorType: actor.type,
        actorId: actor.id,
        actorName: actor.name,
        ipAddress: facts.ipAddress,
        userAgent: facts.userAgent,
        requestId: facts.requestId,
        source: facts.source,
      },
      tx,
    );
  }
}

/**
 * Rejects a before/after pair that cannot describe the operation.
 *
 * Doing this in the writer (and not in each caller) means one place decides what
 * a coherent audit row is, and a new resource cannot invent its own rules.
 *
 * @param input - the payload under inspection.
 * @throws {AuditPayloadIncompleteError} when a required side is missing.
 */
function assertPayloadCoherent(input: AuditWriteInput): void {
  const hasBefore = input.before !== null;
  const hasAfter = input.after !== null;

  switch (input.operation) {
    case 'insert':
      if (hasAfter === false) {
        throw new AuditPayloadIncompleteError(input.operation, 'after is null');
      }
      return;

    case 'update':
      if (hasBefore === false || hasAfter === false) {
        throw new AuditPayloadIncompleteError(
          input.operation,
          'both before and after are required',
        );
      }
      return;

    case 'delete':
    case 'soft_delete':
      if (hasBefore === false) {
        throw new AuditPayloadIncompleteError(
          input.operation,
          'before is null',
        );
      }
      return;
  }
}
