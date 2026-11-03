/**
 * `ApiKey` fixtures shaped exactly like the AIS-40 wire contract.
 *
 * Shared by the service tests and the transport tests: an ISO 8601 timestamp
 * with a `Z` suffix, explicit `null`s for the optional columns, and a real
 * uuid for `id`.
 */

import type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '@callback/shared';

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

/**
 * A valid `PATCH /api/api-keys/:identifier` body (AIS-108/AIS-110).
 *
 * `updatedAt` repeats {@link VALID_API_KEY}'s version on purpose: the body is
 * what a client sends *after* reading that row, and the two values belonging
 * together is the whole point of the concurrency token. `description: null` is
 * the “clear it” half of the `undefined` / `null` rule, so the test can prove
 * the wire body keeps the explicit `null` instead of dropping the key.
 */
export const VALID_UPDATE_INPUT: UpdateApiKeyInput = {
  name: 'Vapi production',
  description: null,
  updatedAt: VALID_API_KEY.updatedAt,
};

/**
 * The version the server reports after a successful `update`.
 *
 * Different from {@link VALID_API_KEY.updatedAt} so a test can tell the patched
 * row from the row that was read.
 */
export const UPDATED_API_KEY: ApiKey = {
  ...VALID_API_KEY,
  name: 'Vapi production',
  description: null,
  updatedAt: '2026-11-03T15:00:00.000Z',
};
