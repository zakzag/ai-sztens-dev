/**
 * Use-case orchestration of the customer contacts (AIS-178, slice d).
 *
 * Responsibilities, and nothing else:
 * - resolve the parent customer and answer `404` when it is not live;
 * - open **one** transaction per write and compose "business rows → `AuditWriter`
 *   writes" inside it, so no ledger row can land outside the write it describes;
 * - translate the two domain failures into `AppError`s (a `409`/`422` **code**,
 *   never an HTTP status — those are derived from the shared catalogue);
 * - map rows to the wire contract through the pure mapper.
 *
 * The service imports no `@nestjs/common` HTTP exception: it must stay callable
 * from a worker or a script, where "HTTP 409" means nothing.
 *
 * One deliberate asymmetry, worth knowing when reading the update path: the role
 * set lives in `contact_roles`, so a **roles-only** PATCH does not bump
 * `contacts.updated_at`. The concurrency token is still verified against the row
 * that was read, so a stale client still receives `409 STALE_WRITE` — the version
 * simply does not move for a change that did not touch the contact's own columns.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  API_ERROR_CODE,
  toPaginationMeta,
  type ApiErrorDetail,
  type Contact,
  type ContactRole,
  type CreateContactInput,
  type ListQuery,
  type UpdateContactInput,
} from '@callback/shared';
import { AUDIT_WRITER } from '../audit/audit.const.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import {
  ConflictAppError,
  NotFoundAppError,
  SemanticValidationAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';
import {
  CONTACT_ROLES_TABLE_NAME,
  CONTACTS_TABLE_NAME,
  CUSTOMER_CONTACTS_REPOSITORY,
} from './customers-contacts.const.js';
import {
  ContactUserMismatchError,
  PrimaryContactConflictError,
} from './customers-contacts.errors.js';
import type { PaginatedContacts } from './customers-contacts.interface.js';
import {
  hasContactPatch,
  isSameRoleSet,
  toContact,
  toContactAuditPayload,
  toContactPatch,
  toNewContactRow,
  toRoleAuditPayload,
} from './customers-contacts.mapper.js';
import type { CustomerContactsRepository } from './customers-contacts.repository.interface.js';

/** Field-level detail of the "second primary contact" answer. */
const PRIMARY_CONTACT_CONFLICT_DETAIL: ApiErrorDetail = {
  path: 'roles',
  message: 'Another contact of this customer is already the primary contact.',
};

/** Field-level detail of a login user from another customer. */
const CONTACT_USER_MISMATCH_DETAIL: ApiErrorDetail = {
  path: 'customerUserId',
  message: 'This login user belongs to another customer.',
};

@Injectable()
export class CustomerContactsService {
  constructor(
    @Inject(CUSTOMER_CONTACTS_REPOSITORY)
    private readonly repository: CustomerContactsRepository,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  /**
   * Lists one page of contacts.
   *
   * @param customerId - the parent customer from the route.
   * @param query - the validated list query (`page`, `limit`, `order`, `q`).
   * @returns the mapped contacts of the page and the paging block.
   * @throws {NotFoundAppError} when no live customer owns the id.
   */
  async list(customerId: string, query: ListQuery): Promise<PaginatedContacts> {
    await this.requireParent(customerId);

    const page = await this.repository.findPage(customerId, query);

    return {
      items: page.rows.map(toContact),
      pagination: toPaginationMeta(query, page.total),
    };
  }

  /**
   * Adds a contact, writing its role set and one ledger row per table.
   *
   * @param customerId - the parent customer from the route.
   * @param input - body validated by the shared `createContactSchema`.
   * @param facts - request facts stored beside the audit rows.
   * @returns the persisted contact (`201` payload).
   * @throws {ConflictAppError} `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT`.
   * @throws {SemanticValidationAppError} `422` for a foreign `customerUserId`.
   */
  async create(
    customerId: string,
    input: CreateContactInput,
    facts: AuditRequestFacts,
  ): Promise<Contact> {
    await this.requireParent(customerId);

    // A mutable copy, because `ContactWithRoles.roles` is the grouping array the
    // mapper may append to; the request body itself is never mutated.
    const roles: ContactRole[] = [...(input.roles ?? [])];

    try {
      const created = await this.repository.runInTransaction(async (tx) => {
        const row = await this.repository.create(
          tx,
          toNewContactRow(customerId, input),
        );

        await this.audit.write(
          {
            customerId,
            tableName: CONTACTS_TABLE_NAME,
            recordId: row.id,
            operation: 'insert',
            before: null,
            after: toContactAuditPayload(row),
          },
          tx,
          facts,
        );

        if (roles.length === 0) {
          return row;
        }

        await this.repository.replaceRoles(tx, row.id, customerId, roles);

        await this.audit.write(
          {
            customerId,
            tableName: CONTACT_ROLES_TABLE_NAME,
            recordId: null,
            operation: 'insert',
            before: null,
            after: toRoleAuditPayload(customerId, row.id, roles),
          },
          tx,
          facts,
        );

        return row;
      });

      return toContact({ contact: created, roles });
    } catch (error) {
      this.toAppError(error);
    }
  }

  /**
   * Applies a partial update and, when given, replaces the role set.
   *
   * Order of the steps is the contract:
   *
   * 1. the parent and the contact must be live, otherwise `404`;
   * 2. an update that carries neither a column nor a changed role set
   *    short-circuits — no `UPDATE`, no ledger row (the b-plan `D7` rule);
   * 3. the role set is replaced **before** the row write, so "move the primary
   *    flag" cannot half-succeed;
   * 4. the column write is one guarded statement; a miss is `409 STALE_WRITE`.
   *
   * @param customerId - the parent customer from the route.
   * @param contactId - the contact to update.
   * @param input - body validated by the shared `updateContactSchema`.
   * @param facts - request facts stored beside the audit rows.
   * @returns the updated contact, as stored.
   * @throws {NotFoundAppError} when the customer or the contact is not live.
   * @throws {StaleWriteAppError} when the token no longer matches the row.
   * @throws {ConflictAppError} `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT`.
   * @throws {SemanticValidationAppError} `422` for a foreign `customerUserId`.
   */
  async update(
    customerId: string,
    contactId: string,
    input: UpdateContactInput,
    facts: AuditRequestFacts,
  ): Promise<Contact> {
    await this.requireParent(customerId);

    const current = await this.requireLiveContact(customerId, contactId);
    const patch = toContactPatch(input);
    const previousRoles = await this.readRoles(contactId);
    const nextRoles = input.roles;
    const rolesChanged =
      nextRoles !== undefined && !isSameRoleSet(previousRoles, nextRoles);

    this.assertVersion(current.updatedAt, input.updatedAt);

    if (!hasContactPatch(patch) && !rolesChanged) {
      return this.readOnlyAnswer(customerId, contactId);
    }

    try {
      await this.repository.runInTransaction(async (tx) => {
        if (rolesChanged && nextRoles !== undefined) {
          await this.repository.replaceRoles(
            tx,
            contactId,
            customerId,
            nextRoles,
          );
        }

        if (hasContactPatch(patch)) {
          const row = await this.repository.updateById(
            tx,
            customerId,
            contactId,
            patch,
            new Date(input.updatedAt),
          );

          if (row === null) {
            throw new StaleWriteAppError(
              `The contact "${contactId}" was updated by someone else.`,
            );
          }

          await this.audit.write(
            {
              customerId,
              tableName: CONTACTS_TABLE_NAME,
              recordId: row.id,
              operation: 'update',
              before: toContactAuditPayload(current),
              after: toContactAuditPayload(row),
            },
            tx,
            facts,
          );
        }

        if (rolesChanged && nextRoles !== undefined) {
          await this.audit.write(
            {
              customerId,
              tableName: CONTACT_ROLES_TABLE_NAME,
              recordId: null,
              operation: 'update',
              before: toRoleAuditPayload(customerId, contactId, previousRoles),
              after: toRoleAuditPayload(customerId, contactId, nextRoles),
            },
            tx,
            facts,
          );
        }
      });
    } catch (error) {
      this.toAppError(error);
    }

    return this.readOnlyAnswer(customerId, contactId);
  }

  /**
   * Archives a contact and drops its role rows.
   *
   * Two ledger rows, one per affected table (`D7`): a `delete` on
   * `contact_roles` (the set that disappeared) and a `soft_delete` on `contacts`
   * (the row that was hidden). A repeat delete finds nothing to hide → `404`.
   *
   * @param customerId - the parent customer from the route.
   * @param contactId - the contact to archive.
   * @param facts - request facts stored beside the audit rows.
   * @param now - deletion timestamp, injected so the caller owns the clock.
   * @returns `null` — the payload the contract prescribes for a delete.
   * @throws {NotFoundAppError} when the customer or the contact is not live.
   */
  async remove(
    customerId: string,
    contactId: string,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<null> {
    await this.requireParent(customerId);

    const current = await this.requireLiveContact(customerId, contactId);
    const roles = await this.readRoles(contactId);

    const deleted = await this.repository.runInTransaction(async (tx) => {
      await this.repository.deleteRoles(tx, contactId);

      if (roles.length > 0) {
        await this.audit.write(
          {
            customerId,
            tableName: CONTACT_ROLES_TABLE_NAME,
            recordId: null,
            operation: 'delete',
            before: toRoleAuditPayload(customerId, contactId, roles),
            after: null,
          },
          tx,
          facts,
        );
      }

      const row = await this.repository.softDeleteById(
        tx,
        customerId,
        contactId,
        now,
      );

      if (row === null) {
        return null;
      }

      await this.audit.write(
        {
          customerId,
          tableName: CONTACTS_TABLE_NAME,
          recordId: row.id,
          operation: 'soft_delete',
          before: toContactAuditPayload(current),
          after: null,
        },
        tx,
        facts,
      );

      return row;
    });

    if (deleted === null) {
      throw new NotFoundAppError(
        `No contact with id "${contactId}" was found.`,
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
   * @param contactId - the contact to read.
   * @returns the live contact row.
   * @throws {NotFoundAppError} when it is absent or archived.
   */
  private async requireLiveContact(customerId: string, contactId: string) {
    const current = await this.repository.findAnyById(customerId, contactId);

    if (current === null || current.deletedAt !== null) {
      throw new NotFoundAppError(
        `No contact with id "${contactId}" was found.`,
      );
    }

    return current;
  }

  /**
   * @param stored - the version the row holds.
   * @param expected - the version the client sent.
   * @throws {StaleWriteAppError} when the two differ.
   */
  private assertVersion(stored: Date, expected: string): void {
    if (stored.getTime() !== new Date(expected).getTime()) {
      throw new StaleWriteAppError(
        `The contact was updated by someone else (expected updatedAt ${expected}).`,
      );
    }
  }

  /**
   * @param contactId - the contact whose roles are read.
   * @returns the stored role set.
   */
  private async readRoles(contactId: string): Promise<readonly ContactRole[]> {
    const rows = await this.repository.findRoles(contactId);

    return rows.map((row) => row.role);
  }

  /**
   * Re-reads a contact so the response carries the stored role set.
   *
   * @param customerId - the parent customer.
   * @param contactId - the contact to read.
   * @returns the contact as stored.
   * @throws {NotFoundAppError} when it disappeared between the write and the read.
   */
  private async readOnlyAnswer(
    customerId: string,
    contactId: string,
  ): Promise<Contact> {
    const stored = await this.repository.findById(customerId, contactId);

    if (stored === null) {
      throw new NotFoundAppError(
        `No contact with id "${contactId}" was found.`,
      );
    }

    return toContact(stored);
  }

  /**
   * Translates a domain failure into the `AppError` the filter renders.
   *
   * Everything else is re-thrown unchanged: a connection or permission problem
   * must stay a `500`, never a fabricated business answer.
   *
   * @param error - the caught failure.
   * @returns never — always throws.
   */
  private toAppError(error: unknown): never {
    if (error instanceof PrimaryContactConflictError) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_PRIMARY_CONTACT_CONFLICT,
        [PRIMARY_CONTACT_CONFLICT_DETAIL],
      );
    }

    if (error instanceof ContactUserMismatchError) {
      throw new SemanticValidationAppError(error.message, [
        CONTACT_USER_MISMATCH_DETAIL,
      ]);
    }

    throw error;
  }
}
