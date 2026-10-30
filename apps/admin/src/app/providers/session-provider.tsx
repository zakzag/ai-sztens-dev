import { createContext, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '../../auth/AuthContext.js';
import type { SessionState } from '../session/session.interface.js';

/**
 * The session context of the `app/` layer.
 *
 * `null` means "no provider above me" — the hook turns that into a loud error
 * instead of a silent default, so a missing provider cannot look like a logged
 * out user.
 */
export const SessionContext = createContext<SessionState | null>(null);

/**
 * Bridges the existing auth context into the `app/` layer's session shape.
 *
 * This is the **only** place where the `app/` layer touches the session
 * implementation. Today the session is the `sessionStorage` token owned by
 * `auth/AuthContext.tsx`; after AIS-74 it becomes the cookie session. Either
 * way only this file changes — the router, the layout and the nav talk to
 * `useRequireSession()` and never to the storage.
 */
function SessionStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();

  return (
    <SessionContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Provides the session to the `app/` layer.
 *
 * It wraps the existing `AuthProvider` so the whole chain stays in one place:
 * the app layer sees only the session context, and the storage adapter stays
 * an implementation detail.
 *
 * @param props - the children to render.
 * @returns the children, wrapped in the session context.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SessionStateProvider>{children}</SessionStateProvider>
    </AuthProvider>
  );
}
