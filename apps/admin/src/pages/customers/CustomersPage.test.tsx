/**
 * Tests of the customers list page (AIS-19).
 *
 * Every assertion is made against what the operator sees or against the URL the
 * page wrote — the URL is the state owner for lists, so “the filter reached the
 * URL” is the real proof, not the fact that a control changed.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SECOND_CUSTOMER, VALID_CUSTOMER } from '@callback/shared';
import {
  CUSTOMERS_ARCHIVE_CONFIRM_LABEL,
  CUSTOMERS_ARCHIVE_CONFIRM_TITLE,
  CUSTOMERS_CREATE_LABEL,
  CUSTOMERS_EMPTY_TITLE,
  CUSTOMERS_ERROR_TITLE,
  CUSTOMERS_FILTER_LABELS,
  CUSTOMERS_FILTER_RESET_LABEL,
  CUSTOMERS_ROW_ACTIONS,
  CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
} from './customers.const.js';
import {
  LOCATION_PROBE_TEST_ID,
  LocationProbe,
} from '../../test/mocks/location-probe.mock.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { server } from '../../test/mocks/server.js';
import {
  customersArchiveSuccess,
  customersListEmpty,
  customersListServerError,
} from '../../test/mocks/handlers/customers.handlers.js';
import { CustomersPage } from './CustomersPage.js';

/** Path the page under test is mounted at. */
const LIST_ENTRY = '/customers';

/**
 * @param entry - the URL the memory router starts at.
 * @returns the render result plus the current-URL reader.
 */
function renderPage(entry: string = LIST_ENTRY) {
  const utils = renderWithProviders(
    <>
      <CustomersPage />
      <LocationProbe />
    </>,
    { initialEntries: [entry] },
  );

  const location = (): string =>
    screen.getByTestId(LOCATION_PROBE_TEST_ID).textContent ?? '';

  return { ...utils, location };
}

describe('CustomersPage', () => {
  it('renders one row per customer with the mapped cells', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', {
        name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(VALID_CUSTOMER.customerNumber)).toBeInTheDocument();
    expect(screen.getByText(VALID_CUSTOMER.taxNumber ?? '')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: SECOND_CUSTOMER.legalName }),
    ).toBeInTheDocument();
    // The second row is the “missing data” branch: no tax number, no contact.
    expect(screen.getByText('Nincs')).toBeInTheDocument();
  });

  it('offers the create CTA in the header and in the empty state', async () => {
    server.use(customersListEmpty);

    renderPage();

    expect(await screen.findByText(CUSTOMERS_EMPTY_TITLE)).toBeInTheDocument();
    // The header action is a link to the wizard; the empty state's CTA is a
    // button whose accessible name repeats the title (`EmptyState` does that on
    // purpose, so two “Új cég” controls stay distinguishable).
    expect(
      screen.getAllByRole('link', { name: new RegExp(CUSTOMERS_CREATE_LABEL) })
        .length,
    ).toBe(1);
    expect(
      screen.getAllByRole('button', { name: new RegExp(CUSTOMERS_CREATE_LABEL) })
        .length,
    ).toBe(1);
  });

  it('renders the page-level error state and recovers on retry', async () => {
    server.use(customersListServerError);

    renderPage();

    expect(await screen.findByText(CUSTOMERS_ERROR_TITLE)).toBeInTheDocument();

    server.use(customersListEmpty);

    await userEvent.click(screen.getByRole('button', { name: /újra/i }));

    expect(await screen.findByText(CUSTOMERS_EMPTY_TITLE)).toBeInTheDocument();
  });

  it('writes a filter to the URL and resets the page number', async () => {
    const { location } = renderPage(`${LIST_ENTRY}?page=2`);

    await screen.findByText(VALID_CUSTOMER.customerNumber);

    await userEvent.selectOptions(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.type),
      'company',
    );

    await waitFor(() => {
      expect(location()).toContain('type=company');
    });
    expect(location()).not.toContain('page=2');
  });

  it('writes the search term once it settles', async () => {
    const { location } = renderPage();

    await screen.findByText(VALID_CUSTOMER.customerNumber);

    await userEvent.type(
      screen.getByLabelText(CUSTOMERS_FILTER_LABELS.search),
      'példa',
    );

    await waitFor(() => {
      expect(location()).toContain('q=p%C3%A9lda');
    });
  });

  it('clears every filter in one reset', async () => {
    const { location } = renderPage(
      `${LIST_ENTRY}?type=company&status=active&q=pelda`,
    );

    await screen.findByText(VALID_CUSTOMER.customerNumber);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_FILTER_RESET_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(LIST_ENTRY);
    });
  });

  it('archives the confirmed row and closes the window', async () => {
    server.use(customersArchiveSuccess);

    renderPage();

    await screen.findByText(VALID_CUSTOMER.customerNumber);

    const triggers = screen.getAllByRole('button', {
      name: CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
    });

    await userEvent.click(triggers[0] as HTMLElement);
    await userEvent.click(
      await screen.findByRole('menuitem', { name: CUSTOMERS_ROW_ACTIONS.archive }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(new RegExp(CUSTOMERS_ARCHIVE_CONFIRM_TITLE)),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', {
        name: CUSTOMERS_ARCHIVE_CONFIRM_LABEL,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
