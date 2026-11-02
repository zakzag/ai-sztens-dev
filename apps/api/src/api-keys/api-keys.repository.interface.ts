/**
 * Persistence contract of the `api-keys` feature.
 *
 * The service depends on this interface only (plan D2), which is what makes the
 * service spec a plain object mock — no Nest, no Drizzle, no socket. The
 * implementation owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 * - return rows / `null`, never HTTP concepts — no `@nestjs/common` import here
 *   or in the implementation (plan D3);
 * - a duplicate `identifier` is reported as `ApiKeyIdentifierConflictError`,
 *   every other failure is propagated unchanged so the original stack survives.
 */

import type { ApiKeyListQuery } from '@callback/shared';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';

/**
 * One page of stored keys plus the size of the whole result set.
 *
 * `total` is counted with a second query over the **same** filter, so the
 * client's pager can compute `totalPages` without walking the table itself.
 */
export interface ApiKeyPage {
  /** The rows of the requested page (empty when the page is past the end). */
  readonly rows: readonly ApiKeyRow[];

  /** Matching rows across all pages. */
  readonly total: number;
}

export interface ApiKeysRepository {
  /**
   * Inserts one row and returns it as stored (server defaults included).
   *
   * @param input - insert payload, already normalised by the mapper.
   * @returns the persisted row.
   * @throws {ApiKeyIdentifierConflictError} when `identifier` already exists.
   * @throws {ApiKeyRowMissingError} when `INSERT … RETURNING` yields no row.
   */
  create(input: NewApiKeyRow): Promise<ApiKeyRow>;

  /**
   * Returns one page of rows plus the total count (AIS-107).
   *
   * The order is **always** deterministic: the requested column first, then
   * `id` as the tie-breaker. Without the tie-breaker two rows sharing a
   * timestamp could swap places between two requests and a page boundary would
   * silently skip or repeat a row.
   *
   * `query.q` is a case-insensitive substring filter over `name` and
   * `identifier` — it is **applied**, not ignored: the contract accepts the
   * field, so a silently unfiltered list would be a lie the client cannot see.
   *
   * @param query - the validated list query (paging, sort, filter).
   * @returns the page and the total number of matching rows.
   */
  findPage(query: ApiKeyListQuery): Promise<ApiKeyPage>;

  /**
   * Looks a row up by its unique `identifier`.
   *
   * @param identifier - search key; blank/whitespace input must short-circuit
   *   to `null` **without** a query (plan D5).
   * @returns the matching row, or `null` when there is none.
   */
  findByIdentifier(identifier: string): Promise<ApiKeyRow | null>;
}
