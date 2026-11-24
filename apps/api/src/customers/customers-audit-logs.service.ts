/**
 * Use-case orchestration of the customer audit-log read (AIS-178, slice f).
 *
 * Three responsibilities, and no fourth one can appear here:
 * - resolve the parent customer and answer `404` when it is not live;
 * - reject a semantically impossible time window (`from > to`) with `422`
 *   instead of a silently empty page (`F8`);
 * - map rows to the wire contract and build the paging block.
 *
 * There is no transaction, no `AuditWriter` and no actor on purpose: **reading a
 * ledger is not an audited event**, and the repository behind this service has no
 * write method to call (`F10`).
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  toPaginationMeta,
  type ApiErrorDetail,
  type AuditLogListQuery,
} from '@callback/shared';
import {
  NotFoundAppError,
  SemanticValidationAppError,
} from '../common/http/app-error.js';
import { CUSTOMER_AUDIT_LOGS_REPOSITORY } from './customers-audit-logs.const.js';
import type { PaginatedAuditLogs } from './customers-audit-logs.interface.js';
import { toAuditLog } from './customers-audit-logs.mapper.js';
import type { CustomerAuditLogsRepository } from './customers-audit-logs.repository.interface.js';

/** Field-level detail of an inverted `from`/`to` window. */
const FROM_AFTER_TO_DETAIL: ApiErrorDetail = {
  path: 'from',
  message: 'The "from" bound must not be later than the "to" bound.',
};

@Injectable()
export class CustomerAuditLogsService {
  constructor(
    @Inject(CUSTOMER_AUDIT_LOGS_REPOSITORY)
    private readonly repository: CustomerAuditLogsRepository,
  ) {}

  /**
   * Lists one page of the ledger.
   *
   * @param customerId - the parent customer from the route.
   * @param query - the validated list query (`page`, `limit`, `order` + filters).
   * @returns the mapped ledger rows of the page and the paging block.
   * @throws {NotFoundAppError} when no live customer owns the id.
   * @throws {SemanticValidationAppError} `422` when `from` is later than `to`.
   */
  async list(
    customerId: string,
    query: AuditLogListQuery,
  ): Promise<PaginatedAuditLogs> {
    await this.requireParent(customerId);
    assertRange(query);

    const page = await this.repository.findPage(customerId, query);

    return {
      items: page.rows.map(toAuditLog),
      pagination: toPaginationMeta(query, page.total),
    };
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
}

/**
 * Rejects a time window whose bounds are the wrong way round.
 *
 * The shape is valid — both bounds are ISO 8601 instants — so this is the `422`
 * case of the AIS-108 rule, not a `400`: the request was understood and cannot be
 * satisfied. `details[0].path` points at `from`, the field the operator has to
 * correct.
 *
 * @param query - the validated list query.
 * @throws {SemanticValidationAppError} when `from` is later than `to`.
 */
function assertRange(query: AuditLogListQuery): void {
  if (query.from === undefined || query.to === undefined) {
    return;
  }

  if (new Date(query.from).getTime() <= new Date(query.to).getTime()) {
    return;
  }

  throw new SemanticValidationAppError(
    'The requested time window ends before it starts.',
    [FROM_AFTER_TO_DETAIL],
  );
}
