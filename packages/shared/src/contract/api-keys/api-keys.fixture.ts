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

/**
 * A fully filled row — the “filled” branch the admin UI exercises.
 *
 * Derived from {@link VALID_API_KEY} so the shared identity (id, createdAt,
 * updatedAt) stays defined once; only the optional fields become present.
 */
export const FILLED_API_KEY: ApiKey = {
  ...VALID_API_KEY,
  description: 'Production voice provider token',
  expiresAt: '2027-01-31T23:00:00.000Z',
};

/** A second row with the optional fields missing, for the empty-value branch. */
export const SECOND_API_KEY: ApiKey = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Vapi dev',
  identifier: 'vapi-dev',
  description: null,
  apiKey: 'sk-test-987654',
  expiresAt: null,
  createdAt: '2026-10-20T09:30:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
};

/**
 * Two-element list used by the admin test handlers and display tests: it
 * carries one row for the filled branch and one for the empty-value branch.
 */
export const VALID_API_KEY_PAIR: readonly ApiKey[] = [
  FILLED_API_KEY,
  SECOND_API_KEY,
];
