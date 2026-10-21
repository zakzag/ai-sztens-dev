/**
 * Pure mapping between the DB row, the HTTP response and the insert payload.
 *
 * No I/O, no Nest, no Drizzle query building — only field-level transformation,
 * which is why every branch (null vs. set, Date vs. string) is trivial to unit
 * test.
 */

import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import type {
  ApiKeyResponse,
  CreateApiKeyInput,
} from './api-keys.interface.js';

/**
 * Converts a `Date` to the ISO 8601 string used on the wire.
 *
 * `JSON.stringify` would do this implicitly, but then the contract would live
 * inside Fastify's serialiser instead of in our code — and AIS-58 has to parse
 * exactly this shape with Zod.
 */
function toIsoString(value: Date): string {
  return value.toISOString();
}

/** Same as {@link toIsoString}, but keeps `null` as `null` (never `undefined`). */
function toNullableIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/**
 * Maps a `platform.api_keys` row to the API response body.
 *
 * @param row - row as returned by the repository.
 * @returns response with ISO 8601 timestamps and explicit `null`s.
 */
export function toApiKeyResponse(row: ApiKeyRow): ApiKeyResponse {
  return {
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    description: row.description,
    apiKey: row.apiKey,
    expiresAt: toNullableIsoString(row.expiresAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

/**
 * Maps a validated request body to an insert payload.
 *
 * Omitted optional fields become explicit `null` (plan D8): “absent” and
 * “explicitly empty” must not become two different DB states. `expiresAt`
 * arrives as an ISO 8601 string (that is what the DTO validates) and is parsed
 * here, in one place, so the repository only ever sees a `NewApiKeyRow`.
 *
 * Values are **not** trimmed or otherwise rewritten — the mapper must not hide
 * mutations; the only normalisation in this feature is on the lookup key, in the
 * repository.
 *
 * @param input - validated body of `POST /api/api-keys`.
 * @returns insert payload for `platform.api_keys`.
 */
export function toNewApiKeyRow(input: CreateApiKeyInput): NewApiKeyRow {
  const expiresAt =
    input.expiresAt === undefined ? null : new Date(input.expiresAt);

  return {
    name: input.name,
    identifier: input.identifier,
    description: input.description === undefined ? null : input.description,
    apiKey: input.apiKey,
    expiresAt,
  };
}
