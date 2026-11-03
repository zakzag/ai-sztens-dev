import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../src/components/empty-state/EmptyState.js';

const TITLE = 'Még nincs tárolt API kulcs.';
const DESCRIPTION = 'Vedd fel az elsőt a lenti űrlapon.';

describe('EmptyState', () => {
  it('is exposed as a status region named after its title', () => {
    render(<EmptyState title={TITLE} />);

    expect(screen.getByRole('status', { name: TITLE })).toBeInTheDocument();
  });

  it('renders the title and the optional description', () => {
    render(<EmptyState title={TITLE} description={DESCRIPTION} />);

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
  });

  it('renders no button when no action is supplied', () => {
    render(<EmptyState title={TITLE} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls the action callback when the CTA is clicked', async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title={TITLE}
        action={{ label: 'Kulcs felvitele', onAction }}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('makes the CTA accessible name include the title', () => {
    render(
      <EmptyState
        title={TITLE}
        action={{ label: 'Kulcs felvitele', onAction: () => undefined }}
      />,
    );

    expect(
      screen.getByRole('button', { name: `Kulcs felvitele — ${TITLE}` }),
    ).toBeInTheDocument();
  });

  it('merges caller class names', () => {
    const { container } = render(
      <EmptyState title={TITLE} className="mt-4" />,
    );

    expect(container.firstElementChild?.className).toContain('mt-4');
  });
});
