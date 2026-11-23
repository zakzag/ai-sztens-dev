/**
 * HTTP surface of the customer activity feed (AIS-178, slice f).
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `GET    /api/admin/customers/:id/activities`                     → 200 + `meta.pagination`
 * - `POST   /api/admin/customers/:id/activities`                     → 201 `{ data: Activity }`
 * - `PATCH  /api/admin/customers/:id/activities/:activityId`         → 200 `{ data: Activity }`
 * - `DELETE /api/admin/customers/:id/activities/:activityId`         → 200 `{ data: null }`
 *
 * The controller only routes, validates with the **shared** zod schemas and wraps
 * the result: the `404`/`409` decisions belong to the service, the paging
 * arithmetic to `toPaginationMeta`, and persistence to the repository. Nothing
 * here defines a payload shape — that is `@callback/shared`.
 *
 * Three deliberate details:
 *
 * 1. **Both path parameters are validated** with the shared `customerIdSchema` /
 *    `activityIdSchema`, so a malformed uuid never reaches Postgres (`22P02` would
 *    become a `500`).
 * 2. **The three mutating handlers read the raw request** — `@Req()` +
 *    `toAuditRequestFacts()` is the seam AIS-177 `D7` designed for the audit row's
 *    client address, user agent and correlation id. The author of the entry is
 *    **not** read from here: it comes from `AUDIT_ACTOR_PROVIDER` in the service.
 * 3. **`DELETE` answers `200` with a null payload**, never `204`: the envelope
 *    must keep `meta.requestId` (the same choice `customers`, contacts, tags and
 *    customer users made).
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  HTTP_STATUS,
  activityIdSchema,
  activityListQuerySchema,
  createActivitySchema,
  customerIdSchema,
  updateActivitySchema,
  type Activity,
  type ActivityListQuery,
  type ApiEnvelope,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@callback/shared';
import {
  toAuditRequestFacts,
  type AuditRequestLike,
} from '../audit/audit-request.logic.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { ReqCtx } from '../common/http/request-context.decorator.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import {
  ZodBodyPipe,
  ZodQueryPipe,
  ZodValidationPipe,
} from '../common/http/zod.pipe.js';
import { CustomerActivitiesService } from './customers-activities.service.js';
import { CUSTOMER_ACTIVITIES_ROUTE } from './customers-activities.const.js';

@Controller(CUSTOMER_ACTIVITIES_ROUTE)
export class CustomerActivitiesController {
  constructor(
    private readonly activities: CustomerActivitiesService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `GET /api/admin/customers/:id/activities` — one page of the live feed.
   *
   * The query string is validated (and defaulted) by `ZodQueryPipe` with the
   * shared `activityListQuerySchema`, which deliberately has **no `q` and no
   * `sort`**: the feed has exactly one meaningful order (`created_at`) and the
   * screen has no search box.
   */
  @Get()
  async list(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Query(new ZodQueryPipe(activityListQuerySchema))
    query: ActivityListQuery,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<readonly Activity[]>> {
    const { items, pagination } = await this.activities.list(customerId, query);

    return this.responses.ok(items, ctx, pagination);
  }

  /** `POST /api/admin/customers/:id/activities` — record an entry. */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async create(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Body(new ZodBodyPipe(createActivitySchema)) input: CreateActivityInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Activity>> {
    return this.responses.ok(
      await this.activities.create(
        customerId,
        input,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id/activities/:activityId` — partial update.
   *
   * The body requires `updatedAt` (the row's last write instant) and rejects the
   * server-owned author columns; a stale token is `409 STALE_WRITE`.
   */
  @Patch(':activityId')
  @HttpCode(HTTP_STATUS.OK)
  async update(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('activityId', new ZodValidationPipe(activityIdSchema))
    activityId: string,
    @Body(new ZodBodyPipe(updateActivitySchema)) input: UpdateActivityInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Activity>> {
    return this.responses.ok(
      await this.activities.update(
        customerId,
        activityId,
        input,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }

  /** `DELETE /api/admin/customers/:id/activities/:activityId` — soft delete. */
  @Delete(':activityId')
  @HttpCode(HTTP_STATUS.OK)
  async remove(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('activityId', new ZodValidationPipe(activityIdSchema))
    activityId: string,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<null>> {
    return this.responses.ok(
      await this.activities.remove(
        customerId,
        activityId,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }
}

/**
 * Builds the request facts of one audited write.
 *
 * @param request - the raw Fastify request (headers + `ip`).
 * @param ctx - the envelope context, which carries the correlation id.
 * @returns the facts stored beside the audit row.
 */
function toAuditFacts(
  request: AuditRequestLike,
  ctx: RequestContext,
): AuditRequestFacts {
  return toAuditRequestFacts(request, ctx.requestId);
}
