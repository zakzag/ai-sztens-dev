import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from '../src/components/breadcrumb/Breadcrumb.js';
import {
  BREADCRUMB_CURRENT_CLASSES,
  BREADCRUMB_DEFAULT_ARIA_LABEL,
  BREADCRUMB_LINK_CLASSES,
} from '../src/components/breadcrumb/breadcrumb.const.js';
import { AXE_JSDOM_OPTIONS } from './mocks/axe-options.mock.js';
import {
  BREADCRUMB_MIDDLE_WITHOUT_TO,
  BREADCRUMB_SINGLE_ITEM,
  BREADCRUMB_THREE_ITEMS,
} from './mocks/breadcrumb-items.mock.js';
import {
  BREADCRUMB_MOCK_LINK_TEST_ID,
  createBreadcrumbLinkRendererMock,
} from './mocks/breadcrumb-link-renderer.mock.js';

/** Every separator cell the component rendered. */
function querySeparators(): Element[] {
  return Array.from(document.querySelectorAll('li[aria-hidden="true"]'));
}

describe('Breadcrumb', () => {
  it('omits the nav landmark when there is no crumb', () => {
    const { container } = render(<Breadcrumb items={[]} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the only crumb as the current page and renders no link', () => {
    render(<Breadcrumb items={BREADCRUMB_SINGLE_ITEM} />);

    const currentNode = screen.getByText('Áttekintés');

    expect(currentNode).toHaveAttribute('aria-current', 'page');
    expect(currentNode.tagName).toBe('SPAN');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders the trail in input order with a single current page', () => {
    render(<Breadcrumb items={BREADCRUMB_THREE_ITEMS} />);

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/api-keys');
    expect(links[0].textContent).toBe('Kezdőlap');
    expect(links[1].textContent).toBe('API kulcsok');

    const currentNodes = document.querySelectorAll('[aria-current="page"]');

    expect(currentNodes).toHaveLength(1);
    expect(currentNodes[0].textContent).toBe('Szerkesztés');
  });

  it('delegates every non-current crumb to the injected renderer', () => {
    const { renderLink, calls } = createBreadcrumbLinkRendererMock();

    render(
      <Breadcrumb items={BREADCRUMB_THREE_ITEMS} renderLink={renderLink} />,
    );

    expect(calls.map((call) => call.to)).toEqual(['/', '/api-keys']);
    expect(screen.getAllByTestId(BREADCRUMB_MOCK_LINK_TEST_ID)).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Szerkesztés' })).toBeNull();
  });

  it('renders a crumb without a target as plain text, not as a dead link', () => {
    render(<Breadcrumb items={BREADCRUMB_MIDDLE_WITHOUT_TO} />);

    const staticCrumb = screen.getByText('Beállítások');

    expect(staticCrumb.tagName).toBe('SPAN');
    expect(staticCrumb).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders one hidden separator between every pair of crumbs', () => {
    render(<Breadcrumb items={BREADCRUMB_THREE_ITEMS} />);

    const separators = querySeparators();

    expect(separators).toHaveLength(BREADCRUMB_THREE_ITEMS.length - 1);
    expect(separators.every((cell) => cell.tagName === 'LI')).toBe(true);
    expect(separators.every((cell) => cell.textContent === '')).toBe(true);
    expect(screen.getByRole('navigation')).toHaveAccessibleName(
      BREADCRUMB_DEFAULT_ARIA_LABEL,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(
      BREADCRUMB_THREE_ITEMS.length,
    );
  });

  it('uses the default accessible name and lets the caller override it', () => {
    const { unmount } = render(<Breadcrumb items={BREADCRUMB_SINGLE_ITEM} />);

    expect(screen.getByRole('navigation')).toHaveAccessibleName(
      BREADCRUMB_DEFAULT_ARIA_LABEL,
    );

    unmount();

    render(
      <Breadcrumb items={BREADCRUMB_SINGLE_ITEM} ariaLabel="You are here" />,
    );

    expect(screen.getByRole('navigation')).toHaveAccessibleName('You are here');
    expect(
      screen.queryByRole('navigation', { name: BREADCRUMB_DEFAULT_ARIA_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('passes axe and never exposes the current crumb as a link', async () => {
    render(<Breadcrumb items={BREADCRUMB_THREE_ITEMS} />);

    const results = await axe(document.body, AXE_JSDOM_OPTIONS);

    expect(results.violations).toEqual([]);

    const currentCrumb = document.querySelector('[aria-current="page"]');

    expect(currentCrumb).not.toHaveAttribute('role');
    expect(currentCrumb).not.toHaveAttribute('href');
  });

  it('paints the trail with token classes only', () => {
    render(<Breadcrumb items={BREADCRUMB_THREE_ITEMS} />);

    const link = screen.getAllByRole('link')[0];

    expect(link.className).toBe(BREADCRUMB_LINK_CLASSES);
    expect(link.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(link.className).not.toMatch(
      /(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-\d{2,3}/,
    );
    expect(screen.getByText('Szerkesztés').className).toBe(
      BREADCRUMB_CURRENT_CLASSES,
    );
  });
});
