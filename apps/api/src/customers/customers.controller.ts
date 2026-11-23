/**
 * HTTP surface of the customer aggregate (AIS-178).
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `GET    /api/admin/customers`          → 200 `{ data: [...], meta.pagination }`
 * - `GET    /api/admin/customers/:id`      → 200 `{ data: {...}, meta }`, 404 envelope
 * - `POST   /api/admin/customers`          → 201 `{ data: {...}, meta }`, 400/409
 * - `PATCH  /api/admin/customers/:id`      → 200 `{ data: {...}, meta }`, 400/404/409
 * - `PATCH  /api/admin/customers/:id/status` → 200 `{ data: {...}, meta }`, 400/404/409
 * - `DELETE /api/admin/customers/:id`      → 200 `{ data: null, meta }`, 404 envelope
 *
 * The controller only routes, validates the request with the **shared** zod
 * schemas and wraps the result: the `409`/`404` decisions belong to the service,
 * the paging arithmetic too, and persistence to the repository. Nothing here
 * defines a payload shape — that is `@callback/shared`.
 *
 * Two deliberate details:
 *
 * 1. **`:id` is validated with the shared `customerIdSchema`.** A malformed uuid
 *    must not reach Postgres: `'abc'::uuid` raises SQLSTATE `22P02`, which the
 *    filter would report as a `500` (plan `D8`).
 * 2. **The four mutating handlers read the raw request.** `@Req()` +
 *    `toAuditRequestFacts()` is the seam AIS-177 `D7` designed: the audit row
 *    needs the client address, the user agent and the correlation id, and the
 *    envelope context does not carry the first two. The read handlers do not
 *    touch it.
 *
 * `DELETE` answers `200` with a null payload, never `204`: the envelope must
 * keep `meta.requestId` (`noPayloadSchema` is the same choice `api-keys` made).
 *
 * Known limitation (deliberate, follows the auth story): these routes are
 * **unauthenticated** until the admin auth lands (see `API-Convention.md` §7.1).
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
  createCustomerSchema,
  customerIdSchema,
  customerListQuerySchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  type ApiEnvelope,
  type CreateCustomerInput,
  type Customer,
  type CustomerDetail,
  type CustomerListQuery,
  type UpdateCustomerInput,
  type UpdateCustomerStatusInput,
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
import { CUSTOMERS_ROUTE } from './customers.const.js';
import { CustomersService } from './customers.service.js';

@Controller(CUSTOMERS_ROUTE)
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `GET /api/admin/customers` — one page of customers.
   *
   * The query string is validated (and defaulted) by `ZodQueryPipe` with the
   * contract schema, so an unknown `sort` column, an out-of-range `limit` or an
   * invalid filter value is a `400 VALIDATION_FAILED` with the offending path —
   * never a database error.
   */
  @Get()
  async list(
    @Query(new ZodQueryPipe(customerListQuerySchema)) query: CustomerListQuery,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<readonly Customer[]>> {
    const { items, pagination } = await this.customers.list(query);

    return this.responses.ok(items, ctx, pagination);
  }

  /**
   * `GET /api/admin/customers/:id` — one customer with its children.
   *
   * The path parameter is validated before the service is reached, so a `404` is
   * only ever produced by “no live row with this uuid”, never by a malformed
   * identifier.
   */
  @Get(':id')
  async findById(
    @Param('id', new ZodValidationPipe(customerIdSchema)) id: string,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<CustomerDetail>> {
    return this.responses.ok(await this.customers.findById(id), ctx);
  }

  /** `POST /api/admin/customers` — create; 201 with the persisted resource. */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async create(
    @Body(new ZodBodyPipe(createCustomerSchema)) input: CreateCustomerInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Customer>> {
    return this.responses.ok(
      await this.customers.create(input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id` — partial update, version-guarded.
   *
   * The body is validated against the shared `updateCustomerSchema`, which
   * requires `updatedAt` and rejects server-managed fields, so a malformed body
   * is a `400` before the service is reached. Visibility (`404`), the version
   * check (`409 STALE_WRITE`) and the tax number conflict (`409`) are the
   * service's decisions.
   */
  @Patch(':id')
  @HttpCode(HTTP_STATUS.OK)
  async update(
    @Param('id', new ZodValidationPipe(customerIdSchema)) id: string,
    @Body(new ZodBodyPipe(updateCustomerSchema)) input: UpdateCustomerInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Customer>> {
    return this.responses.ok(
      await this.customers.update(id, input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id/status` — the dedicated status change.
   *
   * A separate route and not a field of the edit form: the service must also
   * write `status_changed_at`, and the change is recorded as its own audit entry.
   */
  @Patch(':id/status')
  @HttpCode(HTTP_STATUS.OK)
  async updateStatus(
    @Param('id', new ZodValidationPipe(customerIdSchema)) id: string,
    @Body(new ZodBodyPipe(updateCustomerStatusSchema))
    input: UpdateCustomerStatusInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Customer>> {
    return this.responses.ok(
      await this.customers.updateStatus(id, input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `DELETE /api/admin/customers/:id` — archive (soft delete).
   *
   * Explicit `@HttpCode(OK)` because the standing rule forbids `204`: the
   * envelope must survive, so `meta.requestId` still reaches the client.
   */
  @Delete(':id')
  @HttpCode(HTTP_STATUS.OK)
  async remove(
    @Param('id', new ZodValidationPipe(customerIdSchema)) id: string,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<null>> {
    return this.responses.ok(
      await this.customers.remove(id, toAuditFacts(request, ctx)),
      ctx,
    );
  }
}

/**
 * Builds the request facts of one audited write.
 *
 * Extracted so the four mutating handlers read identically and the only place
 * that turns a raw request into audit facts stays the pure
 * `toAuditRequestFacts()` from the audit module.
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
