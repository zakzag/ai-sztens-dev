/**
 * Use-case orchestration of the customer login users (AIS-178, slice e).
 *
 * Responsibilities, and nothing else:
 * - resolve the parent customer and answer `404` when it is not live;
 * - open **one** transaction per write and compose "business row → `AuditWriter`
 *   write" inside it, so no ledger row can land outside the write it describes;
 * - translate the three domain failures into `AppError`s (a `409` **code**, never
 *   an HTTP status — those are derived from the shared catalogue);
 * - map rows to the wire contract through the pure mapper.
 *
 * Three rules are load-bearing:
 *
 * 1. **An invitation is created by the server, never by the body.** `status`,
 *    `invitedAt` and the auth-owned columns are written by the mapper (`E9`,
 *    `E10`); the body carries only name, e-mail and role.
 * 2. **Only a pending invitation may be revoked.** Anything that has ever been
 *    activated keeps its row — the history of who could log in is not disposable
 *    — and deactivating it is a `PATCH status = 'inactive'` (`E4`).
 * 3. **The owner rule is the index's, never a pre-check's.** `409
 *    CUSTOMER_OWNER_CONFLICT` comes from `customer_users_customer_owner_key`
 *    (`E5`), which is why it surfaces at activation and not at invitation.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  API_ERROR_CODE,
  type ApiErrorDetail,
  type CustomerUser,
  type InviteCustomerUserInput,
  type UpdateCustomerUserInput,
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
import type { CustomerUserRow } from '../db/schema.js';
import {
  CUSTOMER_USERS_REPOSITORY,
  CUSTOMER_USERS_TABLE_NAME,
} from './customers-users.const.js';
import {
  CustomerOwnerConflictError,
  CustomerUserEmailConflictError,
  CustomerUserInUseError,
} from './customers-users.errors.js';
import {
  hasCustomerUserPatch,
  toCustomerUser,
  toCustomerUserAuditPayload,
  toCustomerUserPatch,
  toNewCustomerUserRow,
} from './customers-users.mapper.js';
import type { CustomerUsersRepository } from './customers-users.repository.interface.js';

/** Field-level detail of a duplicate login e-mail. */
const EMAIL_CONFLICT_DETAIL: ApiErrorDetail = {
  path: 'email',
  message: 'This e-mail address already holds a customer login.',
};

/** Field-level detail of a second active owner. */
const OWNER_CONFLICT_DETAIL: ApiErrorDetail = {
  path: 'role',
  message: 'Another login user of this customer is already the active owner.',
};

/** Field-level detail of a still-referenced user. */
const IN_USE_DETAIL: ApiErrorDetail = {
  path: 'id',
  message:
    'A contact or an activity still references this customer user; deactivate ' +
    'the user instead of deleting it.',
};

/** Field-level detail of revoking a user that is not a pending invitation. */
const NOT_INVITED_DETAIL: ApiErrorDetail = {
  path: 'status',
  message: 'Only a pending invitation (status "invited") can be revoked.',
};

@Injectable()
export class CustomerUsersService {
  constructor(
    @Inject(CUSTOMER_USERS_REPOSITORY)
    private readonly repository: CustomerUsersRepository,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  /**
   * Invites a login user; the row starts in the `invited` state.
   *
   * No e-mail is sent: there is no mail provider in this slice, and the row is the
   * pending invitation the auth story (AIS-73/74) will consume (`E10`).
   *
   * @param customerId - the parent customer from the route.
   * @param input - body validated by the shared `inviteCustomerUserSchema`.
   * @param facts - request facts stored beside the audit row.
   * @param now - invitation instant, injected so the caller owns the clock.
   * @returns the stored user (`201` payload).
   * @throws {NotFoundAppError} when no live customer owns the id.
   * @throws {ConflictAppError} `409 CUSTOMER_USER_EMAIL_CONFLICT`.
   */
  async invite(
    customerId: string,
    input: InviteCustomerUserInput,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<CustomerUser> {
    await this.requireParent(customerId);

    try {
      const created = await this.repository.runInTransaction(async (tx) => {
        const row = await this.repository.insert(
          tx,
          toNewCustomerUserRow(customerId, input, now),
        );

        await this.audit.write(
          {
            customerId,
            tableName: CUSTOMER_USERS_TABLE_NAME,
            recordId: row.id,
            operation: 'insert',
            before: null,
            after: toCustomerUserAuditPayload(row),
          },
          tx,
          facts,
        );

        return row;
      });

      return toCustomerUser(created);
    } catch (error) {
      this.toAppError(error);
    }
  }

  /**
   * Applies a partial update to one login user.
   *
   * @param customerId - the parent customer from the route.
   * @param customerUserId - the user to update.
   * @param input - body validated by the shared `updateCustomerUserSchema`.
   * @param facts - request facts stored beside the audit row.
   * @returns the updated user, as stored.
   * @throws {NotFoundAppError} when the customer or the user is unknown.
   * @throws {StaleWriteAppError} when the token no longer matches the row.
   * @throws {ConflictAppError} `409 CUSTOMER_OWNER_CONFLICT` when the write would
   *   create a second active owner.
   */
  async update(
    customerId: string,
    customerUserId: string,
    input: UpdateCustomerUserInput,
    facts: AuditRequestFacts,
  ): Promise<CustomerUser> {
    await this.requireParent(customerId);

    const current = await this.requireUser(customerId, customerUserId);

    this.assertVersion(current.updatedAt, input.updatedAt);

    const patch = toCustomerUserPatch(input);

    // An update that carries nothing but `updatedAt` is a no-op: no write, no
    // ledger row (the b-plan `D7` rule, unchanged for every resource).
    if (!hasCustomerUserPatch(patch)) {
      return toCustomerUser(current);
    }

    try {
      const updated = await this.repository.runInTransaction(async (tx) => {
        const row = await this.repository.updateById(
          tx,
          customerId,
          customerUserId,
          patch,
          new Date(input.updatedAt),
        );

        if (row === null) {
          throw new StaleWriteAppError(
            `The customer user "${customerUserId}" was updated by someone else.`,
          );
        }

        await this.audit.write(
          {
            customerId,
            tableName: CUSTOMER_USERS_TABLE_NAME,
            recordId: row.id,
            operation: 'update',
            before: toCustomerUserAuditPayload(current),
            after: toCustomerUserAuditPayload(row),
          },
          tx,
          facts,
        );

        return row;
      });

      return toCustomerUser(updated);
    } catch (error) {
      this.toAppError(error);
    }
  }

  /**
   * Revokes a **pending** invitation.
   *
   * @param customerId - the parent customer from the route.
   * @param customerUserId - the user to delete.
   * @param facts - request facts stored beside the audit row.
   * @returns `null` — the payload the contract prescribes for a delete.
   * @throws {NotFoundAppError} when the customer or the user is unknown.
   * @throws {SemanticValidationAppError} `422` when the row is not `invited`
   *   anymore (`E4`).
   * @throws {ConflictAppError} `409 CUSTOMER_USER_IN_USE_CONFLICT` when a contact
   *   or an activity still references the row.
   */
  async remove(
    customerId: string,
    customerUserId: string,
    facts: AuditRequestFacts,
  ): Promise<null> {
    await this.requireParent(customerId);

    const current = await this.requireUser(customerId, customerUserId);

    if (current.status !== 'invited') {
      throw new SemanticValidationAppError(
        `The customer user "${customerUserId}" is not a pending invitation ` +
          `(status "${current.status}").`,
        [NOT_INVITED_DETAIL],
      );
    }

    try {
      const removed = await this.repository.runInTransaction(async (tx) => {
        const row = await this.repository.deleteById(
          tx,
          customerId,
          customerUserId,
        );

        if (row === null) {
          return null;
        }

        await this.audit.write(
          {
            customerId,
            tableName: CUSTOMER_USERS_TABLE_NAME,
            recordId: row.id,
            operation: 'delete',
            before: toCustomerUserAuditPayload(current),
            after: null,
          },
          tx,
          facts,
        );

        return row;
      });

      if (removed === null) {
        throw new NotFoundAppError(
          `No customer user with id "${customerUserId}" was found.`,
        );
      }

      return null;
    } catch (error) {
      this.toAppError(error);
    }
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
   * @param customerUserId - the user to read.
   * @returns the stored row.
   * @throws {NotFoundAppError} when it is unknown or belongs to another customer.
   */
  private async requireUser(
    customerId: string,
    customerUserId: string,
  ): Promise<CustomerUserRow> {
    const current = await this.repository.findById(customerId, customerUserId);

    if (current === null) {
      throw new NotFoundAppError(
        `No customer user with id "${customerUserId}" was found.`,
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
        `The customer user was updated by someone else (expected updatedAt ${expected}).`,
      );
    }
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
    if (error instanceof CustomerUserEmailConflictError) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_USER_EMAIL_CONFLICT,
        [EMAIL_CONFLICT_DETAIL],
      );
    }

    if (error instanceof CustomerOwnerConflictError) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_OWNER_CONFLICT,
        [OWNER_CONFLICT_DETAIL],
      );
    }

    if (error instanceof CustomerUserInUseError) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_USER_IN_USE_CONFLICT,
        [IN_USE_DETAIL],
      );
    }

    throw error;
  }
}
