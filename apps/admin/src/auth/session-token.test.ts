/**
 * Tests of the session-token accessors.
 *
 * `AuthContext` and the API client both depend on this module, so the contract
 * asserted here (key name, “absent means null”, clear removes) is what keeps the
 * `Authorization` header and the login state in sync.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSessionToken,
  readSessionToken,
  SESSION_TOKEN_KEY,
  storeSessionToken,
} from './session-token.js';

describe('session token accessors', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('uses the historical storage key', () => {
    expect(SESSION_TOKEN_KEY).toBe('aisztens-admin-token');
  });

  it('returns null when nothing is stored', () => {
    expect(readSessionToken()).toBeNull();
  });

  it('stores and reads the token verbatim', () => {
    storeSessionToken('token-123');

    expect(readSessionToken()).toBe('token-123');
    expect(window.sessionStorage.getItem(SESSION_TOKEN_KEY)).toBe('token-123');
  });

  it('overwrites a previously stored token', () => {
    storeSessionToken('first');
    storeSessionToken('second');

    expect(readSessionToken()).toBe('second');
  });

  it('removes the token on clear', () => {
    storeSessionToken('token-123');
    clearSessionToken();

    expect(readSessionToken()).toBeNull();
  });
});
