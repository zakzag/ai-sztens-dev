/**
 * Use-case orchestration for API keys.
 *
 * Responsibilities, and nothing else:
 * - call the repository through its interface;
 * - translate the one domain failure into an HTTP exception (409);
 * - map rows to the wire contract through the pure mapper.
 *
 * The repository is injected via {@link API_KEYS_REPOSITORY}, not by class, so
 * this file has no knowledge of Drizzle and the spec can pass a plain object.
 */

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApiKeyResponse,
  CreateApiKeyInput,
} from './api-keys.interface.js';
import { toApiKeyResponse, toNewApiKeyRow } from './api-keys.mapper.js';
import { API_KEYS_REPOSITORY } from './api-keys.const.js';
import { ApiKeyIdentifierConflictError } from './api-keys.errors.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(API_KEYS_REPOSITORY)
    private readonly repository: ApiKeysRepository,
  ) {}

  /**
   * Lists every stored key, newest first.
   *
   * @returns the full list, mapped to the wire contract (empty array allowed).
   */
  async list(): Promise<ApiKeyResponse[]> {
    const rows = await this.repository.findAll();
    return rows.map(toApiKeyResponse);
  }

  /**
   * Looks a key up by its unique identifier.
   *
   * @param identifier - path parameter of `GET /api/api-keys/:identifier`.
   * @returns the matching key.
   * @throws {NotFoundException} when no row owns the identifier (or it is blank).
   */
  async findByIdentifier(identifier: string): Promise<ApiKeyResponse> {
    const row = await this.repository.findByIdentifier(identifier);

    if (row === null) {
      throw new NotFoundException(
        `No API key with identifier "${identifier}" was found.`,
      );
    }

    return toApiKeyResponse(row);
  }

  /**
   * Creates a new key.
   *
   * @param input - body validated by {@link CreateApiKeyDto}.
   * @returns the persisted key (201 body).
   * @throws {ConflictException} when `identifier` is already taken.
   */
  async create(input: CreateApiKeyInput): Promise<ApiKeyResponse> {
    try {
      const row = await this.repository.create(toNewApiKeyRow(input));
      return toApiKeyResponse(row);
    } catch (error) {
      if (error instanceof ApiKeyIdentifierConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
