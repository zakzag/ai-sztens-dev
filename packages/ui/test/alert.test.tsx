import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from '../src/components/alert/Alert.js';

describe('Alert', () => {
  it('renders children and defaults to the info variant as a status region', () => {
    render(<Alert>Sikeres mentés</Alert>);

    const alert = screen.getByRole('status');

    expect(alert).toHaveTextContent('Sikeres mentés');
    expect(alert.className).toContain('border-info');
  });

  it('renders the title above the body', () => {
    render(<Alert title="Hiba történt">Próbáld újra később</Alert>);

    expect(screen.getByText('Hiba történt')).toBeInTheDocument();
    expect(screen.getByText('Próbáld újra később')).toBeInTheDocument();
  });

  it('announces the danger variant immediately as an alert', () => {
    render(<Alert variant="danger">Nem sikerült</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Nem sikerült');
  });

  it.each([
    ['info', 'border-info'],
    ['success', 'border-success'],
    ['warning', 'border-warning'],
    ['danger', 'border-danger'],
  ] as const)('maps the %s variant to its accent token', (variant, expectedClass) => {
    const { container } = render(<Alert variant={variant}>{variant}</Alert>);

    expect(container.firstElementChild?.className).toContain(expectedClass);
  });

  it('merges caller class names', () => {
    render(<Alert className="mt-4">Tartalom</Alert>);

    expect(screen.getByRole('status').className).toContain('mt-4');
  });
});
