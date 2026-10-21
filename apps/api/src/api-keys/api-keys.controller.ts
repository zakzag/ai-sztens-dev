/**
 * HTTP surface of the API-key store.
 *
 * Routes (all under the global `api` prefix from `main.ts`):
 * - `GET  /api/api-keys`               → 200 list, newest first
 * - `GET  /api/api-keys/:identifier`   → 200 single key, 404 when unknown
 * - `POST /api/api-keys`               → 201 created, 400 invalid, 409 duplicate
 *
 * The controller only routes and delegates: validation is the DTO's job, the
 * 409/404 decisions belong to the service, and persistence to the repository.
 *
 * Known limitation (deliberate, plan D13): these routes are **unauthenticated**
 * until the admin auth story lands. They return the stored token value, so they
 * must not be exposed publicly before that story is implemented.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { API_KEYS_ROUTE } from './api-keys.const.js';
import type { ApiKeyResponse } from './api-keys.interface.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';

@Controller(API_KEYS_ROUTE)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  /** `GET /api/api-keys` — every stored key, `created_at DESC`. */
  @Get()
  list(): Promise<ApiKeyResponse[]> {
    return this.apiKeys.list();
  }

  /** `GET /api/api-keys/:identifier` — one key by its unique identifier. */
  @Get(':identifier')
  findByIdentifier(
    @Param('identifier') identifier: string,
  ): Promise<ApiKeyResponse> {
    return this.apiKeys.findByIdentifier(identifier);
  }

  /** `POST /api/api-keys` — create; 201 with the persisted resource. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    return this.apiKeys.create(dto);
  }
}
