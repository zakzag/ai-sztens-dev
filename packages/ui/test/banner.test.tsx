import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from '../src/components/banner/Banner.js';

describe('Banner', () => {
  it('defaults to the info variant and announces itself as a status region', () => {
    render(<Banner>Nincs internetkapcsolat</Banner>);

    const banner = screen.getByRole('status');

    expect(banner).toHaveTextContent('Nincs internetkapcsolat');
    expect(banner.className).toContain('border-info');
  });

  it('announces the danger variant immediately as an alert', () => {
    render(<Banner variant="danger">Lejárt a munkamenet</Banner>);

    expect(screen.getByRole('alert')).toHaveTextContent('Lejárt a munkamenet');
  });

  it.each([
    ['info', 'border-info'],
    ['warning', 'border-warning'],
    ['danger', 'border-danger'],
  ] as const)('maps the %s variant to its accent token', (variant, expectedClass) => {
    const { container } = render(<Banner variant={variant}>{variant}</Banner>);

    expect(container.firstElementChild?.className).toContain(expectedClass);
  });

  it('renders the title above the body', () => {
    render(<Banner title="Offline">A kérések nem mennek ki.</Banner>);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('A kérések nem mennek ki.')).toBeInTheDocument();
  });

  it('renders the action slot', () => {
    render(<Banner action={<button type="button">Bejelentkezés</button>}>Lejárt</Banner>);

    expect(screen.getByRole('button', { name: 'Bejelentkezés' })).toBeInTheDocument();
  });

  it('renders a labelled dismiss control and calls it once per click', async () => {
    const onDismiss = vi.fn();

    render(
      <Banner onDismiss={onDismiss} dismissLabel="Banner bezárása">
        Offline
      </Banner>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Banner bezárása' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no dismiss control when there is no handler', () => {
    render(<Banner>Offline</Banner>);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('merges caller class names', () => {
    render(<Banner className="sticky top-0">Offline</Banner>);

    expect(screen.getByRole('status').className).toContain('sticky');
  });
});
