/**
 * HTTP surface of the customer audit-log read (AIS-178, slice f).
 *
 * Route (under the global `api` prefix from `main.ts`):
 * - `GET /api/admin/customers/:id/audit-logs` → 200 + `meta.pagination`
 *
 * One route, and deliberately nothing else: the ledger is append-only, so there
 * is no `POST`, no `PATCH` and no `DELETE` to mount. The controller only
 * validates the path parameter and the query string with the **shared** schemas,
 * delegates to the service and wraps the page — the `404` and the `422` decisions
 * belong to the service.
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  auditLogListQuerySchema,
  customerIdSchema,
  type ApiEnvelope,
  type AuditLog,
  type AuditLogListQuery,
} from '@callback/shared';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { ReqCtx } from '../common/http/request-context.decorator.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { ZodQueryPipe, ZodValidationPipe } from '../common/http/zod.pipe.js';
import { CustomerAuditLogsService } from './customers-audit-logs.service.js';
import { CUSTOMER_AUDIT_LOGS_ROUTE } from './customers-audit-logs.const.js';

@Controller(CUSTOMER_AUDIT_LOGS_ROUTE)
export class CustomerAuditLogsController {
  constructor(
    private readonly auditLogs: CustomerAuditLogsService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `GET /api/admin/customers/:id/audit-logs` — one page of the ledger.
   *
   * The query string is validated by `ZodQueryPipe` with the shared
   * `auditLogListQuerySchema`: the paging trio plus the four filters
   * (`tableName`, `operation`, `actorId`, `from`/`to`). An unknown `tableName` or
   * `operation` is a `400` from the shared enum, an inverted window a `422`.
   */
  @Get()
  async list(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Query(new ZodQueryPipe(auditLogListQuerySchema))
    query: AuditLogListQuery,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<readonly AuditLog[]>> {
    const { items, pagination } = await this.auditLogs.list(customerId, query);

    return this.responses.ok(items, ctx, pagination);
  }
}
