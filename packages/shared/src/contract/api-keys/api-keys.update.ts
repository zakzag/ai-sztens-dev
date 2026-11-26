/**
 * Zod schema of `PATCH /api/api-keys/:identifier` (AIS-108, plan `D4`).
 *
 * Lives in its own file rather than in `api-keys.schema.ts` on purpose: the
 * mutation contract is the one that will be copied by every resource, and a
 * separate module keeps it reviewable next to its own tests.
 *
 * Four rules make the body safe to apply to a stored row:
 *
 * 1. **Every mutable field is optional** — a `PATCH` sends only what changes.
 * 2. **`undefined` means “leave it”, `null` means “clear it”** — which is why
 *    `description` and `expiresAt` are `.nullable().optional()`. Without
 *    `nullable` a client could never unset an expiry again.
 * 3. **`updatedAt` is required** — it is the optimistic-concurrency token the
 *    server compares against the stored value, so `{}` is a `400` instead of a
 *    silently empty update that reports success without writing.
 * 4. **`.strict()`** — `identifier`, `id`, `createdAt` and `updatedAt`-like
 *    server-managed fields are rejected with `400 VALIDATION_FAILED`. Accepting
 *    them silently would let a client believe it renamed the address (it cannot:
 *    the identifier *is* the URL) or set the token it is supposed to send.
 */

import { z } from 'zod';
import { isoDateTimeSchema } from '../datetime.schema.js';
import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from './api-keys.const.js';

/**
 * Field names a `PATCH` must **not** accept (documentation constant).
 *
 * Not used by the schema itself — `.strict()` already rejects them — but kept
 * next to it so the schema test can assert the intent explicitly, and so a
 * reader sees the reasoning instead of having to reconstruct it from a
 * `400`.
 */
export const API_KEY_UPDATE_FORBIDDEN_FIELDS = [
  'id',
  'identifier',
  'createdAt',
  'deletedAt',
] as const;

/**
 * Body of `PATCH /api/api-keys/:identifier`.
 *
 * `updatedAt` is the client's last known version of the row. It is **never**
 * written: the column is owned by the database (`$onUpdate`), and the value the
 * client sends is only compared (plan `D5`). A stale value is a
 * `409 STALE_WRITE`, not a silent overwrite.
 */
export const updateApiKeySchema = z
  .object({
    name: z.string().min(1).max(API_KEY_NAME_MAX_LENGTH).optional(),
    description: z
      .string()
      .max(API_KEY_DESCRIPTION_MAX_LENGTH)
      .nullable()
      .optional(),
    apiKey: z.string().min(1).max(API_KEY_VALUE_MAX_LENGTH).optional(),
    expiresAt: isoDateTimeSchema.nullable().optional(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();
