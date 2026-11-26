/**
 * Tests of the archive confirmation (AIS-19).
 *
 * The component only reports the decision; these assertions pin that it never
 * performs the write itself and that both ways out reach `onOpenChange`.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import {
  CUSTOMERS_ARCHIVE_CONFIRM_LABEL,
  CUSTOMERS_ARCHIVE_CONFIRM_TITLE,
} from '../customers.const.js';
import { ArchiveCustomerDialog } from './ArchiveCustomerDialog.js';

const CUSTOMER_NAME = 'Példa Kft.';

/**
 * @param overrides - props a test wants to change.
 * @returns the render result.
 */
function renderDialog(
  overrides: Partial<Parameters<typeof ArchiveCustomerDialog>[0]> = {},
) {
  return renderWithProviders(
    <ArchiveCustomerDialog
      open
      onOpenChange={vi.fn()}
      customerName={CUSTOMER_NAME}
      isPending={false}
      onConfirm={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ArchiveCustomerDialog', () => {
  it('names the action and the customer it applies to', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(CUSTOMERS_ARCHIVE_CONFIRM_TITLE)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CUSTOMER_NAME))).toBeInTheDocument();
  });

  it('reports the confirmation', async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_ARCHIVE_CONFIRM_LABEL }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('reports a dismissal without confirming', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onOpenChange, onConfirm });

    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
