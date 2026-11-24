/**
 * Tests of the customers filter row (AIS-19).
 *
 * The component is controlled: it renders the query it receives and reports
 * changes. Nothing here talks to a router, so these assertions are about the
 * contract with the page — the page is what makes the one URL write.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createCustomerListQuery } from '../../../test/mocks/customer-list-query.mock.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import {
  CUSTOMERS_FILTER_ALL_LABEL,
  CUSTOMERS_FILTER_LABELS,
  CUSTOMERS_FILTER_RESET_LABEL,
} from '../customers.const.js';
import { CustomersFilters } from './CustomersFilters.js';

/**
 * @param overrides - props a test wants to change.
 * @returns the render result.
 */
function renderFilters(
  overrides: Partial<Parameters<typeof CustomersFilters>[0]> = {},
) {
  return renderWithProviders(
    <CustomersFilters
      params={createCustomerListQuery()}
      onSearchChange={vi.fn()}
      onFilterChange={vi.fn()}
      onReset={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CustomersFilters', () => {
  it('renders the search field and exactly three filters', () => {
    renderFilters();

    expect(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.search),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.type),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.status),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.source),
    ).toBeInTheDocument();
  });

  it('reflects the query it is given', () => {
    renderFilters({
      params: createCustomerListQuery({ type: 'organization', q: 'pelda' }),
    });

    expect(screen.getByLabelText(CUSTOMERS_FILTER_LABELS.type)).toHaveValue(
      'organization',
    );
    expect(screen.getByLabelText(CUSTOMERS_FILTER_LABELS.search)).toHaveValue(
      'pelda',
    );
  });

  it('reports a type choice as a typed patch', async () => {
    const onFilterChange = vi.fn();
    renderFilters({ onFilterChange });

    await userEvent.selectOptions(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.type),
      'company',
    );

    expect(onFilterChange).toHaveBeenCalledWith({ type: 'company' });
  });

  it('offers the “all” option so a filter can be cleared', () => {
    renderFilters({ params: createCustomerListQuery({ status: 'active' }) });

    const select = screen.getByLabelText(CUSTOMERS_FILTER_LABELS.status);

    expect(select).toHaveValue('active');
    expect(
      within(select).getByRole('option', {
        name: CUSTOMERS_FILTER_ALL_LABEL,
      }),
    ).toBeInTheDocument();
  });

  it('reports the reset request', async () => {
    const onReset = vi.fn();
    renderFilters({ onReset });

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_FILTER_RESET_LABEL }),
    );

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
