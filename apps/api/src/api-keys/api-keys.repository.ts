/**
 * Drizzle implementation of {@link ApiKeysRepository}.
 *
 * This is the only file in the feature that builds SQL, and the only one that
 * may import Drizzle. It receives the shared `DATABASE` handle from
 * `DatabaseModule` (never creates a client) and translates exactly one failure
 * mode into a domain error: the `api_keys_identifier_key` unique violation.
 * Everything else is re-thrown untouched, so a connection or permission problem
 * is never disguised as a business conflict.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ApiKeyListQuery } from '@callback/shared';
import { asc, count, desc, eq } from 'drizzle-orm';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { apiKeys } from '../db/schema.js';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import { API_KEY_SORT_COLUMNS } from './api-keys.const.js';
import { isIdentifierConflict } from './api-keys.error-guard.js';
import { apiKeySearchFilter } from './api-keys.filter.js';
import {
  ApiKeyIdentifierConflictError,
  ApiKeyRowMissingError,
} from './api-keys.errors.js';
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
    const where = apiKeySearchFilter(query.q);
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
      .where(eq(apiKeys.identifier, search))
      .limit(1);

    return rows[0] ?? null;
  }
}
