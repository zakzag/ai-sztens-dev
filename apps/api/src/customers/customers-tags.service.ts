/**
 * Use-case orchestration of the customer tags (AIS-178, slice e).
 *
 * Responsibilities, and nothing else:
 * - resolve the parent customer and answer `404` when it is not live;
 * - turn "attach a label by name" into **create-or-reuse** the catalogue row, so
 *   a second operator typing `vip` attaches the existing label instead of
 *   failing on `tags_name_key` (AIS-178/e `E7`);
 * - open **one** transaction per write and compose "business rows → `AuditWriter`
 *   writes" inside it, so no ledger row can land outside the write it describes;
 * - map rows to the wire contract through the pure mapper.
 *
 * Two rules are load-bearing:
 *
 * 1. **A no-op writes no ledger row.** Attaching an already attached label
 *    changes nothing, and an audit entry for it would claim a change that did not
 *    happen (the same rule the customer `PATCH` follows, plan `D7`).
 * 2. **The catalogue row is never deleted.** Detach removes the `customer_tags`
 *    link only; the label belongs to every customer that uses it (`E11`).
 */

import { Inject, Injectable } from '@nestjs/common';
import type {
  ApiErrorDetail,
  CreateCustomerTagInput,
  CustomerTag,
} from '@callback/shared';
import { AUDIT_WRITER } from '../audit/audit.const.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import {
  NotFoundAppError,
  SemanticValidationAppError,
} from '../common/http/app-error.js';
import type { TagRow } from '../db/schema.js';
import {
  CUSTOMER_TAGS_REPOSITORY,
  CUSTOMER_TAGS_TABLE_NAME,
  TAGS_TABLE_NAME,
} from './customers-tags.const.js';
import { TagNameRaceError } from './customers-tags.errors.js';
import type { TagAttachment } from './customers-tags.interface.js';
import {
  toCustomerTag,
  toLinkAuditPayload,
  toNewTagRow,
  toTagAuditPayload,
} from './customers-tags.mapper.js';
import type { CustomerTagsRepository } from './customers-tags.repository.interface.js';

/** Field-level detail of a `tagId` that names no catalogue row. */
const TAG_NOT_FOUND_DETAIL: ApiErrorDetail = {
  path: 'tagId',
  message: 'No tag with this id exists in the catalogue.',
};

/** Field-level detail of an inactive label. */
const TAG_INACTIVE_DETAIL: ApiErrorDetail = {
  path: 'tagId',
  message: 'The tag is inactive and cannot be attached.',
};

@Injectable()
export class CustomerTagsService {
  constructor(
    @Inject(CUSTOMER_TAGS_REPOSITORY)
    private readonly repository: CustomerTagsRepository,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  /**
   * Attaches a label by name, creating the catalogue row only when needed.
   *
   * @param customerId - the parent customer from the route.
   * @param input - body validated by the shared `createCustomerTagSchema`.
   * @param facts - request facts stored beside the audit rows.
   * @returns the attached label (`201` payload).
   * @throws {NotFoundAppError} when no live customer owns the id.
   */
  async create(
    customerId: string,
    input: CreateCustomerTagInput,
    facts: AuditRequestFacts,
  ): Promise<CustomerTag> {
    await this.requireParent(customerId);

    const attachment = await this.attachByName(customerId, input.name, facts);

    return toCustomerTag(attachment.tag);
  }

  /**
   * Attaches an existing label of the catalogue.
   *
   * A repeat is a success with no ledger row: the link already exists, so the
   * call had no effect to record (AIS-178/e `E8`).
   *
   * @param customerId - the parent customer from the route.
   * @param tagId - the label to attach, validated as a uuid by the route.
   * @param facts - request facts stored beside the audit rows.
   * @returns the attached label (`200` payload).
   * @throws {NotFoundAppError} when no live customer owns the id.
   * @throws {SemanticValidationAppError} `422` when the label is unknown or
   *   inactive — a body value is wrong, not a uniqueness rule.
   */
  async attach(
    customerId: string,
    tagId: string,
    facts: AuditRequestFacts,
  ): Promise<CustomerTag> {
    await this.requireParent(customerId);

    const tag = await this.requireAttachableTag(tagId);
    const attachment = await this.attachExisting(customerId, tag, facts);

    return toCustomerTag(attachment.tag);
  }

  /**
   * Removes the label from one customer.
   *
   * @param customerId - the parent customer from the route.
   * @param tagId - the label to detach, validated as a uuid by the route.
   * @param facts - request facts stored beside the audit row.
   * @returns `null` — the payload the contract prescribes for a delete.
   * @throws {NotFoundAppError} when the customer is not live or no such link
   *   exists (a repeat detach answers `404`, API-Convention §4.2.2).
   */
  async detach(
    customerId: string,
    tagId: string,
    facts: AuditRequestFacts,
  ): Promise<null> {
    await this.requireParent(customerId);

    const removed = await this.repository.runInTransaction(async (tx) => {
      const detached = await this.repository.detach(tx, customerId, tagId);

      if (!detached) {
        return false;
      }

      await this.audit.write(
        {
          customerId,
          tableName: CUSTOMER_TAGS_TABLE_NAME,
          recordId: null,
          operation: 'delete',
          before: toLinkAuditPayload(customerId, tagId),
          after: null,
        },
        tx,
        facts,
      );

      return true;
    });

    if (!removed) {
      throw new NotFoundAppError(
        `The tag "${tagId}" is not attached to customer "${customerId}".`,
      );
    }

    return null;
  }

  /**
   * Resolves a name to a catalogue row and links it, creating the row if needed.
   *
   * The lookup-then-insert is intentionally *not* a pre-check of uniqueness: the
   * insert is allowed to fail on `tags_name_key`, and that failure is then treated
   * as "someone else created the same label" — the loser re-reads the winner's row
   * in a **fresh** transaction (the violated one is aborted, so it cannot be
   * reused) and attaches it.
   *
   * @param customerId - the parent customer.
   * @param name - the validated label name.
   * @param facts - request facts stored beside the audit rows.
   * @returns the row and whether this call created the link.
   */
  private async attachByName(
    customerId: string,
    name: string,
    facts: AuditRequestFacts,
  ): Promise<TagAttachment> {
    const existing = await this.repository.findTagByName(name);

    if (existing !== null) {
      return this.attachExisting(customerId, existing, facts);
    }

    try {
      return await this.repository.runInTransaction(async (tx) => {
        const tag = await this.repository.insertTag(tx, toNewTagRow(name));

        await this.audit.write(
          {
            customerId,
            tableName: TAGS_TABLE_NAME,
            recordId: tag.id,
            operation: 'insert',
            before: null,
            after: toTagAuditPayload(tag),
          },
          tx,
          facts,
        );

        const linked = await this.writeLink(tx, customerId, tag.id, facts);

        return { tag, linked };
      });
    } catch (error) {
      if (!(error instanceof TagNameRaceError)) {
        throw error;
      }

      return this.reuseRacedTag(customerId, error, facts);
    }
  }

  /**
   * Links an already resolved catalogue row, auditing only a real change.
   *
   * @param customerId - the parent customer.
   * @param tag - the catalogue row to attach.
   * @param facts - request facts stored beside the audit row.
   * @returns the row and whether this call created the link.
   */
  private async attachExisting(
    customerId: string,
    tag: TagRow,
    facts: AuditRequestFacts,
  ): Promise<TagAttachment> {
    const linked = await this.repository.runInTransaction((tx) =>
      this.writeLink(tx, customerId, tag.id, facts),
    );

    return { tag, linked };
  }

  /**
   * Re-attempts an attach after losing the "create the same label" race.
   *
   * @param customerId - the parent customer.
   * @param race - the failure raised by the losing insert.
   * @param facts - request facts stored beside the audit row.
   * @returns the winner's row and the link outcome.
   * @throws {TagNameRaceError} when the winner's row is not readable either,
   *   which means the catalogue is inconsistent and must not be invented around.
   */
  private async reuseRacedTag(
    customerId: string,
    race: TagNameRaceError,
    facts: AuditRequestFacts,
  ): Promise<TagAttachment> {
    const winner = await this.repository.findTagByName(race.tagName);

    if (winner === null) {
      throw race;
    }

    return this.attachExisting(customerId, winner, facts);
  }

  /**
   * Creates the link and, only when it was created, its ledger row.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the customer holding the link.
   * @param tagId - the label to attach.
   * @param facts - request facts stored beside the audit row.
   * @returns `true` when this call created the link.
   */
  private async writeLink(
    tx: DatabaseTransaction,
    customerId: string,
    tagId: string,
    facts: AuditRequestFacts,
  ): Promise<boolean> {
    const linked = await this.repository.attach(tx, customerId, tagId);

    if (!linked) {
      return false;
    }

    await this.audit.write(
      {
        customerId,
        tableName: CUSTOMER_TAGS_TABLE_NAME,
        recordId: null,
        operation: 'insert',
        before: null,
        after: toLinkAuditPayload(customerId, tagId),
      },
      tx,
      facts,
    );

    return true;
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
   * @param tagId - the label the body named.
   * @returns the catalogue row, when it exists and is active.
   * @throws {SemanticValidationAppError} `422` for an unknown or inactive label.
   */
  private async requireAttachableTag(tagId: string): Promise<TagRow> {
    const tag = await this.repository.findTagById(tagId);

    if (tag === null) {
      throw new SemanticValidationAppError(
        `No tag with id "${tagId}" exists in the catalogue.`,
        [TAG_NOT_FOUND_DETAIL],
      );
    }

    if (!tag.isActive) {
      throw new SemanticValidationAppError(
        `The tag "${tag.name}" is inactive and cannot be attached.`,
        [TAG_INACTIVE_DETAIL],
      );
    }

    return tag;
  }
}
