import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../src/components/badge/Badge.js';

describe('Badge', () => {
  it('renders its text and defaults to the neutral recipe', () => {
    render(<Badge>Ismeretlen</Badge>);

    const badge = screen.getByText('Ismeretlen');

    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-surface-sunken');
  });

  it.each([
    ['info', 'bg-info'],
    ['success', 'bg-success'],
    ['warning', 'bg-warning'],
    ['danger', 'bg-danger'],
  ] as const)('maps the %s variant to its token class', (variant, expectedClass) => {
    render(<Badge variant={variant}>{variant}</Badge>);

    expect(screen.getByText(variant).className).toContain(expectedClass);
  });

  it('merges caller class names', () => {
    render(<Badge className="ml-2">Aktív</Badge>);

    expect(screen.getByText('Aktív').className).toContain('ml-2');
  });

  it('paints its outline with the dark hairline token', () => {
    render(<Badge>Semleges</Badge>);

    expect(screen.getByText('Semleges').className).toContain('border-border-hairline');
  });
});
