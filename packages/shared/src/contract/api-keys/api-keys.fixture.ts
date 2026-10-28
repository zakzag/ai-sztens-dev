/**
 * Sample payloads of the `api-keys` contract (AIS-98).
 *
 * One value, two consumers: the registry entries put it in the generated OpenAPI
 * document as the `example` of their success response, and the shared registry
 * test parses the *same* object with the response schemas. Writing a second
 * sample in the test would let the documented example drift away from the
 * schema it is supposed to illustrate.
 *
 * Deliberately a typed value, not a schema: if `apiKeySchema` gains a field, the
 * compile error appears here instead of in the generated spec.
 */

import type { ApiKey } from './api-keys.interface.js';

/** A realistic single key; every `api-keys` response schema accepts it. */
export const VALID_API_KEY: ApiKey = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: null,
  apiKey: 'sk-live-abcdef123456',
  expiresAt: null,
  createdAt: '2026-10-21T15:00:00.000Z',
  updatedAt: '2026-10-21T15:00:00.000Z',
};

/** Payload example of `GET /api/api-keys` (a one-element list). */
export const VALID_API_KEY_LIST: readonly ApiKey[] = [VALID_API_KEY];
