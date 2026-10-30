/**
 * The session state of the admin application.
 *
 * The shape is intentionally small: the `app/` layer only needs to know
 * whether a session exists and how to end it. Where the session comes from is
 * an implementation detail of the provider below — today it is the
 * `sessionStorage` token, and after AIS-74 it will be the cookie session.
 */
export interface SessionState {
  /** `true` when the user has a session. */
  readonly isAuthenticated: boolean;

  /** Ends the current session. */
  readonly logout: () => void;
}
