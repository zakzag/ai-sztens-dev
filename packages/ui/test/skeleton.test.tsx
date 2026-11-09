import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../src/components/skeleton/Skeleton.js';

/**
 * Tests of {@link Skeleton}.
 *
 * A skeleton is a placeholder, so there is nothing to query by role: every
 * assertion reads the DOM the component produced (it is `aria-hidden` on
 * purpose, see the component doc).
 */
describe('Skeleton', () => {
  it('renders one placeholder by default, hidden from assistive technology', () => {
    const { container } = render(<Skeleton />);
    const wrapper = container.firstElementChild;

    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper?.children).toHaveLength(1);
  });

  it('renders as many placeholders as `lines` asks for', () => {
    const { container } = render(<Skeleton lines={4} />);

    expect(container.firstElementChild?.children).toHaveLength(4);
  });

  it('never renders fewer than one placeholder', () => {
    const { container } = render(<Skeleton lines={0} />);

    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it.each([
    ['line', 'h-3'],
    ['field', 'h-9'],
    ['row', 'h-10'],
  ] as const)(
    'maps the %s shape onto its height class',
    (shape, expectedClass) => {
      const { container } = render(<Skeleton shape={shape} />);
      const placeholder = container.firstElementChild?.firstElementChild;

      expect(placeholder?.className).toContain(expectedClass);
    },
  );

  it('paints the placeholder with the sunken surface token', () => {
    const { container } = render(<Skeleton />);
    const placeholder = container.firstElementChild?.firstElementChild;

    expect(placeholder?.className).toContain('bg-surface-sunken');
    expect(placeholder?.className).toContain('shadow-neu-inset');
  });

  it('merges caller class names on the wrapper', () => {
    const { container } = render(<Skeleton className="mt-4" />);

    expect(container.firstElementChild?.className).toContain('mt-4');
  });
});
