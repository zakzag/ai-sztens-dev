import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from '../src/components/card/Card.js';

describe('Card', () => {
  it('renders children as a raised surface', () => {
    const { container } = render(<Card>Tartalom</Card>);

    expect(screen.getByText('Tartalom')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('shadow-neu-raised');
  });

  it('renders the title as a heading', () => {
    render(<Card title="API kulcsok">Tartalom</Card>);

    expect(screen.getByRole('heading', { name: 'API kulcsok', level: 2 })).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<Card description="Itt kezelheted a kulcsokat" />);

    expect(screen.getByText('Itt kezelheted a kulcsokat')).toBeInTheDocument();
  });

  it('merges caller class names', () => {
    const { container } = render(<Card className="mt-6">Tartalom</Card>);

    expect(container.firstElementChild?.className).toContain('mt-6');
  });

  it('renders without children', () => {
    const { container } = render(<Card />);

    expect(container.firstElementChild).toBeInTheDocument();
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });

  it('paints its outline with the dark hairline token instead of currentColor', () => {
    const { container } = render(<Card>Tartalom</Card>);

    const className = container.firstElementChild?.className ?? '';

    expect(className).toContain('border-border-hairline');
    expect(className).not.toContain('border-current');
  });
});
