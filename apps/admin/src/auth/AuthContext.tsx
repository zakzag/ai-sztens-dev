import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  clearSessionToken,
  readSessionToken,
  storeSessionToken,
} from './session-token.js';

/**
 * Session state of the admin SPA.
 *
 * The token itself is owned by [`session-token.ts`](./session-token.ts): this
 * provider only mirrors it into React state so a login/logout re-renders the
 * tree. The storage key must not be repeated here — the composition root reads
 * the same token through `readSessionToken()` for the `Authorization` header.
 */
interface AuthContextValue {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readSessionToken());

  function login(nextToken: string) {
    storeSessionToken(nextToken);
    setToken(nextToken);
  }

  function logout() {
    clearSessionToken();
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: token !== null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
