/**
 * Tests of the breadcrumb region of the shell (AIS-146).
 *
 * The component is mounted in the **same** route context as the layout — inside
 * `<Route path="/*">` — because that context is exactly what makes the params
 * unavailable through `useParams()` (decision `D4`). A test that mounts it
 * anywhere else would not prove the fix.
 */

import { BREADCRUMB_DEFAULT_ARIA_LABEL } from '@callback/ui';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  MOCK_CRUMB_LIST_LABEL,
  MOCK_CRUMB_LIST_PATH,
  MOCK_CRUMB_ROOT_LABEL,
  MOCK_CRUMB_ROOT_PATH,
  MOCK_CRUMB_ROUTES,
} from '../../test/mocks/breadcrumb-routes.mock.js';
import { renderWithRouter } from '../../test/mocks/app-router.mock.js';
import { AppBreadcrumb } from './AppBreadcrumb.js';

/**
 * Renders the breadcrumb in the layout's route context.
 *
 * @param pathname - the URL the memory router starts at.
 * @returns the testing-library render result.
 */
function renderBreadcrumb(pathname: string) {
  return renderWithRouter(
    <Routes>
      <Route path="/*" element={<AppBreadcrumb routes={MOCK_CRUMB_ROUTES} />} />
    </Routes>,
    { initialEntries: [pathname] },
  );
}

/**
 * @returns the breadcrumb navigation landmark.
 */
function breadcrumbNav(): HTMLElement {
  return screen.getByRole('navigation', { name: BREADCRUMB_DEFAULT_ARIA_LABEL });
}

describe('AppBreadcrumb', () => {
  it('renders the trail of a static path with router links', () => {
    renderBreadcrumb(MOCK_CRUMB_LIST_PATH);

    const nav = breadcrumbNav();

    expect(within(nav).getByRole('link', { name: MOCK_CRUMB_ROOT_LABEL })).toHaveAttribute(
      'href',
      MOCK_CRUMB_ROOT_PATH,
    );
    expect(within(nav).getByText(MOCK_CRUMB_LIST_LABEL)).toBeInTheDocument();
  });

  it('shows the identifier of a dynamic route', () => {
    // The proof of `D4`: inside the `/*` route the splat is the only router
    // param, so this crumb can only come from the matched pattern.
    renderBreadcrumb('/api-keys/abc123');

    expect(within(breadcrumbNav()).getByText('abc123')).toBeInTheDocument();
  });

  it('links the list crumb to the list route on a detail page', () => {
    renderBreadcrumb('/api-keys/abc123');

    expect(
      within(breadcrumbNav()).getByRole('link', { name: MOCK_CRUMB_LIST_LABEL }),
    ).toHaveAttribute('href', MOCK_CRUMB_LIST_PATH);
  });

  it('marks the last crumb as the current page and renders it as text', () => {
    renderBreadcrumb('/api-keys/abc123');

    const current = within(breadcrumbNav()).getByText('abc123');

    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).not.toHaveAttribute('href');
  });

  it('renders no navigation landmark for an unknown path', () => {
    renderBreadcrumb('/nope');

    expect(
      screen.queryByRole('navigation', { name: BREADCRUMB_DEFAULT_ARIA_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('navigates in-app when a crumb link is used', async () => {
    renderBreadcrumb('/api-keys/abc123');

    await userEvent.click(
      within(breadcrumbNav()).getByRole('link', { name: MOCK_CRUMB_ROOT_LABEL }),
    );

    const nav = breadcrumbNav();

    expect(within(nav).getByText(MOCK_CRUMB_ROOT_LABEL)).toBeInTheDocument();
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
  });
});
