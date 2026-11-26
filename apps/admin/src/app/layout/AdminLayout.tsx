import { NotificationHost } from '@callback/notifications/react';
import { AppErrorBanner } from '../../components/error/AppErrorBanner.js';
import { useSessionActions } from '../session/use-require-session.js';
import { useTheme } from '../theme/use-theme.js';
import { AdminHeader } from './AdminHeader.js';
import { ADMIN_HEADER_PADDING_X } from './layout.const.js';
import type { AdminLayoutProps } from './admin-layout.interface.js';

/**
 * The shell of the authenticated admin application.
 *
 * It owns the frame — the sticky [`AdminHeader`](./AdminHeader.tsx:1) and the
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
 * navigation (plan `D11`). It is deliberately **not** sticky and sits **above**
 * the header, so scrolling moves it out of the view: the header is permanent,
 * the banner is a condition (AIS-140 `D7`).
 *
 * `<main>` is full bleed — `w-full` plus the header's own horizontal padding,
 * no `max-w-*` — because the header spans the whole viewport and a centred,
 * narrower content column would break that alignment (AIS-140 `D2`).
 *
 * The shell reads the theme context (AIS-167) and is therefore **not** optional
 * to wrap in `<ThemeProvider>`: the login page is themed too, which is why the
 * provider sits in the app provider chain rather than around this component.
 *
 * `<NotificationHost />` is mounted here for the same reason as the banner: the
 * toast stack and the log drawer belong to the authenticated shell, so they
 * survive navigation and appear on every protected page without a page ever
 * rendering them (AIS-84). The public routes (the login page) deliberately have
 * no host — there is nothing to report before a session exists, and a stray
 * toast over the login form would be noise.
 *
 * @param props - see {@link AdminLayoutProps}.
 * @returns the application shell.
 */
export function AdminLayout({ routes, children }: AdminLayoutProps) {
  const { logout } = useSessionActions();

  /**
   * The applied appearance and its setter (AIS-167).
   *
   * The shell — not the header and not the selector — is the one place that
   * knows the appearance is real: it hands the current value down as a prop and
   * the provider's setter as the selector's port, so the two components stay
   * props-driven and a test can mount either of them without a provider.
   */
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col">
      <AppErrorBanner onLogin={logout} />

      <AdminHeader routes={routes} theme={theme} onThemeChange={setTheme} />

      <main className={`w-full flex-1 ${ADMIN_HEADER_PADDING_X} py-8`}>
        {children}
      </main>

      <NotificationHost />
    </div>
  );
}
