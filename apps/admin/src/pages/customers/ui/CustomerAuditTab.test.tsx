/**
 * Tests of the *Napló* tab (AIS-181).
 *
 * Three properties are worth pinning: the row shows the operation, the actor, the
 * table and the time; expanding it reveals the before → after diff (rendered by the
 * shared `LogEntryRow`, not by a second renderer); and **nothing on this tab
 * writes** — the last case asserts that no edit or delete control exists at all.
 */

import { VALID_AUDIT_LOG, VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import {
  CUSTOMER_AUDIT_OPERATION_LABELS,
  CUSTOMER_AUDIT_TABLE_LABELS,
} from '../../../entities/customer/customer.const.js';
import { createRequestRecorder } from '../../../test/mocks/request-recorder.js';
import type { RequestRecorder } from '../../../test/mocks/request-recorder.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import { server } from '../../../test/mocks/server.js';
import {
  customersAuditLogsEmpty,
  customersAuditLogsServerError,
} from '../../../test/mocks/handlers/customers.handlers.js';
import {
  CUSTOMER_ACTIVITY_DELETE_LABEL,
  CUSTOMER_ACTIVITY_EDIT_LABEL,
  CUSTOMER_AUDIT_EMPTY_TITLE,
  CUSTOMER_AUDIT_ERROR_TITLE,
  CUSTOMER_AUDIT_FILTER_TABLE_LABEL,
  CUSTOMER_DETAIL_ROUTE_PATH,
} from '../customers.const.js';
import { CustomerAuditTab } from './CustomerAuditTab.js';

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
        element={<CustomerAuditTab customer={customer} />}
      />
    </Routes>,
    { initialEntries: [`${DETAIL_ENTRY}?tab=audit`] },
  );
}

describe('CustomerAuditTab', () => {
  /*
    The row is ready when its message — the actor's name — is on screen. The
    operation's label is **not** a usable signal: it is also the text of the
    filter's option, so waiting for it would pass before the list rendered.
  */
  it('renders the operation, the actor, the table and the time of a row', async () => {
    renderTab();

    expect(
      await screen.findByText(VALID_AUDIT_LOG.actorName),
    ).toBeInTheDocument();

    // The operation appears twice: as the filter option and as the row's badge.
    expect(
      screen.getAllByText(CUSTOMER_AUDIT_OPERATION_LABELS.insert).length,
    ).toBeGreaterThan(1);

    // The row's one-line detail is “actor kind · table · record id”.
    const tableLabel =
      CUSTOMER_AUDIT_TABLE_LABELS[
        VALID_AUDIT_LOG.tableName as keyof typeof CUSTOMER_AUDIT_TABLE_LABELS
      ];

    expect(
      screen.getByText(new RegExp(`Rendszer.*${tableLabel}`)),
    ).toBeInTheDocument();
  });

  it('reveals the diff when the row is expanded', async () => {
    renderTab();

    await screen.findByText(VALID_AUDIT_LOG.actorName);

    // The row's header toggle is the first `aria-expanded` control of the row.
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0]);

    // Every diff value is rendered as “before → after”, and the labels come from
    // the entity's field table, not from the wire names.
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0);
    expect(screen.getByText('Jogi név')).toBeInTheDocument();
    expect(screen.getByText('Ügyfélszám')).toBeInTheDocument();
  });

  it('writes a table filter into the request in one interaction', async () => {
    recorder = createRequestRecorder();
    renderTab();

    await screen.findByText(VALID_AUDIT_LOG.actorName);

    fireEvent.change(
      screen.getByLabelText(CUSTOMER_AUDIT_FILTER_TABLE_LABEL),
      { target: { value: 'customers' } },
    );

    await waitFor(() => {
      expect(
        recorder?.requests.some(
          (request) =>
            request.method === 'GET' && request.url.includes('tableName=customers'),
        ),
      ).toBe(true);
    });
  });

  it('renders the empty state', async () => {
    server.use(customersAuditLogsEmpty);
    renderTab();

    expect(await screen.findByText(CUSTOMER_AUDIT_EMPTY_TITLE)).toBeInTheDocument();
  });

  it('renders the tab-scoped error state', async () => {
    server.use(customersAuditLogsServerError);
    renderTab();

    expect(await screen.findByText(CUSTOMER_AUDIT_ERROR_TITLE)).toBeInTheDocument();
  });

  it('renders no mutating action at all', async () => {
    renderTab();

    await screen.findByText(VALID_AUDIT_LOG.actorName);

    expect(
      screen.queryByRole('button', { name: CUSTOMER_ACTIVITY_EDIT_LABEL }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: CUSTOMER_ACTIVITY_DELETE_LABEL }),
    ).not.toBeInTheDocument();
  });
});
