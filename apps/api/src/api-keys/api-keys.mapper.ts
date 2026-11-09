/**
 * Pure mapping between the DB row, the HTTP payload and the insert payload.
 *
 * No I/O, no Nest, no Drizzle query building — only field-level transformation,
 * which is why every branch (null vs. set, Date vs. string) is trivial to unit
 * test.
 *
 * The output type is `ApiKey` from `@callback/shared`: the wire shape is defined
 * once in the contract package (plan `D6`), so this module can only ever *produce*
 * that shape, never define a second copy of it.
 */

import type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '@callback/shared';
import type { ApiKeyRow, NewApiKeyRow } from '../db/schema.js';
import type { ApiKeyPatch } from './api-keys.interface.js';

/**
 * Converts a `Date` to the ISO 8601 string used on the wire.
 *
 * `JSON.stringify` would do this implicitly, but then the contract would live
 * inside Fastify's serialiser instead of in our code — and the client parses
 * exactly this shape with Zod.
 */
function toIsoString(value: Date): string {
  return value.toISOString();
}

/** Same as {@link toIsoString}, but keeps `null` as `null` (never `undefined`). */
function toNullableIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** The inverse of {@link toNullableIsoString}: wire string → `Date`, `null` stays `null`. */
function toNullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/**
 * Maps a `platform.api_keys` row to the API payload.
 *
 * @param row - row as returned by the repository.
 * @returns payload with ISO 8601 timestamps and explicit `null`s.
 */
export function toApiKeyResponse(row: ApiKeyRow): ApiKey {
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
 * Omitted optional fields become explicit `null` (plan D4): “absent” and
 * “explicitly empty” must not become two different DB states. `expiresAt`
 * arrives as an ISO 8601 string (that is what the shared schema validates) and
 * is parsed here, in one place, so the repository only ever sees a
 * `NewApiKeyRow`.
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

/**
 * Maps a validated `PATCH` body to the column subset the repository writes.
 *
 * The distinction the two have to preserve is `undefined` vs. `null`:
 *
 * - an **absent** key stays absent in the patch, which the repository reads as
 *   “do not touch this column”;
 * - an explicit **`null`** is passed through as `null`, which clears it.
 *
 * `updatedAt` is read by the caller (it is the concurrency token, compared
 * against the stored value) and is deliberately **not** part of the patch — the
 * column is owned by the database, so writing it would defeat the guard.
 *
 * @param input - validated body of `PATCH /api/api-keys/:identifier`.
 * @returns the columns to write; possibly empty, which is a valid (if
 *   pointless) update that still bumps `updatedAt`.
 */
export function toApiKeyPatch(input: UpdateApiKeyInput): ApiKeyPatch {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.apiKey === undefined ? {} : { apiKey: input.apiKey }),
    ...(input.expiresAt === undefined
      ? {}
      : { expiresAt: toNullableDate(input.expiresAt) }),
  };
}
