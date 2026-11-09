/**
 * Tests of the pager primitive.
 *
 * The component is props-driven and owns no state, so each behaviour is one
 * `render` away: the current page, the disabled ends, the reported intent and
 * the optional page-size selector.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '../src/components/pagination/Pagination.js';
import {
  PAGINATION_DEFAULT_ARIA_LABEL,
  PAGINATION_LIMIT_LABEL,
  PAGINATION_NEXT_LABEL,
  PAGINATION_PREVIOUS_LABEL,
} from '../src/components/pagination/pagination.const.js';
import type { PaginationMeta } from '../src/components/pagination/pagination.interface.js';

/**
 * @param patch - fields to override on a plausible pager block.
 * @returns the base block with the patch applied.
 */
function withMeta(patch: Partial<PaginationMeta> = {}): PaginationMeta {
  return { page: 2, limit: 20, total: 137, totalPages: 7, ...patch };
}

describe('Pagination', () => {
  it('is a navigation landmark with the default accessible name', () => {
    render(<Pagination meta={withMeta()} onPageChange={() => undefined} />);

    expect(
      screen.getByRole('navigation', { name: PAGINATION_DEFAULT_ARIA_LABEL }),
    ).toBeInTheDocument();
  });

  it('accepts a custom accessible name', () => {
    render(
      <Pagination
        meta={withMeta()}
        ariaLabel="API kulcsok lapozása"
        onPageChange={() => undefined}
      />,
    );

    expect(
      screen.getByRole('navigation', { name: 'API kulcsok lapozása' }),
    ).toBeInTheDocument();
  });

  it('marks the current page with aria-current', () => {
    render(<Pagination meta={withMeta()} onPageChange={() => undefined} />);

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the visible range of rows', () => {
    render(<Pagination meta={withMeta()} onPageChange={() => undefined} />);

    expect(screen.getByText('21–40 / 137')).toBeInTheDocument();
  });

  it('disables “previous” on the first page', () => {
    render(
      <Pagination meta={withMeta({ page: 1 })} onPageChange={() => undefined} />,
    );

    expect(
      screen.getByRole('button', { name: PAGINATION_PREVIOUS_LABEL }),
    ).toBeDisabled();
  });

  it('disables “next” on the last page', () => {
    render(
      <Pagination meta={withMeta({ page: 7 })} onPageChange={() => undefined} />,
    );

    expect(
      screen.getByRole('button', { name: PAGINATION_NEXT_LABEL }),
    ).toBeDisabled();
  });

  it('reports the requested page once per click', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={withMeta()} onPageChange={onPageChange} />);

    await userEvent.click(
      screen.getByRole('button', { name: PAGINATION_NEXT_LABEL }),
    );

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('reports the clicked page number', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={withMeta()} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: '5' }));

    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('renders no page buttons for an empty result set', () => {
    render(
      <Pagination
        meta={withMeta({ page: 1, total: 0, totalPages: 0 })}
        onPageChange={() => undefined}
      />,
    );

    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: PAGINATION_NEXT_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('renders no page-size selector without a change handler', () => {
    render(<Pagination meta={withMeta()} onPageChange={() => undefined} />);

    expect(screen.queryByLabelText(PAGINATION_LIMIT_LABEL)).not.toBeInTheDocument();
  });

  it('reports the selected page size', async () => {
    const onLimitChange = vi.fn();
    render(
      <Pagination
        meta={withMeta()}
        limitOptions={[20, 50, 100]}
        onLimitChange={onLimitChange}
        onPageChange={() => undefined}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(PAGINATION_LIMIT_LABEL),
      '50',
    );

    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('shows the nearest selectable size for an out-of-list limit', () => {
    render(
      <Pagination
        meta={withMeta({ limit: 30 })}
        limitOptions={[20, 50, 100]}
        onLimitChange={() => undefined}
        onPageChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText(PAGINATION_LIMIT_LABEL)).toHaveValue('20');
  });
});
