import {
  toApiKeyPatch,
  toApiKeyResponse,
  toNewApiKeyRow,
} from './api-keys.mapper.js';
import {
  API_KEY_CREATED_AT,
  API_KEY_EXPIRES_AT,
  API_KEY_ROW_ID,
  API_KEY_UPDATED_AT,
  buildApiKeyRow,
  buildCreateApiKeyInput,
  buildUpdateApiKeyInput,
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

describe('toApiKeyPatch', () => {
  it('keeps omitted keys absent instead of writing null', () => {
    // `undefined` must survive as *absence*: writing `null` would clear a
    // column the client never mentioned.
    const patch = toApiKeyPatch(buildUpdateApiKeyInput());

    expect(patch).toEqual({ name: 'Vapi production' });
    expect('description' in patch).toBe(false);
    expect('expiresAt' in patch).toBe(false);
    expect('apiKey' in patch).toBe(false);
  });

  it('produces an empty patch when only the token is sent', () => {
    const patch = toApiKeyPatch({
      updatedAt: API_KEY_UPDATED_AT.toISOString(),
    });

    expect(patch).toEqual({});
  });

  it('passes an explicit null description through so it clears the column', () => {
    const patch = toApiKeyPatch(buildUpdateApiKeyInput({ description: null }));

    expect(patch.description).toBeNull();
    expect('description' in patch).toBe(true);
  });

  it('keeps an explicit description', () => {
    const patch = toApiKeyPatch(
      buildUpdateApiKeyInput({ description: 'rotated' }),
    );

    expect(patch.description).toBe('rotated');
  });

  it('parses an ISO expiry string into a Date', () => {
    const patch = toApiKeyPatch(
      buildUpdateApiKeyInput({
        expiresAt: API_KEY_EXPIRES_AT.toISOString(),
      }),
    );

    expect(patch.expiresAt).toBeInstanceOf(Date);
    expect(patch.expiresAt?.toISOString()).toBe(
      API_KEY_EXPIRES_AT.toISOString(),
    );
  });

  it('keeps an explicit null expiry as null', () => {
    const patch = toApiKeyPatch(buildUpdateApiKeyInput({ expiresAt: null }));

    expect(patch.expiresAt).toBeNull();
  });

  it('never puts updatedAt in the patch (the database owns it)', () => {
    const patch = toApiKeyPatch(buildUpdateApiKeyInput());

    // The token is compared, never written: writing it would defeat the guard.
    expect('updatedAt' in patch).toBe(false);
  });

  it('never puts identifier or other server-managed columns in the patch', () => {
    const patch = toApiKeyPatch(
      buildUpdateApiKeyInput({
        name: 'n',
        description: 'd',
        apiKey: 'k',
        expiresAt: API_KEY_EXPIRES_AT.toISOString(),
      }),
    );

    expect(Object.keys(patch).sort()).toEqual([
      'apiKey',
      'description',
      'expiresAt',
      'name',
    ]);
  });

  it('maps every writable field at once', () => {
    const patch = toApiKeyPatch(
      buildUpdateApiKeyInput({
        name: 'renamed',
        description: 'note',
        apiKey: 'tok_new',
        expiresAt: API_KEY_EXPIRES_AT.toISOString(),
      }),
    );

    expect(patch).toEqual({
      name: 'renamed',
      description: 'note',
      apiKey: 'tok_new',
      expiresAt: API_KEY_EXPIRES_AT,
    });
  });
});
