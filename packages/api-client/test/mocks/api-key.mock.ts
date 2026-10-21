/**
 * `ApiKey` fixtures shaped exactly like the AIS-40 wire contract.
 *
 * Shared by the service tests and the transport tests: an ISO 8601 timestamp
 * with a `Z` suffix, explicit `null`s for the optional columns, and a real
 * uuid for `id`.
 */

import type { ApiKey, CreateApiKeyInput } from '@callback/shared';

/** One valid response row. */
export const VALID_API_KEY: ApiKey = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: 'Production voice provider token',
  apiKey: 'sk-live-abcdef123456',
  expiresAt: '2027-01-31T23:00:00.000Z',
  createdAt: '2026-10-21T15:00:00.000Z',
  updatedAt: '2026-10-21T15:00:00.000Z',
};

/** A second row, so list tests can prove ordering is preserved. */
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

/** Full list payload as returned by `GET /api/api-keys` (newest first). */
export const VALID_API_KEY_LIST: readonly ApiKey[] = [
  VALID_API_KEY,
  SECOND_API_KEY,
];

/** A minimal, valid create payload. */
export const VALID_CREATE_INPUT: CreateApiKeyInput = {
  name: 'Vapi staging',
  identifier: 'vapi-staging',
  apiKey: 'sk-stage-42',
};
