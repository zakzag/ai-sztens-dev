/**
 * HTTP surface of the API-key store.
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `GET  /api/api-keys`               → 200 `{ data: [...], meta.pagination }`
 * - `GET  /api/api-keys/:identifier`   → 200 `{ data: {...}, meta }`, 404 envelope when unknown
 * - `POST /api/api-keys`               → 201 `{ data: {...}, meta }`, 400/409 envelope
 *
 * The controller only routes, validates the request with the **shared** zod
 * schemas and wraps the result: the `409`/`404` decisions belong to the service,
 * the paging arithmetic too, and persistence to the repository. Nothing here
 * defines a payload shape — that is `@callback/shared`
 * (see `docs/Specs/API-Convention.md`).
 *
 * Known limitation (deliberate, follows the auth story): these routes are
 * **unauthenticated** until the admin auth lands. They return the stored token
 * value, so they must not be exposed publicly before that story is implemented.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  HTTP_STATUS,
  apiKeyListQuerySchema,
  createApiKeySchema,
  type ApiEnvelope,
  type ApiKey,
  type ApiKeyListQuery,
  type CreateApiKeyInput,
} from '@callback/shared';
import { API_KEYS_ROUTE } from './api-keys.const.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiResponseService } from '../common/http/api-response.service.js';
import { ReqCtx } from '../common/http/request-context.decorator.js';
import type { RequestContext } from '../common/http/request-context.interface.js';
import { ZodBodyPipe, ZodQueryPipe } from '../common/http/zod.pipe.js';

@Controller(API_KEYS_ROUTE)
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly responses: ApiResponseService,
  ) {}

  /**
   * `GET /api/api-keys` — one page of stored keys.
   *
   * The query string is validated (and defaulted) by `ZodQueryPipe` with the
   * contract schema, so an unknown `sort` column or an out-of-range `limit` is a
   * `400 VALIDATION_FAILED` with the offending path — never a database error.
   */
  @Get()
  async list(
    @Query(new ZodQueryPipe(apiKeyListQuerySchema)) query: ApiKeyListQuery,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<readonly ApiKey[]>> {
    const { items, pagination } = await this.apiKeys.list(query);

    return this.responses.ok(items, ctx, pagination);
  }

  /** `GET /api/api-keys/:identifier` — one key by its unique identifier. */
  @Get(':identifier')
  async findByIdentifier(
    @Param('identifier') identifier: string,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<ApiKey>> {
    return this.responses.ok(
      await this.apiKeys.findByIdentifier(identifier),
      ctx,
    );
  }

  /** `POST /api/api-keys` — create; 201 with the persisted resource. */
  @Post()
  @HttpCode(HTTP_STATUS.CREATED)
  async create(
    @Body(new ZodBodyPipe(createApiKeySchema)) input: CreateApiKeyInput,
    @ReqCtx() ctx: RequestContext,
  ): Promise<ApiEnvelope<ApiKey>> {
    return this.responses.ok(await this.apiKeys.create(input), ctx);
  }
}
