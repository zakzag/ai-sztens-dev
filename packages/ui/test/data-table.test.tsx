/**
 * Tests of the data-table primitive.
 *
 * The table is props-driven, so every state (loading, empty, success) and every
 * interaction (sort request, row actions) is one `render` away; the negative
 * assertions are the interesting ones — a loading table must not look empty, and
 * an unsortable header must not pretend to be a control.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from '../src/components/data-table/DataTable.js';
import type {
  DataTableColumn,
  DataTableSort,
} from '../src/components/data-table/data-table.interface.js';
import {
  DATA_TABLE_ACTIONS_HEADER,
  DATA_TABLE_EMPTY_TITLE,
} from '../src/components/data-table/data-table.const.js';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly identifier: string;
}

const ROWS: readonly Row[] = [
  { id: '1', name: 'Vapi prod', identifier: 'vapi-prod' },
  { id: '2', name: 'Vapi test', identifier: 'vapi-test' },
];

const COLUMNS: readonly DataTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Név',
    cell: (row) => row.name,
    sortable: true,
  },
  {
    id: 'identifier',
    header: 'Azonosító',
    cell: (row) => row.identifier,
  },
];

const SORT: DataTableSort = { columnId: 'name', order: 'asc' };

describe('DataTable', () => {
  it('renders the column headers and one row per item', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        sort={SORT}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Név' })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Azonosító' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.getByText('Vapi prod')).toBeInTheDocument();
    expect(screen.getByText('vapi-test')).toBeInTheDocument();
  });

  it('exposes the current sort through aria-sort', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        sort={SORT}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Név' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(
      screen.getByRole('columnheader', { name: 'Azonosító' }),
    ).not.toHaveAttribute('aria-sort');
  });

  it('reports the toggled direction when a sorted header is clicked', async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        sort={SORT}
        onSortChange={onSortChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Név' }));

    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'name', order: 'desc' });
  });

  it('reports a new column ascending', async () => {
    const onSortChange = vi.fn();
    const columns: readonly DataTableColumn<Row>[] = COLUMNS.map((column) => ({
      ...column,
      sortable: true,
    }));
    render(
      <DataTable
        rows={ROWS}
        columns={columns}
        rowKey={(row) => row.id}
        sort={SORT}
        onSortChange={onSortChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Azonosító' }));

    expect(onSortChange).toHaveBeenCalledWith({
      columnId: 'identifier',
      order: 'asc',
    });
  });

  it('renders an unsortable header as plain text', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        sort={SORT}
        onSortChange={() => undefined}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Azonosító' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the header and renders skeleton rows while loading', () => {
    const { container } = render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        isLoading
        loadingRowCount={3}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Név' })).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(screen.queryByText(DATA_TABLE_EMPTY_TITLE)).not.toBeInTheDocument();
  });

  it('renders the caller empty slot instead of the table', () => {
    render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        empty={<p>Semmi nincs itt.</p>}
      />,
    );

    expect(screen.getByText('Semmi nincs itt.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('falls back to a neutral empty state', () => {
    render(<DataTable rows={[]} columns={COLUMNS} rowKey={(row) => row.id} />);

    expect(screen.getByText(DATA_TABLE_EMPTY_TITLE)).toBeInTheDocument();
  });

  it('renders the row actions slot and names its column', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        sort={SORT}
        rowActions={(row) => <button type="button">{`Szerkesztés: ${row.name}`}</button>}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: DATA_TABLE_ACTIONS_HEADER }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Szerkesztés: Vapi prod' }),
    ).toBeInTheDocument();
  });

  it('renders the caption for assistive technology', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        caption="Tárolt kulcsok"
      />,
    );

    expect(screen.getByText('Tárolt kulcsok').tagName).toBe('CAPTION');
  });

  it('aligns a column to the end when asked', () => {
    const columns: readonly DataTableColumn<Row>[] = [
      { ...COLUMNS[0], align: 'end' },
    ];
    const { container } = render(
      <DataTable rows={ROWS} columns={columns} rowKey={(row) => row.id} />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Név' }).className,
    ).toContain('text-right');
    expect(container.querySelector('tbody td')?.className).toContain(
      'text-right',
    );
  });
});
