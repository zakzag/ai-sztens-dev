import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DescriptionList } from '../src/components/description-list/DescriptionList.js';
import { DESCRIPTION_LIST_EMPTY_MESSAGE } from '../src/components/description-list/description-list.const.js';

const ITEMS = [
  { label: 'Név', value: 'Vapi prod' },
  { label: 'Azonosító', value: 'vapi-prod' },
] as const;

describe('DescriptionList', () => {
  it('renders a semantic description list', () => {
    const { container } = render(<DescriptionList items={ITEMS} />);

    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(ITEMS.length);
    expect(container.querySelectorAll('dd')).toHaveLength(ITEMS.length);
  });

  it('renders every label and value', () => {
    render(<DescriptionList items={ITEMS} />);

    expect(screen.getByText('Név')).toBeInTheDocument();
    expect(screen.getByText('Vapi prod')).toBeInTheDocument();
    expect(screen.getByText('Azonosító')).toBeInTheDocument();
    expect(screen.getByText('vapi-prod')).toBeInTheDocument();
  });

  it('renders skeleton rows instead of values while loading', () => {
    const { container } = render(<DescriptionList items={ITEMS} isLoading />);

    expect(container.querySelectorAll('dd')).toHaveLength(0);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the caller empty slot when there is nothing to show', () => {
    render(<DescriptionList items={[]} empty={<p>Semmi nincs itt.</p>} />);

    expect(screen.getByText('Semmi nincs itt.')).toBeInTheDocument();
  });

  it('falls back to a neutral empty text', () => {
    render(<DescriptionList items={[]} />);

    expect(screen.getByText(DESCRIPTION_LIST_EMPTY_MESSAGE)).toBeInTheDocument();
  });

  it('uses a two-column grid from the sm breakpoint', () => {
    const { container } = render(<DescriptionList items={ITEMS} columns={2} />);

    expect(container.querySelector('dl')?.className).toContain(
      'sm:grid-cols-2',
    );
  });

  it('stacks the pairs in one column by default', () => {
    const { container } = render(<DescriptionList items={ITEMS} />);

    expect(container.querySelector('dl')?.className).toContain('grid-cols-1');
  });
});
