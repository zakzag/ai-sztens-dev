/**
 * Tests of the application shell.
 *
 * The layout is props-driven: it receives the routes and the page content, so
 * the test can mount it with the stub registry and a plain child.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  createMockSession,
  renderWithRouter,
} from '../../test/mocks/app-router.mock.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import {
  MOCK_HOME_LABEL,
  MOCK_ROUTE_ENTRIES,
} from '../../test/mocks/route-registry.mock.js';
import { APP_BRAND_LABEL, APP_NAV_LABEL } from '../app.const.js';
import { SessionContext } from '../providers/session-provider.js';
import { AdminLayout } from './AdminLayout.js';

describe('AdminLayout', () => {
  it('renders the brand as a link to the landing page', () => {
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('link', { name: APP_BRAND_LABEL })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('renders the navigation built from the routes', () => {
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(
      screen.getByRole('navigation', { name: APP_NAV_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: MOCK_HOME_LABEL }),
    ).toBeInTheDocument();
  });

  it('renders the page content inside the main landmark', () => {
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('renders the shell without a navigation entry when no route is linked', () => {
    renderWithRouter(
      <AdminLayout routes={[]}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(1);
  });

  it('mounts the notification host inside the shell', () => {
    // The host's collapsed log tab is the always-rendered half of the pair (the
    // toast region only exists while a card is on screen), so its absence would
    // mean no protected page ever shows a notification (AIS-84).
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('fails loudly when no notification provider is above it', () => {
    // Same contract as the session: the host is not optional, so a missing
    // provider must be a loud error instead of an invisible shell. Everything
    // *except* the notification provider is supplied, otherwise the session
    // error would fire first and hide the one under test.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      render(
        <TestQueryProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <SessionContext.Provider value={createMockSession()}>
              <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
                <p>page content</p>
              </AdminLayout>
            </SessionContext.Provider>
          </MemoryRouter>
        </TestQueryProvider>,
      ),
    ).toThrow(/NotificationProvider/);

    consoleError.mockRestore();
  });

  it('fails loudly when no session provider is above it', () => {
    // The layout reads the logout action from the session, so a missing
    // provider must be a loud error instead of a silently broken shell.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      render(
        <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
          <p>page content</p>
        </AdminLayout>,
      ),
    ).toThrow(/useRequireSession/);

    consoleError.mockRestore();
  });
});
