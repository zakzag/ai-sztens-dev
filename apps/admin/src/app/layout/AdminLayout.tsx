import { Link } from 'react-router-dom';
import { AppErrorBanner } from '../../components/error/AppErrorBanner.js';
import { APP_BRAND_LABEL, APP_ROUTE_HOME_PATH } from '../app.const.js';
import { useSessionActions } from '../session/use-require-session.js';
import { AdminNav } from './AdminNav.js';
import type { AdminLayoutProps } from './admin-layout.interface.js';

/**
 * The shell of the authenticated admin application.
 *
 * It owns the frame — the header with the brand and the navigation, and the
 * `<main>` the routed page renders into — and nothing else. The navigation is
 * generated from the route registry, so a new page shows up in the nav without
 * touching this file (AIS-118, `D1`).
 *
 * The layout never decides whether the user is logged in: that decision belongs
 * to `ProtectedRoute`, which renders either the login page or this shell. The
 * only session-related thing the layout does is hand the logout action to the
 * app-level banner, whose "log in again" button triggers it.
 *
 * The tier-3 banner lives here because it expresses a condition that outlives
 * the page — offline, expired session, maintenance — and must survive
 * navigation (plan `D11`).
 *
 * @param props - see {@link AdminLayoutProps}.
 * @returns the application shell.
 */
export function AdminLayout({ routes, children }: AdminLayoutProps) {
  const { logout } = useSessionActions();

  return (
    <div className="flex min-h-screen flex-col">
      <AppErrorBanner onLogin={logout} />

      <header className="border-b border-border-hairline bg-surface-raised">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Link
            to={APP_ROUTE_HOME_PATH}
            className="text-lg font-semibold text-text-primary"
          >
            {APP_BRAND_LABEL}
          </Link>
          <AdminNav routes={routes} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
