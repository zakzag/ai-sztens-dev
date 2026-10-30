import type { ApiKey, CreateApiKeyInput } from '@callback/shared';
import type { ApiKeyRow } from '../../../db/schema.js';

/**
 * Fixtures for the `api-keys` specs.
 *
 * Centralised here (coding standard: no fixtures inline in test files) so the
 * row shape stays in sync with `schema.ts` — if a column is added, only this
 * file needs updating and every spec keeps compiling with a meaningful default.
 *
 * The payload type comes from `@callback/shared` (`ApiKey`), not from a local
 * interface: the fixture is a value of the **contract** type, so a schema change
 * breaks this file first instead of silently diverging.
 */

/** Fixed UUID so assertions can compare without regex noise. */
export const API_KEY_ROW_ID = '3f8a1d2e-0000-4000-8000-00000000abcd';

/** Fixed creation timestamp (the mapper must emit exactly this as ISO). */
export const API_KEY_CREATED_AT = new Date('2026-10-21T10:00:00.000Z');

/** Fixed update timestamp. */
export const API_KEY_UPDATED_AT = new Date('2026-10-21T11:30:00.000Z');

/** Fixed expiry timestamp. */
export const API_KEY_EXPIRES_AT = new Date('2027-01-01T00:00:00.000Z');

/**
 * @param overrides - fields to replace on the default row.
 * @returns a complete `platform.api_keys` row.
 */
export function buildApiKeyRow(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: API_KEY_ROW_ID,
    name: 'Vapi prod',
    identifier: 'vapi-prod',
    description: 'primary',
    apiKey: 'tok_123',
    expiresAt: API_KEY_EXPIRES_AT,
    createdAt: API_KEY_CREATED_AT,
    updatedAt: API_KEY_UPDATED_AT,
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default payload.
 * @returns a payload matching {@link buildApiKeyRow}.
 */
export function buildApiKeyResponse(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: API_KEY_ROW_ID,
    name: 'Vapi prod',
    identifier: 'vapi-prod',
    description: 'primary',
    apiKey: 'tok_123',
    expiresAt: API_KEY_EXPIRES_AT.toISOString(),
    createdAt: API_KEY_CREATED_AT.toISOString(),
    updatedAt: API_KEY_UPDATED_AT.toISOString(),
    ...overrides,
  };
}

/**
 * @param overrides - fields to replace on the default create payload.
 * @returns a valid `POST /api/api-keys` body.
 */
export function buildCreateApiKeyInput(
  overrides: Partial<CreateApiKeyInput> = {},
): CreateApiKeyInput {
  return {
    name: 'Vapi prod',
    identifier: 'vapi-prod',
    description: 'primary',
    apiKey: 'tok_123',
    expiresAt: API_KEY_EXPIRES_AT.toISOString(),
    ...overrides,
  };
}
