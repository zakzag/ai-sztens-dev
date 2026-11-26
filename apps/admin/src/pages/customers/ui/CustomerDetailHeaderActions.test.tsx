/**
 * Tests of the customer detail header's write actions (AIS-21).
 *
 * Three surfaces, one component: the edit link, the status-change window and the
 * archive confirmation. Both dialogs are non-navigable modals, so the assertions
 * are about what the operator sees and about the request that left the browser —
 * never about a route change (there is none).
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import { server } from '../../../test/mocks/server.js';
import {
  customersArchiveSuccess,
  customersStatusSuccess,
} from '../../../test/mocks/handlers/customers.handlers.js';
import {
  CUSTOMERS_ARCHIVE_CONFIRM_LABEL,
  CUSTOMERS_ARCHIVE_CONFIRM_TITLE,
  CUSTOMERS_STATUS_DIALOG_TITLE,
  CUSTOMERS_STATUS_FIELD_LABEL,
  CUSTOMERS_STATUS_SUBMIT_LABEL,
  CUSTOMER_DETAIL_ACTION_LABELS,
  CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL,
  CUSTOMER_DETAIL_EDIT_LABEL,
  CUSTOMER_EDIT_CANCEL_LABEL,
} from '../customers.const.js';
import { CustomerDetailHeaderActions } from './CustomerDetailHeaderActions.js';

const CUSTOMER_ID = VALID_CUSTOMER_DETAIL.id;
const UPDATED_AT = VALID_CUSTOMER_DETAIL.updatedAt;
const DISPLAY_NAME = VALID_CUSTOMER_DETAIL.shortName ?? VALID_CUSTOMER_DETAIL.legalName;

/**
 * Renders the actions with the current versions of the record.
 *
 * @param onArchived - spy the archive path reports to.
 * @returns the render result.
 */
function renderActions(onArchived = vi.fn()) {
  return renderWithProviders(
    <CustomerDetailHeaderActions
      customerId={CUSTOMER_ID}
      displayName={DISPLAY_NAME}
      status={VALID_CUSTOMER_DETAIL.status}
      updatedAt={UPDATED_AT}
      onArchived={onArchived}
    />,
  );
}

/**
 * Opens the action menu.
 */
async function openMenu(): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL }),
  );
}

describe('CustomerDetailHeaderActions', () => {
  it('links to the edit page of the same customer', () => {
    renderActions();

    expect(
      screen.getByRole('link', { name: CUSTOMER_DETAIL_EDIT_LABEL }),
    ).toHaveAttribute('href', `/customers/${CUSTOMER_ID}/edit`);
  });

  it('lists both write actions in the menu', async () => {
    renderActions();

    await openMenu();

    expect(
      await screen.findByRole('menuitem', {
        name: CUSTOMER_DETAIL_ACTION_LABELS.status,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: CUSTOMER_DETAIL_ACTION_LABELS.archive }),
    ).toBeInTheDocument();
  });

  it('opens the status window with the current status preselected', async () => {
    renderActions();

    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: CUSTOMER_DETAIL_ACTION_LABELS.status,
      }),
    );

    expect(await screen.findByText(CUSTOMERS_STATUS_DIALOG_TITLE)).toBeInTheDocument();
    expect(screen.getByLabelText(CUSTOMERS_STATUS_FIELD_LABEL)).toHaveValue(
      VALID_CUSTOMER_DETAIL.status,
    );
  });

  it('sends the chosen status with the concurrency token and closes', async () => {
    server.use(customersStatusSuccess);
    const recorder = createRequestRecorder();

    renderActions();

    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: CUSTOMER_DETAIL_ACTION_LABELS.status,
      }),
    );

    await userEvent.selectOptions(
      screen.getByLabelText(CUSTOMERS_STATUS_FIELD_LABEL),
      'active',
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_STATUS_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(
        recorder.requests.some((request) => request.method === 'PATCH'),
      ).toBe(true);
    });

    const patch = recorder.requests.find((request) => request.method === 'PATCH');

    expect(patch?.url).toContain(`/api/admin/customers/${CUSTOMER_ID}/status`);
    expect(patch?.body).toEqual({ status: 'active', updatedAt: UPDATED_AT });

    await waitFor(() => {
      expect(screen.queryByText(CUSTOMERS_STATUS_DIALOG_TITLE)).not.toBeInTheDocument();
    });

    recorder.stop();
  });

  it('closes the status window on cancel without a request', async () => {
    const recorder = createRequestRecorder();

    renderActions();

    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: CUSTOMER_DETAIL_ACTION_LABELS.status,
      }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_CANCEL_LABEL }),
    );

    await waitFor(() => {
      expect(screen.queryByText(CUSTOMERS_STATUS_DIALOG_TITLE)).not.toBeInTheDocument();
    });
    expect(recorder.requests.some((request) => request.method === 'PATCH')).toBe(
      false,
    );

    recorder.stop();
  });

  it('archives the customer and reports it upward', async () => {
    server.use(customersArchiveSuccess);
    const recorder = createRequestRecorder();
    const onArchived = vi.fn();

    renderActions(onArchived);

    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: CUSTOMER_DETAIL_ACTION_LABELS.archive,
      }),
    );

    // The confirmation names the customer, not just the action.
    expect(await screen.findByText(CUSTOMERS_ARCHIVE_CONFIRM_TITLE)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DISPLAY_NAME))).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_ARCHIVE_CONFIRM_LABEL }),
    );

    await waitFor(() => {
      expect(onArchived).toHaveBeenCalledTimes(1);
    });

    expect(
      recorder.requests.some((request) => request.method === 'DELETE'),
    ).toBe(true);

    recorder.stop();
  });
});
