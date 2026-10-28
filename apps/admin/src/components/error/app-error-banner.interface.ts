/**
 * Props of `AppErrorBanner` (plan `D11`, tier 3).
 *
 * The banner owns no state of its own and does not navigate on its own: the
 * only user-initiated transition — leaving the expired session — is injected, so
 * the layout shell keeps control over the session.
 */
export interface AppErrorBannerProps {
  /** Called when the user clicks the login CTA of the session-expired banner. */
  readonly onLogin: () => void;
}
