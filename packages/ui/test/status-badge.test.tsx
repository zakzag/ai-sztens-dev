import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../src/components/status-badge/StatusBadge.js';

describe('StatusBadge', () => {
  it('renders the label as its text', () => {
    render(<StatusBadge status="active" label="Aktív" variant="success" />);

    expect(screen.getByText('Aktív')).toBeInTheDocument();
  });

  it('carries the domain status as a data attribute', () => {
    render(<StatusBadge status="active" label="Aktív" variant="success" />);

    expect(screen.getByText('Aktív')).toHaveAttribute('data-status', 'active');
  });

  it.each([
    ['success', 'bg-success'],
    ['danger', 'bg-danger'],
    ['warning', 'bg-warning'],
    ['info', 'bg-info'],
    ['neutral', 'bg-surface-sunken'],
  ] as const)(
    'maps the %s variant onto the badge token class',
    (variant, expectedClass) => {
      render(<StatusBadge status="s" label="Állapot" variant={variant} />);

      expect(screen.getByText('Állapot').className).toContain(expectedClass);
    },
  );
});
