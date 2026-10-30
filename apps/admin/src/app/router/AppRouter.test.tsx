/**
 * Tests of the router.
 *
 * The router is built from the registry, so the tests mount it with the stub
 * registry: the point is that the routes render where the registry says they
 * should, and that an unknown URL gets the not-found entry.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createMockSession,
  renderWithRouter,
} from '../../test/mocks/app-router.mock.js';
import {
  MOCK_DETAIL_PATH,
  MOCK_ROUTE_ENTRIES,
  MOCK_VISIBLE_ROUTE,
} from '../../test/mocks/route-registry.mock.js';
import type { RouteEntry } from './route-entry.interface.js';
import { AppRouter } from './AppRouter.js';

/** The public route used by the tests. */
const MOCK_PUBLIC_ROUTE: RouteEntry = {
  path: '/login',
  navLabel: null,
  element: <p>mock login</p>,
  protected: false,
};

/** The catch-all entry used by the tests. */
const MOCK_NOT_FOUND_ROUTE: RouteEntry = {
  path: '*',
  navLabel: null,
  element: <p>mock not found</p>,
  protected: true,
};

describe('AppRouter', () => {
  it('renders a public route outside the authenticated layout', () => {
    renderWithRouter(
      <AppRouter
        publicRoutes={[MOCK_PUBLIC_ROUTE]}
        protectedRoutes={MOCK_ROUTE_ENTRIES}
        notFoundRoute={MOCK_NOT_FOUND_ROUTE}
      />,
      { initialEntries: ['/login'] },
    );

    expect(screen.getByText('mock login')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders a protected route inside the authenticated layout', () => {
    renderWithRouter(
      <AppRouter
        publicRoutes={[MOCK_PUBLIC_ROUTE]}
        protectedRoutes={MOCK_ROUTE_ENTRIES}
        notFoundRoute={MOCK_NOT_FOUND_ROUTE}
      />,
      { initialEntries: [MOCK_VISIBLE_ROUTE.path] },
    );

    expect(screen.getByText('mock home')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders the not-found entry for an unknown URL', () => {
    renderWithRouter(
      <AppRouter
        publicRoutes={[MOCK_PUBLIC_ROUTE]}
        protectedRoutes={MOCK_ROUTE_ENTRIES}
        notFoundRoute={MOCK_NOT_FOUND_ROUTE}
      />,
      { initialEntries: ['/no-such-page'] },
    );

    expect(screen.getByText('mock not found')).toBeInTheDocument();
  });

  it('shows the login page instead of the layout when there is no session', () => {
    renderWithRouter(
      <AppRouter
        publicRoutes={[MOCK_PUBLIC_ROUTE]}
        protectedRoutes={MOCK_ROUTE_ENTRIES}
        notFoundRoute={MOCK_NOT_FOUND_ROUTE}
      />,
      {
        initialEntries: [MOCK_DETAIL_PATH],
        session: createMockSession({ isAuthenticated: false }),
      },
    );

    expect(
      screen.getByRole('heading', { name: 'Bejelentkezés' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
