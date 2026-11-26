/**
 * Drizzle implementation of {@link ApiKeysRepository}.
 *
 * This is the only file in the feature that builds SQL, and the only one that
 * may import Drizzle. It receives the shared `DATABASE` handle from
 * `DatabaseModule` (never creates a client) and translates exactly one failure
 * mode into a domain error: the `api_keys_identifier_key` unique violation.
 * Everything else is re-thrown untouched, so a connection or permission problem
 * is never disguised as a business conflict.
 *
 * Since AIS-108 every read and every write carries the soft-delete filter
 * (`apiKeyNotDeletedFilter()`), so a deleted row is invisible by construction:
 * `findByIdentifier` cannot find it, `updateByIdentifier` cannot match it and
 * `softDeleteByIdentifier` cannot delete it twice. The single deliberate
 * exception is `findAnyByIdentifier`, which exists to *classify* an update that
 * matched nothing — see its docblock.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ApiKeyListQuery } from '@callback/shared';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { apiKeys } from '../db/schema.js';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { API_KEY_SORT_COLUMNS } from './api-keys.const.js';
import { isIdentifierConflict } from './api-keys.error-guard.js';
import {
  apiKeyNotDeletedFilter,
  apiKeyVisibleFilter,
} from './api-keys.filter.js';
import {
  ApiKeyIdentifierConflictError,
  ApiKeyRowMissingError,
} from './api-keys.errors.js';
import type { ApiKeyPatch } from './api-keys.interface.js';
import type {
  ApiKeyPage,
  ApiKeysRepository,
} from './api-keys.repository.interface.js';

/**
 * Postgres-backed storage for `platform.api_keys`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleApiKeysRepository(db);
 * const row = await repository.findByIdentifier('vapi-prod');
 * ```
 */
@Injectable()
export class DrizzleApiKeysRepository implements ApiKeysRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc ApiKeysRepository.create} */
  async create(input: NewApiKeyRow): Promise<ApiKeyRow> {
    let rows: ApiKeyRow[];

    try {
      rows = await this.db.insert(apiKeys).values(input).returning();
    } catch (error) {
      if (isIdentifierConflict(error)) {
        throw new ApiKeyIdentifierConflictError(input.identifier, error);
      }
      throw error;
    }

    const [row] = rows;
    if (row === undefined) {
      throw new ApiKeyRowMissingError(input.identifier);
    }

    return row;
  }

  /** {@inheritDoc ApiKeysRepository.findPage} */
  async findPage(query: ApiKeyListQuery): Promise<ApiKeyPage> {
    // One expression for the count and the page query, so the two can never
    // disagree about the result set (the total would then lie about the rows).
    const where = apiKeyVisibleFilter(query.q);
    const direction = query.order === 'asc' ? asc : desc;

    // Two round trips, deliberately: `count(*)` cannot be derived from the page
    // itself (`rows.length` is the page size, not the result size), and the
    // client's pager needs `total` before it can render page numbers.
    const [counted, rows] = await Promise.all([
      this.db.select({ total: count() }).from(apiKeys).where(where),
      this.db
        .select()
        .from(apiKeys)
        .where(where)
        .orderBy(direction(API_KEY_SORT_COLUMNS[query.sort]), asc(apiKeys.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ]);

    // The driver may report `count(*)` as a string on bigint columns, so the
    // value is normalised here instead of leaking an `unknown` type upwards.
    return { rows, total: Number(counted[0]?.total ?? 0) };
  }

  /**
   * {@inheritDoc ApiKeysRepository.findByIdentifier}
   */
  async findByIdentifier(identifier: string): Promise<ApiKeyRow | null> {
    const search = identifier.trim();

    // Plan D5: a blank search key cannot match any row (the DTO pattern forbids
    // whitespace, and the column is NOT NULL), so skip the round trip entirely.
    if (search.length === 0) {
      return null;
    }

    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.identifier, search), apiKeyNotDeletedFilter()))
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc ApiKeysRepository.updateByIdentifier} */
  async updateByIdentifier(
    identifier: string,
    patch: ApiKeyPatch,
    expectedUpdatedAt: Date,
  ): Promise<ApiKeyRow | null> {
    // One statement, three conditions — that is the whole point of the design
    // (plan D5). A read-compare-write would leave a window in which another
    // writer could commit between the check and the update.
    const rows = await this.db
      .update(apiKeys)
      .set(patch)
      .where(
        and(
          eq(apiKeys.identifier, identifier),
          apiKeyNotDeletedFilter(),
          eq(apiKeys.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc ApiKeysRepository.softDeleteByIdentifier} */
  async softDeleteByIdentifier(
    identifier: string,
    deletedAt: Date,
  ): Promise<ApiKeyRow | null> {
    const rows = await this.db
      .update(apiKeys)
      .set({ deletedAt })
      .where(and(eq(apiKeys.identifier, identifier), apiKeyNotDeletedFilter()))
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc ApiKeysRepository.findAnyByIdentifier} */
  async findAnyByIdentifier(identifier: string): Promise<ApiKeyRow | null> {
    const search = identifier.trim();

    if (search.length === 0) {
      return null;
    }

    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.identifier, search))
      .limit(1);

    return rows[0] ?? null;
  }
}
