/**
 * Zod schemas of the `api-keys` HTTP contract.
 *
 * Single source of truth for the *response* shape: `packages/api-client` parses
 * every payload with {@link apiKeySchema} at the network boundary, so a backend
 * change (a renamed field, a timestamp that is no longer ISO) fails loudly at
 * the edge instead of leaking `undefined` into the React tree.
 *
 * The wire contract is described in
 * [`apps/api/src/api-keys/api-keys.interface.ts`](../../../../apps/api/src/api-keys/api-keys.interface.ts):
 *
 * - timestamps are ISO 8601 strings (`Date.prototype.toISOString`, always `Z`),
 *   parsed with `offset: true` so an offset form is accepted as well;
 * - `description` and `expiresAt` are **`null`, never absent**, in a response —
 *   that is how “no expiry” is distinguishable from “field not serialised”;
 * - in the *request* the two optional fields may be omitted entirely, because
 *   `forbidNonWhitelisted` rejects anything the DTO does not declare.
 *
 * Unknown keys are stripped (zod's default) rather than rejected: an additive
 * backend field must not break a deployed frontend bundle.
 */

import { z } from 'zod';
import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from './api-key.const.js';

/**
 * ISO 8601 date-time with an explicit offset (`Z` or `+02:00`).
 *
 * A naked local timestamp (`2026-11-01T00:00:00`) is rejected on purpose: it
 * would be interpreted in the *browser's* timezone, which silently shifts the
 * stored moment.
 */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Message shown when the identifier violates the URL-safe pattern. */
export const API_KEY_IDENTIFIER_MESSAGE =
  'identifier must be 1-200 characters of letters, digits, dot, dash or underscore';

/** Unique, URL-safe lookup key. */
export const apiKeyIdentifierSchema = z
  .string()
  .regex(API_KEY_IDENTIFIER_PATTERN, API_KEY_IDENTIFIER_MESSAGE);

/** A single stored key, as returned by every `api-keys` endpoint. */
export const apiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(API_KEY_NAME_MAX_LENGTH),
  identifier: apiKeyIdentifierSchema,
  description: z.string().max(API_KEY_DESCRIPTION_MAX_LENGTH).nullable(),
  apiKey: z.string().min(1).max(API_KEY_VALUE_MAX_LENGTH),
  expiresAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/** Body of `GET /api/api-keys` — an array, empty when nothing is stored. */
export const apiKeyListSchema = z.array(apiKeySchema);

/**
 * Body of `POST /api/api-keys`.
 *
 * `description` and `expiresAt` are optional: an empty form field must be
 * omitted, not sent as `''` (the backend would answer 400) and not as `null`
 * (the DTO declares them `string`, not `string | null`).
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(API_KEY_NAME_MAX_LENGTH),
  identifier: apiKeyIdentifierSchema,
  description: z.string().max(API_KEY_DESCRIPTION_MAX_LENGTH).optional(),
  apiKey: z.string().min(1).max(API_KEY_VALUE_MAX_LENGTH),
  expiresAt: isoDateTimeSchema.optional(),
});
