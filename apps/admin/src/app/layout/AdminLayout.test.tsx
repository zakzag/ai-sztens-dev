/**
 * Tests of the application shell.
 *
 * The layout is props-driven: it receives the routes and the page content, so
 * the test can mount it with the stub registry and a plain child.
 */

import {
  BREADCRUMB_DEFAULT_ARIA_LABEL,
  LOG_DRAWER_CLOSE_LABEL,
  LOG_DRAWER_OPEN_LABEL,
} from '@callback/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  MOCK_DETAIL_LABEL,
  MOCK_HOME_LABEL,
  MOCK_HOME_PATH,
  MOCK_ROUTE_ENTRIES,
} from '../../test/mocks/route-registry.mock.js';
import { APP_BRAND_LABEL, APP_NAV_LABEL } from '../app.const.js';
import { SessionContext } from '../providers/session-provider.js';
import { AdminLayout } from './AdminLayout.js';
import {
  ADMIN_HEADER_CRUMB_ROW_HEIGHT,
  ADMIN_HEADER_PADDING_X,
  ADMIN_HEADER_TOP_ROW_HEIGHT,
} from './layout.const.js';

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

  it('renders a full-bleed main that shares the header padding', () => {
    // AIS-147 / AIS-140 `D2`: the centred `max-w-5xl` column was removed, so the
    // content starts at the same left edge as the header's own padding.
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    const main = screen.getByRole('main');

    expect(main).not.toHaveClass('max-w-5xl');
    expect(main).toHaveClass('w-full');
    expect(main).toHaveClass(ADMIN_HEADER_PADDING_X);
  });

  it('renders a sticky header', () => {
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0');
  });

  it('renders the shell without a navigation entry when no route is linked', () => {
    // One link is the brand. The nav has no entry and the breadcrumb has no
    // crumb at all — an empty registry cannot produce a trail, and the
    // primitive renders no landmark for an empty item list (AIS-145).
    renderWithRouter(
      <AdminLayout routes={[]}>
        <p>page content</p>
      </AdminLayout>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(1);
    expect(
      screen.queryByRole('navigation', { name: BREADCRUMB_DEFAULT_ARIA_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('renders the breadcrumb trail of the current route inside the header', () => {
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
      { initialEntries: ['/detail'] },
    );

    const breadcrumb = screen.getByRole('navigation', {
      name: BREADCRUMB_DEFAULT_ARIA_LABEL,
    });

    expect(
      within(breadcrumb).getByRole('link', { name: MOCK_HOME_LABEL }),
    ).toHaveAttribute('href', MOCK_HOME_PATH);
    expect(within(breadcrumb).getByText(MOCK_DETAIL_LABEL)).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(breadcrumb.closest('header')).toBeInTheDocument();
  });

  it('puts the breadcrumb in the second band, next to the navigation', () => {
    // AIS-147: the shell is two-banded — brand and actions on top, navigation
    // and breadcrumb below.
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
      { initialEntries: ['/detail'] },
    );

    const banner = screen.getByRole('banner');
    const topBand = banner.children[0] as HTMLElement;
    const crumbBand = banner.children[1] as HTMLElement;

    expect(topBand).toHaveClass(ADMIN_HEADER_TOP_ROW_HEIGHT);
    expect(crumbBand).toHaveClass(ADMIN_HEADER_CRUMB_ROW_HEIGHT);
    expect(
      within(crumbBand).getByRole('navigation', {
        name: BREADCRUMB_DEFAULT_ARIA_LABEL,
      }),
    ).toBeInTheDocument();
    expect(
      within(crumbBand).getByRole('navigation', { name: APP_NAV_LABEL }),
    ).toBeInTheDocument();
  });

  it('mounts the notification host inside the shell', () => {
    // The host's log drawer handle is the always-rendered half of the pair (the
    // toast region only exists while a card is on screen), so its absence would
    // mean no protected page ever shows a notification (AIS-84).
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    // Queried by name since AIS-147: the header's settings button makes an
    // unnamed `getByRole('button')` ambiguous.
    expect(
      screen.getByRole('button', { name: LOG_DRAWER_OPEN_LABEL }),
    ).toBeInTheDocument();
  });

  it('gives every protected page a working log drawer handle', async () => {
    // AIS-136: the handle must both open and close the panel, without a page
    // wiring anything.
    renderWithRouter(
      <AdminLayout routes={MOCK_ROUTE_ENTRIES}>
        <p>page content</p>
      </AdminLayout>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_OPEN_LABEL }),
    );

    expect(
      await screen.findByRole('button', { name: LOG_DRAWER_CLOSE_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_CLOSE_LABEL }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: LOG_DRAWER_OPEN_LABEL }),
      ).toBeInTheDocument();
    });
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
