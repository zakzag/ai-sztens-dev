/**
 * Tests of the customers table (AIS-19).
 *
 * The table is presentational: it renders the columns the contract fixes, keeps
 * the header while loading and reports intent (sort, archive) upwards. These
 * assertions are what pins the eight columns and the `aria-sort` contract.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_COLUMNS,
  CUSTOMER_MISSING_DATA_ARIA_LABEL,
  CUSTOMER_MISSING_DATA_LABEL,
} from '../../../entities/customer/customer.const.js';
import { createCustomerRowViewModel } from '../../../test/mocks/customer-list-query.mock.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import {
  CUSTOMERS_ROW_ACTIONS,
  CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
  CUSTOMERS_TABLE_TITLE,
} from '../customers.const.js';
import { CustomersTable } from './CustomersTable.js';

const FILLED_ROW = createCustomerRowViewModel();
const MISSING_ROW = createCustomerRowViewModel({
  id: '4f5e6d7c-8b9a-4c1d-9e2f-3a4b5c6d7e8f',
  displayName: 'Kiss Péter egyéni vállalkozó',
  taxNumberText: '—',
  primaryContactText: 'Nincs',
  lastActivityText: '—',
  hasMissingData: true,
  status: 'prospect',
});

/**
 * @param overrides - props a test wants to change.
 * @returns the render result.
 */
function renderTable(
  overrides: Partial<Parameters<typeof CustomersTable>[0]> = {},
) {
  return renderWithProviders(
    <CustomersTable
      customers={[FILLED_ROW, MISSING_ROW]}
      isLoading={false}
      sort={{ columnId: 'customerNumber', order: 'asc' }}
      onSortChange={vi.fn()}
      onArchive={vi.fn()}
      empty={<p>nincs</p>}
      {...overrides}
    />,
    { initialEntries: ['/customers'] },
  );
}

describe('CustomersTable', () => {
  it('renders the eight contract columns in order, then the actions column', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader');
    const texts = headers.map((header) => header.textContent?.trim());

    expect(texts).toEqual([
      CUSTOMER_COLUMNS.customerNumber,
      CUSTOMER_COLUMNS.name,
      CUSTOMER_COLUMNS.type,
      CUSTOMER_COLUMNS.taxNumber,
      CUSTOMER_COLUMNS.status,
      CUSTOMER_COLUMNS.primaryContact,
      CUSTOMER_COLUMNS.lastActivity,
      CUSTOMER_COLUMNS.missingData,
      // The actions header is an `sr-only` label, never visible text.
      CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
    ]);
  });

  it('marks the sorted column with aria-sort and leaves the rest alone', () => {
    renderTable();

    const sorted = screen.getByRole('columnheader', {
      name: CUSTOMER_COLUMNS.customerNumber,
    });
    const unsorted = screen.getByRole('columnheader', {
      name: CUSTOMER_COLUMNS.taxNumber,
    });

    expect(sorted).toHaveAttribute('aria-sort', 'ascending');
    expect(unsorted).not.toHaveAttribute('aria-sort');
  });

  it('links every row name to the detail route', () => {
    renderTable();

    expect(
      screen.getByRole('link', { name: FILLED_ROW.displayName }),
    ).toHaveAttribute('href', `/customers/${FILLED_ROW.id}`);
  });

  it('shows the missing-data badge only on the incomplete row', () => {
    renderTable();

    // Queried by its accessible name: the column header carries the same visible
    // text, so a text query would match the header as well.
    const badges = screen.getAllByLabelText(CUSTOMER_MISSING_DATA_ARIA_LABEL);

    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent(CUSTOMER_MISSING_DATA_LABEL);
  });

  it('keeps the header and announces loading while fetching', () => {
    renderTable({ customers: [], isLoading: true });

    // `CUSTOMERS_TABLE_TITLE` is both the card heading and the table caption, so
    // the query asks for the heading role instead of the text.
    expect(
      screen.getByRole('heading', { name: CUSTOMERS_TABLE_TITLE }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: CUSTOMER_COLUMNS.name }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the empty node when there are no rows', () => {
    renderTable({ customers: [] });

    expect(screen.getByText('nincs')).toBeInTheDocument();
  });

  it('reports an archive request with the row it belongs to', async () => {
    const onArchive = vi.fn();
    renderTable({ onArchive });

    await userEvent.click(
      screen.getAllByRole('button', {
        name: CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
      })[0] as HTMLElement,
    );
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: CUSTOMERS_ROW_ACTIONS.archive,
      }),
    );

    await waitFor(() => {
      expect(onArchive).toHaveBeenCalledWith(FILLED_ROW);
    });
  });
});
