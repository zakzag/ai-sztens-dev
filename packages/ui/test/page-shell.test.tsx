import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { PageShell } from '../src/components/page-shell/PageShell.js';
import { AXE_JSDOM_OPTIONS } from './mocks/axe-options.mock.js';
import {
  PAGE_SHELL_ACTION_LABEL,
  PAGE_SHELL_ACTION_TEST_ID,
  PAGE_SHELL_BACK_LABEL,
  PAGE_SHELL_BACK_TEST_ID,
  PageShellActionsSlot,
  PageShellBackSlot,
} from './mocks/page-shell-slots.mock.js';

const TITLE = 'API kulcsok';
const SUBTITLE = 'A külső szolgáltatók hozzáférési kulcsai.';
const CONTENT = 'Tartalom';

/**
 * Reports whether `first` precedes `second` in document order.
 *
 * @param first - the element expected to come first.
 * @param second - the element expected to come second.
 * @returns `true` when `first` is followed by `second` in the DOM.
 */
function precedes(first: Element, second: Element): boolean {
  const relation = first.compareDocumentPosition(second);

  return (relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('PageShell', () => {
  it('renders the title as the single level-one heading', () => {
    render(<PageShell title={TITLE}>{CONTENT}</PageShell>);

    expect(
      screen.getByRole('heading', { level: 1, name: TITLE }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the subtitle when it is supplied', () => {
    render(
      <PageShell title={TITLE} subtitle={SUBTITLE}>
        {CONTENT}
      </PageShell>,
    );

    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it('renders no subtitle paragraph when the subtitle is omitted', () => {
    const { container } = render(
      <PageShell title={TITLE}>{CONTENT}</PageShell>,
    );

    expect(container.querySelector('p')).toBeNull();
  });

  it('renders the back slot above the title, inside the header', () => {
    render(
      <PageShell title={TITLE} back={<PageShellBackSlot />}>
        {CONTENT}
      </PageShell>,
    );

    const back = screen.getByRole('link', { name: PAGE_SHELL_BACK_LABEL });
    const heading = screen.getByRole('heading', { level: 1, name: TITLE });

    expect(back).toHaveAttribute('data-testid', PAGE_SHELL_BACK_TEST_ID);
    expect(back.closest('header')).not.toBeNull();
    expect(precedes(back, heading)).toBe(true);
  });

  it('renders the actions slot at the end of the header row', () => {
    render(
      <PageShell title={TITLE} actions={<PageShellActionsSlot />}>
        {CONTENT}
      </PageShell>,
    );

    const actions = screen.getByRole('button', {
      name: PAGE_SHELL_ACTION_LABEL,
    });
    const header = actions.closest('header');

    expect(actions).toHaveAttribute('data-testid', PAGE_SHELL_ACTION_TEST_ID);
    expect(header).not.toBeNull();
    expect(header?.lastElementChild?.contains(actions)).toBe(true);
  });

  it('renders no wrapper for an omitted back or actions slot', () => {
    const { container } = render(
      <PageShell title={TITLE}>{CONTENT}</PageShell>,
    );

    const header = container.querySelector('header');
    const titleBlock = header?.firstElementChild;

    expect(header?.children).toHaveLength(1);
    expect(titleBlock?.children).toHaveLength(1);
    expect(titleBlock?.firstElementChild?.tagName).toBe('H1');
  });

  it('renders the children under the header', () => {
    const { container } = render(
      <PageShell title={TITLE}>
        <div>{CONTENT}</div>
      </PageShell>,
    );

    // `<header>` inside a `<section>` is not a `banner` landmark, so the element
    // is looked up directly instead of by role.
    const header = container.querySelector('header');
    const content = screen.getByText(CONTENT);

    expect(header).not.toBeNull();
    expect(content.tagName).toBe('DIV');
    expect(header !== null && precedes(header, content)).toBe(true);
  });

  it('paints the frame with token classes only', () => {
    const { container } = render(
      <PageShell title={TITLE} subtitle={SUBTITLE}>
        {CONTENT}
      </PageShell>,
    );

    const section = container.firstElementChild;
    const heading = screen.getByRole('heading', { level: 1, name: TITLE });

    expect(section?.tagName).toBe('SECTION');
    expect(section?.className).toBe('space-y-6');
    expect(heading.className).toContain('text-text-primary');
    expect(heading.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(heading.className).not.toMatch(
      /(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-\d{2,3}/,
    );
  });

  it('passes axe with both slots supplied', async () => {
    const { container } = render(
      <PageShell
        title={TITLE}
        subtitle={SUBTITLE}
        back={<PageShellBackSlot />}
        actions={<PageShellActionsSlot />}
      >
        {CONTENT}
      </PageShell>,
    );

    const results = await axe(container, AXE_JSDOM_OPTIONS);

    expect(results.violations).toEqual([]);
  });
});
