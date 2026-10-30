/**
 * Tests of the navigation.
 *
 * The nav is generated from the route registry, so the tests use the stub
 * registry from `src/test/mocks/`: a labelled route, a second labelled route,
 * an unlabelled one and a hidden one.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MOCK_DETAIL_LABEL,
  MOCK_HOME_LABEL,
  MOCK_ROUTE_ENTRIES,
  MOCK_VISIBLE_ROUTE,
} from '../../test/mocks/route-registry.mock.js';
import { renderWithRouter } from '../../test/mocks/app-router.mock.js';
import { APP_NAV_LABEL } from '../app.const.js';
import { AdminNav } from './AdminNav.js';

describe('AdminNav', () => {
  it('renders a navigation landmark', () => {
    renderWithRouter(<AdminNav routes={MOCK_ROUTE_ENTRIES} />);

    expect(
      screen.getByRole('navigation', { name: APP_NAV_LABEL }),
    ).toBeInTheDocument();
  });

  it('links every route that carries a label', () => {
    renderWithRouter(<AdminNav routes={MOCK_ROUTE_ENTRIES} />);

    expect(screen.getByRole('link', { name: MOCK_HOME_LABEL })).toHaveAttribute(
      'href',
      MOCK_VISIBLE_ROUTE.path,
    );
    expect(
      screen.getByRole('link', { name: MOCK_DETAIL_LABEL }),
    ).toBeInTheDocument();
  });

  it('does not link a route without a label', () => {
    renderWithRouter(<AdminNav routes={MOCK_ROUTE_ENTRIES} />);

    expect(
      screen.queryByRole('link', { name: 'Rejtett' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('marks the active route with aria-current', () => {
    renderWithRouter(<AdminNav routes={MOCK_ROUTE_ENTRIES} />, {
      initialEntries: [MOCK_VISIBLE_ROUTE.path],
    });

    expect(screen.getByRole('link', { name: MOCK_HOME_LABEL })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: MOCK_DETAIL_LABEL }),
    ).not.toHaveAttribute('aria-current');
  });

  it('renders an empty navigation when no route is linked', () => {
    renderWithRouter(<AdminNav routes={[]} />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
