/**
 * Types of the `api-keys` contract, derived from the zod schemas.
 *
 * Derived rather than hand-written: a schema change must not be able to drift
 * away from the type. Consumers (`packages/api-client`, the admin page) import
 * these aliases, never `z.infer` at the call site.
 */

import type { z } from 'zod';
import type { apiKeySchema, createApiKeySchema } from './api-keys.schema.js';

/** A single stored API key as returned by the API. */
export type ApiKey = z.infer<typeof apiKeySchema>;

/** Payload of `POST /api/api-keys`. */
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
