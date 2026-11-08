/**
 * Behaviour of the landing page (`/`) (AIS-174).
 *
 * Two things are asserted, and both are regressions the page can suffer without
 * any test noticing otherwise:
 *
 * 1. the title reaches the DOM as the page's **single `h1`** — i.e. it is an
 *    argument of `PageShell`, not a hand-written heading;
 * 2. the deploy footer still renders **inside** the shell — a `PageShell`
 *    refactor that forgets `children` would silently drop the only element that
 *    tells an operator which revision is being served.
 */

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/mocks/render-with-providers.js';
import {
  PLACEHOLDER_PAGE_SUBTITLE,
  PLACEHOLDER_PAGE_TITLE,
  PlaceholderPage,
} from './PlaceholderPage.js';

describe('PlaceholderPage', () => {
  it('renders the page title as the only h1', () => {
    renderWithProviders(<PlaceholderPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      PLACEHOLDER_PAGE_TITLE,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the subtitle under the title', () => {
    renderWithProviders(<PlaceholderPage />);

    expect(screen.getByText(PLACEHOLDER_PAGE_SUBTITLE)).toBeInTheDocument();
  });

  it('renders the build info footer inside the page shell', () => {
    renderWithProviders(<PlaceholderPage />);

    const footer = screen.getByTestId('build-info');
    const shell = screen.getByRole('heading', { level: 1 }).closest('section');

    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent('Telepítve');
    expect(shell).not.toBeNull();
    expect(within(shell as HTMLElement).getByTestId('build-info')).toBe(footer);
  });
});
