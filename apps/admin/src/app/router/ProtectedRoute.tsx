import type { ReactNode } from 'react';
import { LoginPage } from '../../pages/LoginPage.js';
import { useRequireSession } from '../session/use-require-session.js';

/** Props of {@link ProtectedRoute}. */
export interface ProtectedRouteProps {
  /** The protected content. */
  readonly children: ReactNode;
}

/**
 * The guard of the authenticated part of the application.
 *
 * It makes exactly one decision: is there a session? If yes, the children (the
 * layout shell and the routed page) render; if not, the login page does.
 *
 * The session is read through `useRequireSession()`, never from the storage
 * directly, so switching to the cookie session (AIS-74) does not touch this
 * component.
 *
 * @param props - see {@link ProtectedRouteProps}.
 * @returns the protected content, or the login page.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useRequireSession();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoginPage />
      </div>
    );
  }

  return children;
}
