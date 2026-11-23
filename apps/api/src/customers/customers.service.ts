/**
 * Use-case orchestration of `customers` (AIS-178).
 *
 * Responsibilities, and nothing else:
 * - call the repository through its interface;
 * - open **one** transaction per write and compose “business row write →
 *   `AuditWriter.write`” inside it, so the ledger row cannot land outside the
 *   write it describes (AIS-177 `D2`);
 * - translate the three domain failures into `AppError`s (a `409`/`404` **code**,
 *   never an HTTP status — those are derived from the shared catalogue);
 * - map rows to the wire contract through the pure mapper.
 *
 * The service imports no `@nestjs/common` HTTP exception: it must stay callable
 * from a worker or a script, where “HTTP 409” means nothing.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  API_ERROR_CODE,
  toPaginationMeta,
  type ApiErrorDetail,
  type CreateCustomerInput,
  type Customer,
  type CustomerDetail,
  type CustomerListQuery,
  type UpdateCustomerInput,
  type UpdateCustomerStatusInput,
} from '@callback/shared';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import type { AuditWriter } from '../audit/audit-writer.interface.js';
import { AUDIT_WRITER } from '../audit/audit.const.js';
import type { CustomerRow } from '../db/schema.js';
import {
  ConflictAppError,
  NotFoundAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';
import {
  CREATE_ATTEMPTS,
  CUSTOMERS_REPOSITORY,
  CUSTOMERS_TABLE_NAME,
} from './customers.const.js';
import {
  CustomerNumberConflictError,
  CustomerNumberExhaustedError,
  CustomerTaxNumberConflictError,
} from './customers.errors.js';
import type {
  CustomerPatch,
  PaginatedCustomers,
} from './customers.interface.js';
import {
  toCreatedListRow,
  toCustomer,
  toCustomerAuditPayload,
  toCustomerDetail,
  toCustomerPatch,
  toNewCustomerRow,
} from './customers.mapper.js';
import {
  toCustomerNumberPrefix,
  toNextCustomerNumber,
  toStatusPatch,
} from './customers.logic.js';
import type { CustomersRepository } from './customers.repository.interface.js';

/** Field-level detail sent with a duplicate tax number. */
const TAX_NUMBER_CONFLICT_DETAIL: ApiErrorDetail = {
  path: 'taxNumber',
  message: 'This tax number is already used by another customer.',
};

/** Field-level detail sent when the month's customer-number sequence is full. */
const CUSTOMER_NUMBER_CONFLICT_DETAIL: ApiErrorDetail = {
  path: 'customerNumber',
  message: 'No further customer number can be allocated for this month.',
};

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMERS_REPOSITORY)
    private readonly repository: CustomersRepository,
    @Inject(AUDIT_WRITER)
    private readonly audit: AuditWriter,
  ) {}

  /**
   * Lists one page of customers.
   *
   * The paging arithmetic is **not** the controller's job and not the SQL's
   * either: the repository returns the page plus the total, and
   * {@link toPaginationMeta} — a pure shared function, so the client's pager
   * computes the same numbers — turns that into `meta.pagination`.
   *
   * @param query - the validated list query (`ZodQueryPipe` output).
   * @returns the mapped rows of the page and the paging block.
   */
  async list(query: CustomerListQuery): Promise<PaginatedCustomers> {
    const page = await this.repository.findPage(query);

    return {
      items: page.rows.map(toCustomer),
      pagination: toPaginationMeta(query, page.total),
    };
  }

  /**
   * Reads one customer with its children.
   *
   * @param id - validated uuid from the path parameter.
   * @returns the detail payload.
   * @throws {NotFoundAppError} when no live row owns the id.
   */
  async findById(id: string): Promise<CustomerDetail> {
    const rows = await this.repository.findById(id);

    if (rows === null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    return toCustomerDetail(rows);
  }

  /**
   * Creates a customer, allocating its number and writing exactly one audit row.
   *
   * The retry loop is the interesting part (plan `D6`): `max()` of the month is
   * read **inside** the transaction, but two concurrent creates can still read
   * the same value — the loser then hits `customers_customer_number_key`. That
   * error aborts the Postgres transaction, so the retry has to run in a **fresh**
   * transaction, which is why the whole unit of work is inside the loop and not
   * the insert alone.
   *
   * @param input - body validated by the shared `createCustomerSchema`.
   * @param facts - request facts stored beside the audit row.
   * @param now - creation instant, injected so the caller owns the clock.
   * @returns the persisted customer (`201` payload).
   * @throws {ConflictAppError} with `CUSTOMER_NUMBER_CONFLICT` when the number
   *   cannot be allocated, or `CUSTOMER_TAX_NUMBER_CONFLICT` when a live customer
   *   already owns the tax number.
   */
  async create(
    input: CreateCustomerInput,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<Customer> {
    for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.repository.runInTransaction(async (tx) => {
          const prefix = toCustomerNumberPrefix(now);
          const currentMax = await this.repository.nextCustomerNumber(
            tx,
            prefix,
          );
          const customerNumber = toNextCustomerNumber(prefix, currentMax);
          const row = await this.repository.create(
            tx,
            toNewCustomerRow(input, customerNumber, now),
          );

          await this.audit.write(
            {
              customerId: row.id,
              tableName: CUSTOMERS_TABLE_NAME,
              recordId: row.id,
              operation: 'insert',
              before: null,
              after: toCustomerAuditPayload(row),
            },
            tx,
            facts,
          );

          return toCustomer(toCreatedListRow(row));
        });
      } catch (error) {
        if (this.isRetryableNumberFailure(error) && attempt < CREATE_ATTEMPTS) {
          continue;
        }

        // `toAppError` always throws, so the loop can never fall through here.
        this.toAppError(error);
      }
    }

    // Unreachable while `CREATE_ATTEMPTS >= 1`, but the compiler cannot know
    // that, and silently returning `undefined` would be worse than a throw: a
    // month whose sequence could not be allocated is a real `409`.
    throw new ConflictAppError(
      'A customer number could not be allocated.',
      API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
      [CUSTOMER_NUMBER_CONFLICT_DETAIL],
    );
  }

  /**
   * Applies a partial update, guarded by the client's last known version.
   *
   * Order of the steps is the contract:
   *
   * 1. **Empty patch short-circuits** (plan `D7`) — no `UPDATE`, no audit row.
   *    `updated_at` is `$onUpdate`, so an empty `UPDATE` would bump it and
   *    produce a write the audit writer would then legitimately refuse to
   *    record: a phantom change.
   * 2. **Read the pre-image** — the audit diff needs it, and its absence is the
   *    `404` case. Reading before the guarded write is safe: if another writer
   *    commits in between, the guard fails and answers `409` without an audit
   *    row.
   * 3. **One atomic guarded write** inside a transaction, together with the audit
   *    row.
   * 4. **Classify a miss** — `null` means “absent”, “deleted” or “stale”.
   *
   * @param id - the row to update (the address; never patched).
   * @param input - body validated by `updateCustomerSchema`.
   * @param facts - request facts stored beside the audit row.
   * @returns the updated customer, as stored.
   * @throws {NotFoundAppError} `404` when no live row owns the id.
   * @throws {StaleWriteAppError} `409` when the stored version differs.
   * @throws {ConflictAppError} `409` when the tax number is taken.
   */
  async update(
    id: string,
    input: UpdateCustomerInput,
    facts: AuditRequestFacts,
  ): Promise<Customer> {
    const patch = toCustomerPatch(input);
    const current = await this.repository.findAnyById(id);

    if (current === null || current.deletedAt !== null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    if (isEmptyPatch(patch)) {
      return this.toReadOnlyAnswer(id);
    }

    try {
      const updated = await this.repository.runInTransaction(async (tx) => {
        const row = await this.repository.updateById(
          tx,
          id,
          patch,
          new Date(input.updatedAt),
        );

        if (row === null) {
          return null;
        }

        await this.audit.write(
          {
            customerId: row.id,
            tableName: CUSTOMERS_TABLE_NAME,
            recordId: row.id,
            operation: 'update',
            before: toCustomerAuditPayload(current),
            after: toCustomerAuditPayload(row),
          },
          tx,
          facts,
        );

        return row;
      });

      if (updated === null) {
        return this.classifyMissedUpdate(id, input.updatedAt);
      }

      return this.toWriteAnswer(updated);
    } catch (error) {
      this.toAppError(error);
    }
  }

  /**
   * Changes the lifecycle status, writing `status_changed_at` in the same
   * statement.
   *
   * @param id - the row whose status changes.
   * @param input - body validated by `updateCustomerStatusSchema`.
   * @param facts - request facts stored beside the audit row.
   * @param now - reference instant, injected so the caller owns the clock.
   * @returns the updated customer, as stored.
   * @throws {NotFoundAppError} `404` when no live row owns the id.
   * @throws {StaleWriteAppError} `409` when the stored version differs.
   */
  async updateStatus(
    id: string,
    input: UpdateCustomerStatusInput,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<Customer> {
    const patch = toStatusPatch(input.status, now);
    const current = await this.repository.findAnyById(id);

    if (current === null || current.deletedAt !== null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    const updated = await this.repository.runInTransaction(async (tx) => {
      const row = await this.repository.updateStatusById(
        tx,
        id,
        patch,
        new Date(input.updatedAt),
      );

      if (row === null) {
        return null;
      }

      await this.audit.write(
        {
          customerId: row.id,
          tableName: CUSTOMERS_TABLE_NAME,
          recordId: row.id,
          operation: 'update',
          before: toCustomerAuditPayload(current),
          after: toCustomerAuditPayload(row),
        },
        tx,
        facts,
      );

      return row;
    });

    if (updated === null) {
      return this.classifyMissedUpdate(id, input.updatedAt);
    }

    return this.toWriteAnswer(updated);
  }

  /**
   * Archives a customer (soft delete) and records the `soft_delete` audit row.
   *
   * A second `DELETE` of the same id answers `404`, not success: the row is
   * already invisible to every read, so reporting success would claim an effect
   * the call did not have.
   *
   * @param id - the row to hide.
   * @param facts - request facts stored beside the audit row.
   * @param now - deletion timestamp, injected so the caller owns the clock.
   * @returns `null` — the payload the contract prescribes for a delete.
   * @throws {NotFoundAppError} when no live row owns the id.
   */
  async remove(
    id: string,
    facts: AuditRequestFacts,
    now: Date = new Date(),
  ): Promise<null> {
    // The pre-image is read **before** the write, so the ledger's `before` side
    // is the live row rather than the row it just updated: a `soft_delete` entry
    // has to show what was archived, not the archive marker itself.
    const current = await this.repository.findAnyById(id);

    if (current === null || current.deletedAt !== null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    const deleted = await this.repository.runInTransaction(async (tx) => {
      const row = await this.repository.softDeleteById(tx, id, now);

      if (row === null) {
        return null;
      }

      await this.audit.write(
        {
          customerId: row.id,
          tableName: CUSTOMERS_TABLE_NAME,
          recordId: row.id,
          operation: 'soft_delete',
          before: toCustomerAuditPayload(current),
          after: null,
        },
        tx,
        facts,
      );

      return row;
    });

    if (deleted === null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    return null;
  }

  /**
   * Answers a `PATCH` that carried no business field.
   *
   * The payload is the **current** row, read through the detail path so the
   * derived projections are real values and not the create-time `null`s.
   *
   * @param id - the row that was addressed.
   * @returns the unchanged customer.
   */
  private async toReadOnlyAnswer(id: string): Promise<Customer> {
    const current = await this.repository.findById(id);

    if (current === null) {
      throw new NotFoundAppError(`No customer with id "${id}" was found.`);
    }

    return toCustomer(current.customer);
  }

  /**
   * Re-reads a written row so the response carries accurate projections.
   *
   * `UPDATE … RETURNING` cannot return the derived `lastActivityAt` /
   * `primaryContactName`, and answering `null` for them after an edit would be a
   * lie about a customer that has activities. One extra read on the write path is
   * the honest trade.
   *
   * @param row - the row the guarded write returned.
   * @returns the same customer with its projections.
   */
  private async toWriteAnswer(row: CustomerRow): Promise<Customer> {
    const current = await this.repository.findById(row.id);

    return current === null
      ? toCustomer(toCreatedListRow(row))
      : toCustomer(current.customer);
  }

  /**
   * Answers a guarded write that matched no row.
   *
   * Two outcomes, and the pre-image already told them apart: a row that is gone
   * answers `404` (checked by the caller), and a *live* row with another version
   * is the lost update the token exists to catch.
   *
   * @param id - the row that matched nothing.
   * @param expectedUpdatedAt - the version the client sent.
   * @returns never — always throws.
   * @throws {StaleWriteAppError} when the row exists, is live, and has another
   *   version.
   */
  private classifyMissedUpdate(id: string, expectedUpdatedAt: string): never {
    throw new StaleWriteAppError(
      `The customer "${id}" was updated by someone else (expected updatedAt ` +
        `${expectedUpdatedAt}).`,
    );
  }

  /**
   * @param error - the caught failure.
   * @returns `true` for the two failures a fresh transaction may fix.
   */
  private isRetryableNumberFailure(
    error: unknown,
  ): error is CustomerNumberConflictError | CustomerNumberExhaustedError {
    // A full month is *not* retryable — no fresh transaction can make room —
    // so it is excluded here and mapped to `409` below.
    return error instanceof CustomerNumberConflictError;
  }

  /**
   * Translates a domain failure into the `AppError` the filter renders.
   *
   * Everything that is not one of the known domain errors is re-thrown
   * unchanged: a connection or permission problem must stay a `500`, never a
   * fabricated business conflict.
   *
   * @param error - the caught failure.
   * @returns never — always throws.
   */
  private toAppError(error: unknown): never {
    if (error instanceof CustomerTaxNumberConflictError) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
        [TAX_NUMBER_CONFLICT_DETAIL],
      );
    }

    if (
      error instanceof CustomerNumberConflictError ||
      error instanceof CustomerNumberExhaustedError
    ) {
      throw new ConflictAppError(
        error.message,
        API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
        [CUSTOMER_NUMBER_CONFLICT_DETAIL],
      );
    }

    throw error;
  }
}

/**
 * @param patch - the column subset the mapper built.
 * @returns `true` when the request carried no business field at all.
 */
function isEmptyPatch(patch: CustomerPatch): boolean {
  return Object.keys(patch).length === 0;
}
