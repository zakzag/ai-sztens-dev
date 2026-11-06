import { NotificationHost } from '@callback/notifications/react';
import { AppErrorBanner } from '../../components/error/AppErrorBanner.js';
import { useSessionActions } from '../session/use-require-session.js';
import { AdminHeader } from './AdminHeader.js';
import { ADMIN_HEADER_PADDING_X } from './layout.const.js';
import type { AdminLayoutProps } from './admin-layout.interface.js';

/**
 * Handler the shell gives the appearance selector.
 *
 * It is **intentionally empty** and takes no argument: AIS-147 ships the
 * selector's UI contract, not the theme implementation. Applying a theme means
 * `[data-theme]` token overrides, `color-scheme`, persistence and a flash-free
 * boot — a separate story (AIS-140 `D3`). Declared at module scope so the
 * identity is stable and no re-render is ever caused by it; a zero-parameter
 * function is still a legal `(value: ThemeOption) => void` port.
 */
const NOOP_THEME_CHANGE = (): void => {
  // Deliberately empty, see the doc comment above.
};

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

  return (
    <div className="flex min-h-screen flex-col">
      <AppErrorBanner onLogin={logout} />

      <AdminHeader routes={routes} onThemeChange={NOOP_THEME_CHANGE} />

      <main className={`w-full flex-1 ${ADMIN_HEADER_PADDING_X} py-8`}>
        {children}
      </main>

      <NotificationHost />
    </div>
  );
}
