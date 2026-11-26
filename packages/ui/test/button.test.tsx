import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../src/components/button/Button.js';
import { CloseIcon, PlusIcon } from '../src/components/icon/icons.js';

describe('Button', () => {
  it('renders its label and defaults to a non-submitting button', () => {
    render(<Button>Mentés</Button>);

    const button = screen.getByRole('button', { name: 'Mentés' });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('forwards an explicit submit type for forms', () => {
    render(<Button type="submit">Küldés</Button>);

    expect(screen.getByRole('button', { name: 'Küldés' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('applies the primary variant by default', () => {
    render(<Button>Alap</Button>);

    expect(screen.getByRole('button', { name: 'Alap' }).className).toContain(
      'bg-primary',
    );
  });

  it('paints its outline with the dark hairline token instead of currentColor', () => {
    render(<Button>Alap</Button>);

    const className = screen.getByRole('button', { name: 'Alap' }).className;

    expect(className).toContain('border-border-hairline');
    expect(className).not.toContain('border-current');
  });

  it('applies the danger variant classes', () => {
    render(<Button variant="danger">Törlés</Button>);

    expect(screen.getByRole('button', { name: 'Törlés' }).className).toContain(
      'bg-danger',
    );
  });

  it('applies the requested size', () => {
    render(<Button size="lg">Nagy</Button>);

    expect(screen.getByRole('button', { name: 'Nagy' }).className).toContain(
      'h-12',
    );
  });

  it('keeps caller class names alongside the recipe', () => {
    render(<Button className="w-full">Széles</Button>);

    const className = screen.getByRole('button', { name: 'Széles' }).className;

    expect(className).toContain('w-full');
    expect(className).toContain('rounded-control');
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kattints</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Kattints' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled while loading and announces the busy state', () => {
    render(<Button isLoading>Mentés</Button>);

    const button = screen.getByRole('button', { name: 'Mentés' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('does not emit a click event while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Mentés
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mentés' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('respects an explicit disabled prop', () => {
    render(<Button disabled>Letiltva</Button>);

    expect(screen.getByRole('button', { name: 'Letiltva' })).toBeDisabled();
  });

  it('renders the icon slot before the label without touching the name', () => {
    render(<Button icon={<PlusIcon />}>Új kulcs</Button>);

    const button = screen.getByRole('button', { name: 'Új kulcs' });
    const svg = button.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(button.firstElementChild).toBe(svg);
  });

  it('renders an icon-only button whose name comes from the label prop', () => {
    render(
      <Button icon={<CloseIcon />} aria-label="Bezárás">
        {null}
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Bezárás' });

    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('replaces the icon with the spinner while loading', () => {
    render(
      <Button icon={<PlusIcon />} isLoading>
        Mentés
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Mentés' });

    expect(button.querySelector('svg')).toBeNull();
  });
});
