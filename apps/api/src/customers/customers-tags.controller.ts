/**
 * HTTP surface of the customer tags (AIS-178, slice e).
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `POST   /api/admin/customers/:id/tags`             → 201 `{ data: CustomerTag }`
 * - `PATCH  /api/admin/customers/:id/tags`             → 200 `{ data: CustomerTag }`
 * - `DELETE /api/admin/customers/:id/tags/:tagId`      → 200 `{ data: null }`
 *
 * The controller only routes, validates with the **shared** zod schemas and wraps
 * the result: the `404`/`422` decisions belong to the service and persistence to
 * the repository. Nothing here defines a payload shape — that is
 * `@callback/shared`.
 *
 * Three deliberate details:
 *
 * 1. **Both path parameters are validated** with the shared `customerIdSchema` /
 *    `customerTagIdSchema`, so a malformed uuid never reaches Postgres (`22P02`
 *    would become a `500`).
 * 2. **All three handlers read the raw request** — `@Req()` +
 *    `toAuditRequestFacts()` is the seam AIS-177 `D7` designed for the audit row's
 *    client address, user agent and correlation id. The create/attach pair always
 *    audits the **link**, and only a genuinely new catalogue row adds a second
 *    entry.
 * 3. **`DELETE` answers `200` with a null payload**, never `204`: the envelope
 *    must keep `meta.requestId` (the same choice `customers` and contacts made).
 */

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  HTTP_STATUS,
  attachCustomerTagSchema,
  createCustomerTagSchema,
  customerIdSchema,
  customerTagIdSchema,
  type ApiEnvelope,
  type AttachCustomerTagInput,
  type CreateCustomerTagInput,
  type CustomerTag,
} from '@callback/shared';
import {
  toAuditRequestFacts,
  type AuditRequestLike,
} from '../audit/audit-request.logic.js';
import type { AuditRequestFacts } from '../audit/audit.interface.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { ReqCtx } from '../common/http/request-context.decorator.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { ZodBodyPipe, ZodValidationPipe } from '../common/http/zod.pipe.js';
import { CustomerTagsService } from './customers-tags.service.js';
import { CUSTOMER_TAGS_ROUTE } from './customers-tags.const.js';

@Controller(CUSTOMER_TAGS_ROUTE)
export class CustomerTagsController {
  constructor(
    private readonly tags: CustomerTagsService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `POST /api/admin/customers/:id/tags` — create-or-attach a label by name.
   *
   * The answer is `201` whether or not the catalogue row was new: the **link** is
   * the resource the call addresses, and a repeat of the same request is a no-op
   * that still reports the label the customer now carries.
   */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async create(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Body(new ZodBodyPipe(createCustomerTagSchema))
    input: CreateCustomerTagInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<CustomerTag>> {
    return this.responses.ok(
      await this.tags.create(customerId, input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id/tags` — attach an existing catalogue label.
   *
   * An unknown or inactive `tagId` is `422 SEMANTIC_VALIDATION_FAILED`; an
   * already attached label answers `200` without a new ledger row.
   */
  @Patch()
  @HttpCode(HTTP_STATUS.OK)
  async attach(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Body(new ZodBodyPipe(attachCustomerTagSchema))
    input: AttachCustomerTagInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<CustomerTag>> {
    return this.responses.ok(
      await this.tags.attach(
        customerId,
        input.tagId,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }

  /** `DELETE /api/admin/customers/:id/tags/:tagId` — detach from this customer. */
  @Delete(':tagId')
  @HttpCode(HTTP_STATUS.OK)
  async detach(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('tagId', new ZodValidationPipe(customerTagIdSchema)) tagId: string,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<null>> {
    return this.responses.ok(
      await this.tags.detach(customerId, tagId, toAuditFacts(request, ctx)),
      ctx,
    );
  }
}

/**
 * Builds the request facts of one audited write.
 *
 * @param request - the raw Fastify request (headers + `ip`).
 * @param ctx - the envelope context, which carries the correlation id.
 * @returns the facts stored beside the audit rows.
 */
function toAuditFacts(
  request: AuditRequestLike,
  ctx: RequestContext,
): AuditRequestFacts {
  return toAuditRequestFacts(request, ctx.requestId);
}
