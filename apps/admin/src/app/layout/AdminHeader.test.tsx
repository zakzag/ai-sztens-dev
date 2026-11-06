/**
 * Tests of the sticky, two-band admin header.
 *
 * The header is props-driven (routes + the theme port), so the tests mount it
 * with the stub registry and assert the **contract**: sticky and fixed height
 * from the constants, brand on the left, actions on the right, navigation and
 * breadcrumb in the second band, and an inert settings button.
 */

import { BREADCRUMB_DEFAULT_ARIA_LABEL } from '@callback/ui';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../test/mocks/app-router.mock.js';
import {
  MOCK_DETAIL_LABEL,
  MOCK_ROUTE_ENTRIES,
} from '../../test/mocks/route-registry.mock.js';
import { APP_BRAND_LABEL, APP_NAV_LABEL } from '../app.const.js';
import { AdminHeader } from './AdminHeader.js';
import {
  ADMIN_HEADER_CRUMB_ROW_HEIGHT,
  ADMIN_HEADER_PADDING_X,
  ADMIN_HEADER_TOP_ROW_HEIGHT,
  ADMIN_HEADER_Z_INDEX,
  APP_USER_SETTINGS_ARIA_LABEL,
  THEME_OPTION_LIGHT,
  THEME_OPTION_LIGHT_LABEL,
  THEME_SELECTOR_LABEL,
} from './layout.const.js';

/**
 * Renders the header at the stub detail route, where the breadcrumb has two
 * crumbs and therefore renders a landmark.
 *
 * @returns the render result plus the `onThemeChange` spy.
 */
function renderHeader() {
  const onThemeChange = vi.fn();
  const result = renderWithRouter(
    <AdminHeader routes={MOCK_ROUTE_ENTRIES} onThemeChange={onThemeChange} />,
    { initialEntries: ['/detail'] },
  );

  return { ...result, onThemeChange };
}

/**
 * Reads the two band elements of the header.
 *
 * @returns the brand band and the navigation/breadcrumb band.
 */
function getBands(): readonly [HTMLElement, HTMLElement] {
  const header = screen.getByRole('banner');

  return [header.children[0] as HTMLElement, header.children[1] as HTMLElement];
}

describe('AdminHeader', () => {
  it('is sticky and stacks below every overlay', () => {
    renderHeader();

    expect(screen.getByRole('banner')).toHaveClass(
      'sticky',
      'top-0',
      ADMIN_HEADER_Z_INDEX,
    );
  });

  it('takes both band heights and the horizontal padding from the constants', () => {
    renderHeader();

    const [topBand, crumbBand] = getBands();

    expect(topBand).toHaveClass(ADMIN_HEADER_TOP_ROW_HEIGHT);
    expect(topBand).toHaveClass(ADMIN_HEADER_PADDING_X);
    expect(crumbBand).toHaveClass(ADMIN_HEADER_CRUMB_ROW_HEIGHT);
    expect(crumbBand).toHaveClass(ADMIN_HEADER_PADDING_X);
  });

  it('links the brand to the landing page', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: APP_BRAND_LABEL })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('puts the appearance selector and the settings button in the first band', () => {
    renderHeader();

    const [topBand] = getBands();

    expect(
      within(topBand).getByRole('combobox', { name: THEME_SELECTOR_LABEL }),
    ).toBeInTheDocument();
    expect(
      within(topBand).getByRole('button', {
        name: APP_USER_SETTINGS_ARIA_LABEL,
      }),
    ).toBeInTheDocument();
    expect(
      within(topBand).queryByRole('navigation', { name: APP_NAV_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('puts the navigation and the breadcrumb in the second band', () => {
    renderHeader();

    const [topBand, crumbBand] = getBands();

    expect(
      within(crumbBand).getByRole('navigation', { name: APP_NAV_LABEL }),
    ).toBeInTheDocument();
    expect(
      within(crumbBand).getByRole('navigation', {
        name: BREADCRUMB_DEFAULT_ARIA_LABEL,
      }),
    ).toBeInTheDocument();
    expect(
      within(topBand).queryByRole('navigation', {
        name: BREADCRUMB_DEFAULT_ARIA_LABEL,
      }),
    ).not.toBeInTheDocument();
  });

  it('renders the settings button without navigating anywhere', async () => {
    renderHeader();

    const settings = screen.getByRole('button', {
      name: APP_USER_SETTINGS_ARIA_LABEL,
    });

    await userEvent.click(settings);

    // The breadcrumb still describes the route the header was mounted at, so
    // the click did not cause a navigation (AIS-140 `D4`).
    const breadcrumb = screen.getByRole('navigation', {
      name: BREADCRUMB_DEFAULT_ARIA_LABEL,
    });

    expect(within(breadcrumb).getByText(MOCK_DETAIL_LABEL)).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: APP_USER_SETTINGS_ARIA_LABEL }),
    ).toBeInTheDocument();
  });

  it('forwards the picked appearance through the port', async () => {
    const { onThemeChange } = renderHeader();

    await userEvent.click(
      screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL }),
    );
    await userEvent.click(
      screen.getByRole('option', { name: THEME_OPTION_LIGHT_LABEL }),
    );

    expect(onThemeChange).toHaveBeenCalledWith(THEME_OPTION_LIGHT);
  });
});
