/**
 * Use-case orchestration of the customer activity feed (AIS-178, slice f).
 *
 * Responsibilities, and nothing else:
 * - resolve the parent customer and answer `404` when it is not live;
 * - open **one** transaction per write and compose "business row → `AuditWriter`
 *   write" inside it, so no ledger row can land outside the write it describes;
 * - resolve the **author** from `AUDIT_ACTOR_PROVIDER` — never from the body
 *   (`F3`), so a client cannot write an entry in someone else's name;
 * - translate the version decision into `409 STALE_WRITE` and a missing row into
 *   `404`, and map rows to the wire contract through the pure mapper.
 *
 * The service imports no `@nestjs/common` HTTP exception: it must stay callable
 * from a worker or a script, where "HTTP 409" means nothing.
 *
 * Three rules are load-bearing:
 *
 * 1. **The concurrency token is the last write instant** (`updatedAt ?? createdAt`,
 *    `F4`). `activities.updated_at` is nullable and means "never edited", so a
 *    plain `updatedAt` compare would reject the first edit of every entry.
 * 2. **A patch that carries nothing is not a write.** With only `updatedAt` in the
 *    body the answer is `200` with the current row, and neither an `UPDATE` nor a
 *    ledger row is produced (the b-plan `D7` rule).
 * 3. **A soft delete is a `soft_delete` audit row**, and the feed plus
 *    `customers.last_activity_at` both fall back to the previous live entry (`F5`).
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  toPaginationMeta,
  type Activity,
  type ActivityListQuery,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@callback/shared';
import { AUDIT_ACTOR_PROVIDER, AUDIT_WRITER } from '../audit/audit.const.js';
import type { AuditActorProvider } from '../audit/audit-actor.interface.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import {
  NotFoundAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';
import type { ActivityRow } from '../db/schema.js';
import {
  ACTIVITIES_TABLE_NAME,
  CUSTOMER_ACTIVITIES_REPOSITORY,
} from './customers-activities.const.js';
import type { PaginatedActivities } from './customers-activities.interface.js';
import {
  hasActivityPatch,
  lastWriteOf,
  toActivity,
  toActivityAuditPayload,
  toActivityPatch,
  toNewActivityRow,
} from './customers-activities.mapper.js';
import type { CustomerActivitiesRepository } from './customers-activities.repository.interface.js';

@Injectable()
export class CustomerActivitiesService {
  constructor(
    @Inject(CUSTOMER_ACTIVITIES_REPOSITORY)
    private readonly repository: CustomerActivitiesRepository,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(AUDIT_ACTOR_PROVIDER)
    private readonly actorProvider: AuditActorProvider,
  ) {}

  /**
   * Lists one page of the live feed.
   *
   * @param customerId - the parent customer from the route.
   * @param query - the validated list query (`page`, `limit`, `order`).
   * @returns the mapped activities of the page and the paging block.
   * @throws {NotFoundAppError} when no live customer owns the id.
   */
  async list(
    customerId: string,
    query: ActivityListQuery,
  ): Promise<PaginatedActivities> {
    await this.requireParent(customerId);

    const page = await this.repository.findPage(customerId, query);

    return {
      items: page.rows.map(toActivity),
      pagination: toPaginationMeta(query, page.total),
    };
  }

  /**
   * Records one activity in the caller's name.
   *
   * @param customerId - the parent customer from the route.
   * @param input - body validated by the shared `createActivitySchema`.
   * @param facts - request facts stored beside the audit row.
   * @returns the stored entry (`201` payload).
   * @throws {NotFoundAppError} when no live customer owns the id.
   */
  async create(
    customerId: string,
    input: CreateActivityInput,
    facts: AuditRequestFacts,
  ): Promise<Activity> {
    await this.requireParent(customerId);

    const actor = this.actorProvider.resolve();

    const created = await this.repository.runInTransaction(async (tx) => {
      const row = await this.repository.create(
        tx,
        toNewActivityRow(customerId, input, actor),
      );

      await this.audit.write(
        {
          customerId,
          tableName: ACTIVITIES_TABLE_NAME,
          recordId: row.id,
          operation: 'insert',
          before: null,
          after: toActivityAuditPayload(row),
        },
        tx,
        facts,
      );

      return row;
    });

    return toActivity(created);
  }

  /**
   * Edits the body or the metadata of one activity.
   *
   * Order of the steps is the contract:
   *
   * 1. the parent and the entry must be live, otherwise `404`;
   * 2. the token is verified **before** any write, against
   *    `updatedAt ?? createdAt`, so a stale client learns it is stale;
   * 3. an empty patch short-circuits — no `UPDATE`, no ledger row;
   * 4. the write is one guarded statement; a miss is `409 STALE_WRITE`.
   *
   * @param customerId - the parent customer from the route.
   * @param activityId - the entry to update.
   * @param input - body validated by the shared `updateActivitySchema`.
   * @param facts - request facts stored beside the audit row.
   * @param now - the new `updated_at`, injected so the caller owns the clock.
   * @returns the updated entry, as stored.
   * @throws {NotFoundAppError} when the customer or the entry is not live.
   * @throws {StaleWriteAppError} when the token no longer matches the row.
   */
  async update(
    customerId: string,
    activityId: string,
    input: UpdateActivityInput,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<Activity> {
    await this.requireParent(customerId);

    const current = await this.requireLiveActivity(customerId, activityId);
    const patch = toActivityPatch(input);

    this.assertVersion(lastWriteOf(current), input.updatedAt);

    if (!hasActivityPatch(patch)) {
      return toActivity(current);
    }

    const updated = await this.repository.runInTransaction(async (tx) => {
      const row = await this.repository.updateById(
        tx,
        customerId,
        activityId,
        patch,
        lastWriteOf(current),
        now,
      );

      if (row === null) {
        throw new StaleWriteAppError(
          `The activity "${activityId}" was updated by someone else.`,
        );
      }

      await this.audit.write(
        {
          customerId,
          tableName: ACTIVITIES_TABLE_NAME,
          recordId: row.id,
          operation: 'update',
          before: toActivityAuditPayload(current),
          after: toActivityAuditPayload(row),
        },
        tx,
        facts,
      );

      return row;
    });

    return toActivity(updated);
  }

  /**
   * Hides one activity and audits it as a soft delete.
   *
   * @param customerId - the parent customer from the route.
   * @param activityId - the entry to hide.
   * @param facts - request facts stored beside the audit row.
   * @param now - deletion timestamp, injected so the caller owns the clock.
   * @returns `null` — the payload the contract prescribes for a delete.
   * @throws {NotFoundAppError} when the customer or the entry is not live.
   */
  async remove(
    customerId: string,
    activityId: string,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<null> {
    await this.requireParent(customerId);

    const current = await this.requireLiveActivity(customerId, activityId);

    const deleted = await this.repository.runInTransaction(async (tx) => {
      const row = await this.repository.softDeleteById(
        tx,
        customerId,
        activityId,
        now,
      );

      if (row === null) {
        return null;
      }

      await this.audit.write(
        {
          customerId,
          tableName: ACTIVITIES_TABLE_NAME,
          recordId: row.id,
          operation: 'soft_delete',
          before: toActivityAuditPayload(current),
          after: null,
        },
        tx,
        facts,
      );

      return row;
    });

    if (deleted === null) {
      throw new NotFoundAppError(
        `No activity with id "${activityId}" was found.`,
      );
    }

    return null;
  }

  /**
   * @param customerId - the parent customer.
   * @throws {NotFoundAppError} when no live customer owns the id.
   */
  private async requireParent(customerId: string): Promise<void> {
    if (!(await this.repository.customerExists(customerId))) {
      throw new NotFoundAppError(
        `No customer with id "${customerId}" was found.`,
      );
    }
  }

  /**
   * @param customerId - the parent customer.
   * @param activityId - the entry to read.
   * @returns the live row.
   * @throws {NotFoundAppError} when it is absent or archived.
   */
  private async requireLiveActivity(
    customerId: string,
    activityId: string,
  ): Promise<ActivityRow> {
    const current = await this.repository.findAnyById(customerId, activityId);

    if (current === null || current.deletedAt !== null) {
      throw new NotFoundAppError(
        `No activity with id "${activityId}" was found.`,
      );
    }

    return current;
  }

  /**
   * Compares the instant the client echoed with the row's last write instant.
   *
   * @param stored - the row's last write instant (`updatedAt ?? createdAt`).
   * @param expected - the token the client sent.
   * @throws {StaleWriteAppError} when the two differ.
   */
  private assertVersion(stored: Date, expected: string): void {
    if (stored.getTime() !== new Date(expected).getTime()) {
      throw new StaleWriteAppError(
        `The activity was updated by someone else (expected updatedAt ${expected}).`,
      );
    }
  }
}
