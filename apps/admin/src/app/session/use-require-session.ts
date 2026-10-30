import { useContext } from 'react';
import { SessionContext } from '../providers/session-provider.js';
import type { SessionState } from './session.interface.js';

/**
 * The session state of the admin application.
 *
 * The `app/` layer talks to the session **only** through this hook, never
 * through the storage adapter directly. That is what makes the migration to the
 * cookie session (AIS-74) a one-file change: the provider swaps its
 * implementation, and the router, the layout and the nav keep working
 * unchanged.
 *
 * @returns the current session state.
 * @throws when called outside the session provider.
 */
export function useRequireSession(): SessionState {
  const session = useContext(SessionContext);

  if (session === null) {
    throw new Error('useRequireSession must be used inside <SessionProvider>');
  }

  return session;
}

/**
 * The actions of the session, without the state.
 *
 * The layout needs the logout action only (to hand it to the app-level
 * banner); the router needs the whole state. Splitting the two keeps the
 * dependencies of each component explicit.
 *
 * @returns the logout action.
 */
export function useSessionActions(): Pick<SessionState, 'logout'> {
  const { logout } = useRequireSession();

  return { logout };
}
