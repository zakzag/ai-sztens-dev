/**
 * Types of the `api-keys` contract, derived from the zod schemas.
 *
 * Derived rather than hand-written: a schema change must not be able to drift
 * away from the type. Consumers (`packages/api-client`, the admin page) import
 * these aliases, never `z.infer` at the call site.
 */

import type { z } from 'zod';
import type { apiKeySchema, createApiKeySchema } from './api-keys.schema.js';
import type { updateApiKeySchema } from './api-keys.update.js';

/** A single stored API key as returned by the API. */
export type ApiKey = z.infer<typeof apiKeySchema>;

/** Payload of `POST /api/api-keys`. */
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * Payload of `PATCH /api/api-keys/:identifier` (AIS-108).
 *
 * Every mutable field is optional (`undefined` = leave it, `null` = clear it)
 * and `updatedAt` is the **required** concurrency token, so the type itself
 * makes “update without a version” unrepresentable.
 */
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
