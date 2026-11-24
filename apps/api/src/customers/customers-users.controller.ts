/**
 * HTTP surface of the customer login users (AIS-178, slice e).
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `POST   /api/admin/customers/:id/customer-users`                     → 201 `{ data: CustomerUser }`
 * - `PATCH  /api/admin/customers/:id/customer-users/:customerUserId`     → 200 `{ data: CustomerUser }`
 * - `DELETE /api/admin/customers/:id/customer-users/:customerUserId`     → 200 `{ data: null }`
 *
 * The controller only routes, validates with the **shared** zod schemas and wraps
 * the result: the `404`/`409`/`422` decisions belong to the service and
 * persistence to the repository. Nothing here defines a payload shape — that is
 * `@callback/shared`.
 *
 * Three deliberate details:
 *
 * 1. **Both path parameters are validated** with the shared `customerIdSchema` /
 *    `customerUserIdSchema`, so a malformed uuid never reaches Postgres (`22P02`
 *    would become a `500`).
 * 2. **All three handlers read the raw request** — `@Req()` +
 *    `toAuditRequestFacts()` is the seam AIS-177 `D7` designed for the audit row's
 *    client address, user agent and correlation id.
 * 3. **`DELETE` answers `200` with a null payload**, never `204`: the envelope
 *    must keep `meta.requestId`. It revokes a pending invitation only — the
 *    service answers `422` for anything that has been activated.
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
  customerIdSchema,
  customerUserIdSchema,
  inviteCustomerUserSchema,
  updateCustomerUserSchema,
  type ApiEnvelope,
  type CustomerUser,
  type InviteCustomerUserInput,
  type UpdateCustomerUserInput,
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
import { CustomerUsersService } from './customers-users.service.js';
import { CUSTOMER_USERS_ROUTE } from './customers-users.const.js';

@Controller(CUSTOMER_USERS_ROUTE)
export class CustomerUsersController {
  constructor(
    private readonly users: CustomerUsersService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `POST /api/admin/customers/:id/customer-users` — invite a login user.
   *
   * The body carries only name, e-mail and role: `status`, `invitedAt` and the
   * auth-owned columns are server values, and `.strict()` rejects them.
   */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async invite(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Body(new ZodBodyPipe(inviteCustomerUserSchema))
    input: InviteCustomerUserInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<CustomerUser>> {
    return this.responses.ok(
      await this.users.invite(customerId, input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id/customer-users/:customerUserId`.
   *
   * `updatedAt` is required; `status` accepts only `active` / `inactive`, and a
   * second **active owner** is `409 CUSTOMER_OWNER_CONFLICT`.
   */
  @Patch(':customerUserId')
  @HttpCode(HTTP_STATUS.OK)
  async update(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('customerUserId', new ZodValidationPipe(customerUserIdSchema))
    customerUserId: string,
    @Body(new ZodBodyPipe(updateCustomerUserSchema))
    input: UpdateCustomerUserInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<CustomerUser>> {
    return this.responses.ok(
      await this.users.update(
        customerId,
        customerUserId,
        input,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }

  /** `DELETE /api/admin/customers/:id/customer-users/:customerUserId` — revoke. */
  @Delete(':customerUserId')
  @HttpCode(HTTP_STATUS.OK)
  async remove(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('customerUserId', new ZodValidationPipe(customerUserIdSchema))
    customerUserId: string,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<null>> {
    return this.responses.ok(
      await this.users.remove(
        customerId,
        customerUserId,
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
 * @returns the facts stored beside the audit rows.
 */
function toAuditFacts(
  request: AuditRequestLike,
  ctx: RequestContext,
): AuditRequestFacts {
  return toAuditRequestFacts(request, ctx.requestId);
}
