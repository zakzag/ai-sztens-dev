/**
 * Use-case orchestration for API keys.
 *
 * Responsibilities, and nothing else:
 * - call the repository through its interface;
 * - translate the one domain failure into an `AppError` (a `409` code, never an
 *   HTTP status — those are derived from the shared catalogue);
 * - map rows to the wire contract through the pure mapper.
 *
 * The service imports **no** `@nestjs/common` HTTP exception any more (plan
 * `D7`): it must stay callable from a worker or a script, where “HTTP 409” means
 * nothing. The global `ApiExceptionFilter` is what turns the code into a
 * response.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  API_ERROR_CODE,
  type ApiKey,
  type CreateApiKeyInput,
} from '@callback/shared';
import { API_KEYS_REPOSITORY } from './api-keys.const.js';
import { ApiKeyIdentifierConflictError } from './api-keys.errors.js';
import { toApiKeyResponse, toNewApiKeyRow } from './api-keys.mapper.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';
import {
  ConflictAppError,
  NotFoundAppError,
} from '../common/http/app-error.js';

/** Field-level detail sent with an identifier conflict. */
const IDENTIFIER_CONFLICT_DETAIL = 'This identifier is already taken.';

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
  async list(): Promise<ApiKey[]> {
    const rows = await this.repository.findAll();
    return rows.map(toApiKeyResponse);
  }

  /**
   * Looks a key up by its unique identifier.
   *
   * @param identifier - path parameter of `GET /api/api-keys/:identifier`.
   * @returns the matching key.
   * @throws {NotFoundAppError} when no row owns the identifier (or it is blank).
   */
  async findByIdentifier(identifier: string): Promise<ApiKey> {
    const row = await this.repository.findByIdentifier(identifier);

    if (row === null) {
      throw new NotFoundAppError(
        `No API key with identifier "${identifier}" was found.`,
      );
    }

    return toApiKeyResponse(row);
  }

  /**
   * Creates a new key.
   *
   * @param input - body validated by the shared `createApiKeySchema`.
   * @returns the persisted key (201 payload).
   * @throws {ConflictAppError} with `API_KEY_IDENTIFIER_CONFLICT` when the
   *   identifier is already taken — the specific code is what lets the admin put
   *   the message on the `identifier` field instead of a page-level alert.
   */
  async create(input: CreateApiKeyInput): Promise<ApiKey> {
    try {
      const row = await this.repository.create(toNewApiKeyRow(input));
      return toApiKeyResponse(row);
    } catch (error) {
      if (error instanceof ApiKeyIdentifierConflictError) {
        throw new ConflictAppError(
          error.message,
          API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
          [{ path: 'identifier', message: IDENTIFIER_CONFLICT_DETAIL }],
        );
      }
      throw error;
    }
  }
}
