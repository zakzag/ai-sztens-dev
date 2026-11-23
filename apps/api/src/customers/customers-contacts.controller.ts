/**
 * HTTP surface of the customer contacts (AIS-178, slice d).
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `GET    /api/admin/customers/:id/contacts`                 → 200 + `meta.pagination`
 * - `POST   /api/admin/customers/:id/contacts`                 → 201 `{ data: Contact }`
 * - `PATCH  /api/admin/customers/:id/contacts/:contactId`      → 200 `{ data: Contact }`
 * - `DELETE /api/admin/customers/:id/contacts/:contactId`      → 200 `{ data: null }`
 *
 * The controller only routes, validates with the **shared** zod schemas and wraps
 * the result: the `404`/`409`/`422` decisions belong to the service, the paging
 * arithmetic to `toPaginationMeta`, and persistence to the repository. Nothing
 * here defines a payload shape — that is `@callback/shared`.
 *
 * Three deliberate details:
 *
 * 1. **Both path parameters are validated** with the shared `customerIdSchema` /
 *    `contactIdSchema`, so a malformed uuid never reaches Postgres (`22P02` would
 *    become a `500`).
 * 2. **The three mutating handlers read the raw request** — `@Req()` +
 *    `toAuditRequestFacts()` is the seam AIS-177 `D7` designed for the audit row's
 *    client address, user agent and correlation id.
 * 3. **`DELETE` answers `200` with a null payload**, never `204`: the envelope
 *    must keep `meta.requestId` (the same choice `customers` and `api-keys` made).
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
  contactIdSchema,
  createContactSchema,
  customerIdSchema,
  listQuerySchema,
  updateContactSchema,
  type ApiEnvelope,
  type Contact,
  type CreateContactInput,
  type ListQuery,
  type UpdateContactInput,
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
import { CustomerContactsService } from './customers-contacts.service.js';
import { CUSTOMER_CONTACTS_ROUTE } from './customers-contacts.const.js';

@Controller(CUSTOMER_CONTACTS_ROUTE)
export class CustomerContactsController {
  constructor(
    private readonly contacts: CustomerContactsService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `GET /api/admin/customers/:id/contacts` — one page of contacts.
   *
   * The query string is validated (and defaulted) by `ZodQueryPipe` with the
   * shared `listQuerySchema`, so an out-of-range `limit` or an invalid `order` is a
   * `400 VALIDATION_FAILED` with the offending path — never a database error.
   */
  @Get()
  async list(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Query(new ZodQueryPipe(listQuerySchema)) query: ListQuery,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<readonly Contact[]>> {
    const { items, pagination } = await this.contacts.list(customerId, query);

    return this.responses.ok(items, ctx, pagination);
  }

  /** `POST /api/admin/customers/:id/contacts` — create; 201 with the contact. */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async create(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Body(new ZodBodyPipe(createContactSchema)) input: CreateContactInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Contact>> {
    return this.responses.ok(
      await this.contacts.create(customerId, input, toAuditFacts(request, ctx)),
      ctx,
    );
  }

  /**
   * `PATCH /api/admin/customers/:id/contacts/:contactId` — partial update.
   *
   * The body requires `updatedAt`, rejects server-managed fields and may carry a
   * new `roles` set; a stale token is `409 STALE_WRITE`, a second `primary` is
   * `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT`, a foreign login user is `422`.
   */
  @Patch(':contactId')
  @HttpCode(HTTP_STATUS.OK)
  async update(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('contactId', new ZodValidationPipe(contactIdSchema))
    contactId: string,
    @Body(new ZodBodyPipe(updateContactSchema)) input: UpdateContactInput,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<Contact>> {
    return this.responses.ok(
      await this.contacts.update(
        customerId,
        contactId,
        input,
        toAuditFacts(request, ctx),
      ),
      ctx,
    );
  }

  /** `DELETE /api/admin/customers/:id/contacts/:contactId` — archive. */
  @Delete(':contactId')
  @HttpCode(HTTP_STATUS.OK)
  async remove(
    @Param('id', new ZodValidationPipe(customerIdSchema)) customerId: string,
    @Param('contactId', new ZodValidationPipe(contactIdSchema))
    contactId: string,
    @Req() request: AuditRequestLike,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<null>> {
    return this.responses.ok(
      await this.contacts.remove(
        customerId,
        contactId,
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
