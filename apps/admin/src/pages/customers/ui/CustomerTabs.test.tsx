/**
 * Tests of the customer detail tab strip (AIS-20).
 *
 * The strip is a `<nav>` of buttons, not a `tablist`: every tab has its own URL,
 * so the assertions are about the **navigation contract** — the closed set of
 * labels, the accessible name of the landmark, the `aria-current` marker of the
 * active tab and the single value a click reports.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOMER_DETAIL_TABS, CUSTOMER_DETAIL_TABS_LABEL } from '../customers.const.js';
import type { CustomerTab } from '../customers.interface.js';
import { CustomerTabs } from './CustomerTabs.js';

/**
 * @param value - the `?tab=` value.
 * @returns the visible label the constant maps it to.
 */
function labelOf(value: CustomerTab): string {
  return CUSTOMER_DETAIL_TABS.find((tab) => tab.value === value)?.label ?? '';
}

describe('CustomerTabs', () => {
  it('renders one button per tab, in the contract order', () => {
    render(<CustomerTabs tab="overview" onTabChange={() => undefined} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(
      CUSTOMER_DETAIL_TABS.map((tab) => tab.label),
    );
  });

  it('names its navigation landmark', () => {
    render(<CustomerTabs tab="overview" onTabChange={() => undefined} />);

    expect(
      screen.getByRole('navigation', { name: CUSTOMER_DETAIL_TABS_LABEL }),
    ).toBeInTheDocument();
  });

  it('marks the active tab with aria-current and nothing else', () => {
    render(<CustomerTabs tab="data" onTabChange={() => undefined} />);

    expect(
      screen.getByRole('button', { name: labelOf('data') }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('button', { name: labelOf('overview') }),
    ).not.toHaveAttribute('aria-current');
  });

  it('reports the clicked tab', async () => {
    const onTabChange = vi.fn();

    render(<CustomerTabs tab="overview" onTabChange={onTabChange} />);

    await userEvent.click(screen.getByRole('button', { name: labelOf('audit') }));

    expect(onTabChange).toHaveBeenCalledExactlyOnceWith('audit');
  });
});
