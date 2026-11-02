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
  toPaginationMeta,
  type ApiKey,
  type ApiKeyListQuery,
  type ApiErrorDetail,
  type CreateApiKeyInput,
  type UpdateApiKeyInput,
} from '@callback/shared';
import { API_KEYS_REPOSITORY } from './api-keys.const.js';
import { ApiKeyIdentifierConflictError } from './api-keys.errors.js';
import type { PaginatedApiKeys } from './api-keys.interface.js';
import { isPastDate } from './api-keys.logic.js';
import {
  toApiKeyPatch,
  toApiKeyResponse,
  toNewApiKeyRow,
} from './api-keys.mapper.js';
import type { ApiKeysRepository } from './api-keys.repository.interface.js';
import {
  ConflictAppError,
  NotFoundAppError,
  SemanticValidationAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';

/** Field-level detail sent with an identifier conflict. */
const IDENTIFIER_CONFLICT_DETAIL = 'This identifier is already taken.';

/** Field-level detail sent when `expiresAt` is already behind us. */
const EXPIRY_IN_PAST_DETAIL: ApiErrorDetail = {
  path: 'expiresAt',
  message: 'The expiry must not be in the past.',
};

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(API_KEYS_REPOSITORY)
    private readonly repository: ApiKeysRepository,
  ) {}

  /**
   * Lists one page of stored keys.
   *
   * The paging arithmetic is **not** the controller's job and not the SQL's
   * either: the repository returns the page plus the total, and
   * {@link toPaginationMeta} — a pure shared function, so the client's pager
   * computes the same numbers — turns that into `meta.pagination`.
   *
   * @param query - the validated list query (`ZodQueryPipe` output).
   * @returns the mapped rows of the page and the paging block.
   */
  async list(query: ApiKeyListQuery): Promise<PaginatedApiKeys> {
    const page = await this.repository.findPage(query);

    return {
      items: page.rows.map(toApiKeyResponse),
      pagination: toPaginationMeta(query, page.total),
    };
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

  /**
   * Applies a partial update, guarded by the client's last known version.
   *
   * The order of the three steps is the contract, not an implementation
   * detail:
   *
   * 1. **Semantics first** — an impossible payload is a `422` regardless of
   *    versions, so it is rejected before any write is attempted. Checking it
   *    after the update would turn a data bug into a `409` and make the retry
   *    advice wrong.
   * 2. **One atomic write** — the repository's `UPDATE … WHERE updated_at =
   *    expected` either matches or it does not; there is no read-compare-write
   *    window (plan `D5`).
   * 3. **Classify a miss** — `null` means “absent”, “deleted” or “stale”, and
   *    only one extra read can tell those apart.
   *
   * @param identifier - the row to update (the address; never patched).
   * @param input - body validated by `updateApiKeySchema`.
   * @param now - reference instant for the expiry rule, injected so the rule
   *   and its tests share one clock.
   * @returns the updated key, as stored.
   * @throws {SemanticValidationAppError} `422` when `expiresAt` is in the past.
   * @throws {NotFoundAppError} `404` when no live row owns the identifier.
   * @throws {StaleWriteAppError} `409` when the stored version differs.
   */
  async update(
    identifier: string,
    input: UpdateApiKeyInput,
    now: Date = new Date(),
  ): Promise<ApiKey> {
    if (input.expiresAt !== undefined && input.expiresAt !== null) {
      if (isPastDate(input.expiresAt, now)) {
        throw new SemanticValidationAppError(
          `The expiry "${input.expiresAt}" is already in the past.`,
          [EXPIRY_IN_PAST_DETAIL],
        );
      }
    }

    const updated = await this.repository.updateByIdentifier(
      identifier,
      toApiKeyPatch(input),
      new Date(input.updatedAt),
    );

    if (updated !== null) {
      return toApiKeyResponse(updated);
    }

    return this.classifyMissedUpdate(identifier, input.updatedAt);
  }

  /**
   * Answers a PATCH that matched no row.
   *
   * Three outcomes, one read: a row that does not exist at all and a row that
   * was deleted both answer `404` (a deleted row is invisible everywhere else,
   * so a `409` here would confirm its existence), and a *live* row with another
   * version is the lost update the token exists to catch.
   *
   * @param identifier - the identifier that matched nothing.
   * @param expectedUpdatedAt - the version the client sent.
   * @returns never — always throws.
   * @throws {NotFoundAppError} when the row is absent or soft-deleted.
   * @throws {StaleWriteAppError} when it exists, is live, and has another
   *   version.
   */
  private async classifyMissedUpdate(
    identifier: string,
    expectedUpdatedAt: string,
  ): Promise<never> {
    const row = await this.repository.findAnyByIdentifier(identifier);

    if (row === null || row.deletedAt !== null) {
      throw new NotFoundAppError(
        `No API key with identifier "${identifier}" was found.`,
      );
    }

    throw new StaleWriteAppError(
      `The API key with identifier "${identifier}" was updated by someone ` +
        `else (expected updatedAt ${expectedUpdatedAt}, stored ` +
        `${row.updatedAt.toISOString()}).`,
    );
  }

  /**
   * Soft-deletes a key.
   *
   * A second `DELETE` of the same identifier answers `404`, not `204`: the row
   * is already invisible to every read, so reporting success would claim an
   * effect the call did not have (plan §6, scenario 6).
   *
   * @param identifier - the row to hide.
   * @param now - deletion timestamp, injected so the caller owns the clock.
   * @throws {NotFoundAppError} when no live row owns the identifier.
   */
  async remove(identifier: string, now: Date = new Date()): Promise<null> {
    const deleted = await this.repository.softDeleteByIdentifier(
      identifier,
      now,
    );

    if (deleted === null) {
      throw new NotFoundAppError(
        `No API key with identifier "${identifier}" was found.`,
      );
    }

    return null;
  }
}
