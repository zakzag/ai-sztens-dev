/**
 * The single owner of the admin session token.
 *
 * The token lives in `sessionStorage`, so it dies with the browser tab. Three
 * consumers exist and none of them may hard-code the storage key again:
 *
 * 1. `AuthContext` — writes on login, removes on logout;
 * 2. the composition root (`services/api-client.ts`) — reads it on every
 *    request through the injected `getToken` supplier;
 * 3. the tests — stub it via `src/test/mocks/**`.
 *
 * Every accessor is SSR/test safe: `window` is absent under Node, and the
 * accessors then behave as “no token” instead of throwing.
 */

/** `sessionStorage` key of the bearer token. */
export const SESSION_TOKEN_KEY = 'aisztens-admin-token';

/**
 * @returns the stored token, or `null` when absent (or outside a browser).
 */
export function readSessionToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Persists the token for the lifetime of the tab.
 *
 * @param token - the raw token, stored verbatim.
 */
export function storeSessionToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

/** Drops the stored token (logout). */
export function clearSessionToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
}
