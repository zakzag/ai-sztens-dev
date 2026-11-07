/**
 * Tests of the API key table.
 *
 * The component is props-driven, so every data state is one `render` away and no
 * service or query client is involved. The failed-read state is *not* covered
 * here: it belongs to the page (`PageErrorState`), see its own test file.
 *
 * The negative assertions are the interesting ones — a loading table must not
 * look empty, an unsortable header must not pretend to be a control, and the
 * token must not appear in the DOM. The fixtures come from the shared contract
 * (`@callback/shared`), the single source of sample rows.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  FILLED_API_KEY,
  SECOND_API_KEY,
  VALID_API_KEY_PAIR,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import { toApiKeyViewModels } from '../../../entities/api-key/api-key.mapper.js';
import {
  API_KEYS_EMPTY_MESSAGE,
  API_KEYS_LOADING_MESSAGE,
  API_KEY_COLUMNS,
} from '../api-keys.const.js';
import type { ApiKeysTableProps } from '../api-keys.interface.js';
import { ApiKeysTable } from './ApiKeysTable.js';

/** View models of both fixtures, as the page would pass them. */
const VIEW_MODELS = toApiKeyViewModels(VALID_API_KEY_PAIR);

/** The sort the URL asks for in most of these tests. */
const SORT: DataTableSort = { columnId: 'name', order: 'asc' };

/**
 * Renders the table with the default props of the contract.
 *
 * @param overrides - props that differ from the defaults.
 * @returns the testing-library render result.
 */
function renderTable(overrides: Partial<ApiKeysTableProps> = {}) {
  // The name cell is a `<Link>` since AIS-131, so the table needs a router
  // context even though nothing here navigates.
  return render(
    <MemoryRouter>
      <ApiKeysTable
        apiKeys={VIEW_MODELS}
        isLoading={false}
        sort={SORT}
        onSortChange={() => undefined}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('ApiKeysTable', () => {
  it('renders one row per key with the column headers', () => {
    renderTable();

    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.identifier }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.description }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.expiresAt }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole('row')).toHaveLength(VIEW_MODELS.length + 1);
    expect(screen.getByText(FILLED_API_KEY.name)).toBeInTheDocument();
    expect(screen.getByText(FILLED_API_KEY.identifier)).toBeInTheDocument();
    expect(screen.getByText(SECOND_API_KEY.identifier)).toBeInTheDocument();
  });

  it('marks the sorted column and leaves an unsortable one unmarked', () => {
    renderTable();

    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.name }),
    ).toHaveAttribute('aria-sort', 'ascending');
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.description }),
    ).not.toHaveAttribute('aria-sort');
  });

  it('does not offer a sort control on the description column', () => {
    renderTable();

    expect(
      screen.queryByRole('button', { name: API_KEY_COLUMNS.description }),
    ).not.toBeInTheDocument();
  });

  it('reports the toggled sort when a sortable header is clicked', async () => {
    const onSortChange = vi.fn();
    renderTable({ onSortChange });

    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_COLUMNS.name }),
    );

    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'name', order: 'desc' });
  });

  it('renders skeleton rows and an announcement while loading', () => {
    const { container } = renderTable({ apiKeys: [], isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent(
      API_KEYS_LOADING_MESSAGE,
    );
    expect(
      screen.getByRole('columnheader', { name: API_KEY_COLUMNS.name }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.queryByText(API_KEYS_EMPTY_MESSAGE)).not.toBeInTheDocument();
  });

  it('renders the empty state when the list is empty', () => {
    renderTable({ apiKeys: [], isLoading: false });

    expect(screen.getByText(API_KEYS_EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the pager it is given', () => {
    renderTable({ pagination: <p>Lapozó</p> });

    expect(screen.getByText('Lapozó')).toBeInTheDocument();
  });

  it('renders no pager when the page passes none', () => {
    renderTable();

    expect(screen.queryByText('Lapozó')).not.toBeInTheDocument();
  });

  it('renders the fallback for a key without description and without expiry', () => {
    renderTable();

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('nincs lejárat')).toBeInTheDocument();
  });

  it('never renders the apiKey token value', () => {
    const { container } = renderTable();

    expect(container.textContent).not.toContain(FILLED_API_KEY.apiKey);
    expect(container.textContent).not.toContain(SECOND_API_KEY.apiKey);
  });

  it('links the name cell to the read-only overlay of that key', () => {
    renderTable();

    // AIS-155: the row opens the `/view` overlay; the legacy detail page is a
    // step further, reached from inside the overlay.
    expect(
      screen.getByRole('link', { name: FILLED_API_KEY.name }),
    ).toHaveAttribute('href', `/api-keys/${FILLED_API_KEY.identifier}/view`);
  });

  it('keeps the identifier a plain text cell', () => {
    renderTable();

    expect(
      screen.queryByRole('link', { name: FILLED_API_KEY.identifier }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(FILLED_API_KEY.identifier)).toBeInTheDocument();
  });
});
