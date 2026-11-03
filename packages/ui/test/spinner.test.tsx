import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from '../src/components/spinner/Spinner.js';
import { SPINNER_DEFAULT_LABEL } from '../src/components/spinner/spinner.const.js';

describe('Spinner', () => {
  it('is exposed as a status region', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces the default label when the caller supplies none', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toHaveTextContent(SPINNER_DEFAULT_LABEL);
  });

  it('announces the supplied label', () => {
    render(<Spinner label="API kulcsok betöltése…" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'API kulcsok betöltése…',
    );
  });

  it.each([
    ['sm', 'h-4'],
    ['md', 'h-6'],
  ] as const)('maps the %s size onto its class', (size, expectedClass) => {
    const { container } = render(<Spinner size={size} />);
    const ring = container.querySelector('[aria-hidden="true"]');

    expect(ring?.className).toContain(expectedClass);
    expect(ring?.className).toContain('animate-spin');
  });
});
