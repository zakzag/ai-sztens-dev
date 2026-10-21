import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table } from '../src/components/table/Table.js';
import { TableBody } from '../src/components/table/TableBody.js';
import { TableCell } from '../src/components/table/TableCell.js';
import { TableHead } from '../src/components/table/TableHead.js';
import { TableHeaderCell } from '../src/components/table/TableHeaderCell.js';
import { TableRow } from '../src/components/table/TableRow.js';

function renderSampleTable() {
  return render(
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Név</TableHeaderCell>
          <TableHeaderCell>Azonosító</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>Első kulcs</TableCell>
          <TableCell>elso-kulcs</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('Table', () => {
  it('renders a table with column headers exposed to assistive technology', () => {
    renderSampleTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Név' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('scopes header cells to their column by default', () => {
    renderSampleTable();

    expect(screen.getByRole('columnheader', { name: 'Név' })).toHaveAttribute('scope', 'col');
  });

  it('keeps an explicit scope instead of the default', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableHeaderCell scope="row">Fejléc</TableHeaderCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('rowheader', { name: 'Fejléc' })).toHaveAttribute('scope', 'row');
  });

  it('renders the supplied data in the body cells', () => {
    renderSampleTable();

    const [, bodyRow] = screen.getAllByRole('row');

    expect(within(bodyRow).getByText('Első kulcs')).toBeInTheDocument();
    expect(within(bodyRow).getByText('elso-kulcs')).toBeInTheDocument();
  });

  it('wraps the table in a scroll container so wide data never overflows', () => {
    const { container } = renderSampleTable();

    expect(container.firstElementChild?.className).toContain('overflow-x-auto');
  });

  it('merges caller class names on the table element', () => {
    render(
      <Table className="text-base">
        <TableBody>
          <TableRow>
            <TableCell>Sejt</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table').className).toContain('text-base');
  });
});
