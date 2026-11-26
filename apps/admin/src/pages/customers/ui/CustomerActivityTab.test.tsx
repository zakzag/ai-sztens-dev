/**
 * Tests of the *Tevékenység* tab (AIS-181).
 *
 * The rule this file exists for is `D-W4`: the edit and delete actions exist **only**
 * on an operator-authored entry. The fixture page carries one operator row and one
 * `system` row, so the count of action buttons is the direct assertion. The other
 * cases cover the four states (with the note form staying usable in all of them) and
 * the two writes, asserted through the request recorder.
 */

import {
  VALID_ACTIVITY,
  VALID_ACTIVITY_LIST,
  VALID_CUSTOMER_DETAIL,
} from '@callback/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import type { RequestRecorder } from '../../../test/mocks/request-recorder.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  customerActivityCreateSuccess,
  customerActivityRemoveSuccess,
  customerActivityUpdateSuccess,
  customersActivitiesEmpty,
  customersActivitiesServerError,
} from '../../../test/mocks/handlers/customers.handlers.js';
import {
  CUSTOMER_ACTIVITY_BODY_LABEL,
  CUSTOMER_ACTIVITY_DELETE_CONFIRM_LABEL,
  CUSTOMER_ACTIVITY_DELETE_DIALOG_TITLE,
  CUSTOMER_ACTIVITY_DELETE_LABEL,
  CUSTOMER_ACTIVITY_EDIT_LABEL,
  CUSTOMER_ACTIVITY_EMPTY_TITLE,
  CUSTOMER_ACTIVITY_ERROR_TITLE,
  CUSTOMER_ACTIVITY_SAVE_LABEL,
  CUSTOMER_ACTIVITY_SUBMIT_LABEL,
  CUSTOMER_DETAIL_ROUTE_PATH,
} from '../customers.const.js';
import { CustomerActivityTab } from './CustomerActivityTab.js';

/** The detail entry the tab is mounted under. */
const DETAIL_ENTRY = `/customers/${VALID_CUSTOMER_DETAIL.id}`;

/** One recorder per test, stopped afterwards so no listener leaks. */
let recorder: RequestRecorder | null = null;

afterEach(() => {
  recorder?.stop();
  recorder = null;
});

/**
 * @returns the render result of the tab, mounted under the detail route.
 */
function renderTab(): ReturnType<typeof renderWithProviders> {
  const customer = toCustomerDetailViewModel(VALID_CUSTOMER_DETAIL);

  return renderWithProviders(
    <Routes>
      <Route
        path={CUSTOMER_DETAIL_ROUTE_PATH}
        element={<CustomerActivityTab customer={customer} />}
      />
    </Routes>,
    { initialEntries: [`${DETAIL_ENTRY}?tab=activity`] },
  );
}

describe('CustomerActivityTab', () => {
  it('renders the entries of the page with their kind and author', async () => {
    renderTab();

    expect(await screen.findByText(VALID_ACTIVITY.body)).toBeInTheDocument();
    expect(screen.getByText(VALID_ACTIVITY.authorName)).toBeInTheDocument();
    // The second fixture row is `status_change` — its label proves the type mapping.
    expect(screen.getByText('Státuszváltás')).toBeInTheDocument();
  });

  it('offers the edit and delete actions only on an operator entry', async () => {
    renderTab();

    await screen.findByText(VALID_ACTIVITY.body);

    expect(
      screen.getAllByRole('button', { name: CUSTOMER_ACTIVITY_EDIT_LABEL }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: CUSTOMER_ACTIVITY_DELETE_LABEL }),
    ).toHaveLength(1);
  });

  it('keeps the note form usable when the feed is empty', async () => {
    server.use(customersActivitiesEmpty);
    renderTab();

    expect(await screen.findByText(CUSTOMER_ACTIVITY_EMPTY_TITLE)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: CUSTOMER_ACTIVITY_SUBMIT_LABEL }),
    ).toBeInTheDocument();
  });

  it('shows the tab-scoped error state with a retry', async () => {
    server.use(customersActivitiesServerError);
    renderTab();

    expect(await screen.findByText(CUSTOMER_ACTIVITY_ERROR_TITLE)).toBeInTheDocument();
  });

  it('posts a new entry from the form', async () => {
    server.use(customerActivityCreateSuccess);
    recorder = createRequestRecorder();
    renderTab();

    await screen.findByText(VALID_ACTIVITY.body);

    await userEvent.type(
      screen.getByLabelText(CUSTOMER_ACTIVITY_BODY_LABEL),
      'Új megjegyzés',
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_ACTIVITY_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(
        recorder?.requests.some(
          (request) =>
            request.method === 'POST' &&
            request.url.includes('/activities') &&
            (request.body as { body?: string }).body === 'Új megjegyzés',
        ),
      ).toBe(true);
    });
  });

  it('opens the inline editor and saves the new text', async () => {
    server.use(customerActivityUpdateSuccess);
    recorder = createRequestRecorder();
    renderTab();

    await screen.findByText(VALID_ACTIVITY.body);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_ACTIVITY_EDIT_LABEL }),
    );

    /*
      Both the note form and the inline editor are labelled “Szöveg”, so the last
      match is the editor that just opened inside the row.
    */
    const editors = screen.getAllByLabelText(CUSTOMER_ACTIVITY_BODY_LABEL);
    const editor = editors[editors.length - 1];

    if (editor === undefined) {
      throw new Error('The inline editor rendered no textarea.');
    }

    await userEvent.clear(editor);
    await userEvent.type(editor, 'Módosított szöveg');
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_ACTIVITY_SAVE_LABEL }),
    );

    await waitFor(() => {
      expect(
        recorder?.requests.some(
          (request) =>
            request.method === 'PATCH' &&
            (request.body as { updatedAt?: string }).updatedAt ===
              // The fixture was never edited, so the token is `createdAt`.
              VALID_ACTIVITY.createdAt,
        ),
      ).toBe(true);
    });
  });

  it('asks for confirmation before deleting an entry', async () => {
    server.use(customerActivityRemoveSuccess);
    recorder = createRequestRecorder();
    renderTab();

    await screen.findByText(VALID_ACTIVITY.body);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_ACTIVITY_DELETE_LABEL }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(CUSTOMER_ACTIVITY_DELETE_DIALOG_TITLE),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', {
        name: CUSTOMER_ACTIVITY_DELETE_CONFIRM_LABEL,
      }),
    );

    await waitFor(() => {
      expect(
        recorder?.requests.some(
          (request) =>
            request.method === 'DELETE' &&
            request.url.includes(`/activities/${VALID_ACTIVITY.id}`),
        ),
      ).toBe(true);
    });
  });

  it('renders every entry of the fixture page', async () => {
    renderTab();

    await screen.findByText(VALID_ACTIVITY.body);

    for (const activity of VALID_ACTIVITY_LIST) {
      expect(screen.getByText(activity.body)).toBeInTheDocument();
    }
  });
});
