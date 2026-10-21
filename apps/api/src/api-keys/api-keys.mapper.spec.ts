import { toApiKeyResponse, toNewApiKeyRow } from './api-keys.mapper.js';
import {
  API_KEY_CREATED_AT,
  API_KEY_EXPIRES_AT,
  API_KEY_ROW_ID,
  API_KEY_UPDATED_AT,
  buildApiKeyRow,
  buildCreateApiKeyInput,
} from './test/mocks/api-keys.mock.js';

/**
 * Unit tests for the pure mappers.
 *
 * The two behaviours worth guarding are the timestamp conversion (wire = ISO
 * 8601 string, row = `Date`) and the "absent becomes explicit `null`" rule
 * (plan D8), because both are invisible at runtime until a client parses the
 * payload.
 */

describe('toApiKeyResponse', () => {
  it('converts every timestamp to an ISO 8601 string', () => {
    const response = toApiKeyResponse(buildApiKeyRow());

    expect(response.createdAt).toBe(API_KEY_CREATED_AT.toISOString());
    expect(response.updatedAt).toBe(API_KEY_UPDATED_AT.toISOString());
    expect(response.expiresAt).toBe(API_KEY_EXPIRES_AT.toISOString());
  });

  it('keeps a null expiry as null', () => {
    const response = toApiKeyResponse(buildApiKeyRow({ expiresAt: null }));

    expect(response.expiresAt).toBeNull();
  });

  it('keeps a null description as null', () => {
    const response = toApiKeyResponse(buildApiKeyRow({ description: null }));

    expect(response.description).toBeNull();
  });

  it('copies the remaining columns unchanged', () => {
    const row = buildApiKeyRow();

    expect(toApiKeyResponse(row)).toMatchObject({
      id: API_KEY_ROW_ID,
      name: row.name,
      identifier: row.identifier,
      apiKey: row.apiKey,
    });
  });
});

describe('toNewApiKeyRow', () => {
  it('parses the ISO expiry string into a Date', () => {
    const row = toNewApiKeyRow(buildCreateApiKeyInput());

    expect(row.expiresAt).toBeInstanceOf(Date);
    expect(row.expiresAt?.toISOString()).toBe(API_KEY_EXPIRES_AT.toISOString());
  });

  it('stores an omitted expiry as null', () => {
    const row = toNewApiKeyRow(
      buildCreateApiKeyInput({ expiresAt: undefined }),
    );

    expect(row.expiresAt).toBeNull();
  });

  it('stores an omitted description as null', () => {
    const row = toNewApiKeyRow(
      buildCreateApiKeyInput({ description: undefined }),
    );

    expect(row.description).toBeNull();
  });

  it('does not rewrite the provided values', () => {
    const input = buildCreateApiKeyInput({
      name: '  padded name  ',
      identifier: 'vapi-prod',
      apiKey: ' tok_padded ',
    });

    const row = toNewApiKeyRow(input);

    expect(row.name).toBe('  padded name  ');
    expect(row.apiKey).toBe(' tok_padded ');
    expect(row.identifier).toBe('vapi-prod');
  });
});
