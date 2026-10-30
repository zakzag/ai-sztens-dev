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

import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';

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
   * Returns every row, newest first (`created_at DESC`).
   *
   * No pagination by design (plan D7): the table holds provider credentials, a
   * handful of rows, and a stable order keeps the e2e assertions deterministic.
   */
  findAll(): Promise<ApiKeyRow[]>;

  /**
   * Looks a row up by its unique `identifier`.
   *
   * @param identifier - search key; blank/whitespace input must short-circuit
   *   to `null` **without** a query (plan D5).
   * @returns the matching row, or `null` when there is none.
   */
  findByIdentifier(identifier: string): Promise<ApiKeyRow | null>;
}
