import { createContext, useContext, useState, type ReactNode } from 'react';

const TOKEN_KEY = 'callback-admin-token';

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY),
  );

  function login(nextToken: string) {
    window.sessionStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }

  function logout() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: token !== null, login, logout }}>
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
