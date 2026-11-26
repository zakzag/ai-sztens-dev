/**
 * Tests of the customer edit page (AIS-21).
 *
 * The page is mounted through a real `<Routes>` on the template the registry
 * mounts, so `useParams` supplies the id exactly as it does in the application,
 * and the detail route is mounted next to it so a navigation can be observed.
 *
 * Every write assertion is about either what the operator sees or what left the
 * browser: the request body is read from the MSW recorder (there is no service
 * double), which is the only place that fact lives.
 *
 * The heading is rendered by the shell **before** the record arrives, so every
 * interaction waits for the first input instead — that is what proves the form
 * itself is mounted.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { CUSTOMER_DETAIL_FIELD_LABELS } from '../../entities/customer/customer.const.js';
import {
  CUSTOMER_TAX_NUMBER_FIELD_MESSAGE,
  FIELD_INVALID_MESSAGE,
} from '../../lib/error-message.const.js';
import { PAGE_ERROR_RETRY_LABEL } from '../../lib/error-surface.const.js';
import {
  LOCATION_PROBE_TEST_ID,
  LocationProbe,
} from '../../test/mocks/location-probe.mock.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { server } from '../../test/mocks/server.js';
import {
  customersDetailNotFound,
  customersDetailServerError,
  customersDetailSuccess,
  customersUpdateServerError,
  customersUpdateStaleWrite,
  customersUpdateSuccess,
  customersUpdateTaxConflict,
  customersUpdateValidationError,
} from '../../test/mocks/handlers/customers.handlers.js';
import { CustomerEditPage } from './CustomerEditPage.js';
import {
  CUSTOMER_DETAIL_NOT_FOUND_TITLE,
  CUSTOMER_DETAIL_ROUTE_PATH,
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_EDIT_ERROR_TITLE,
  CUSTOMER_EDIT_LOADING_MESSAGE,
  CUSTOMER_EDIT_PAGE_TITLE,
  CUSTOMER_EDIT_ROUTE_PATH,
  CUSTOMER_EDIT_SECTION_TITLES,
  CUSTOMER_EDIT_STALE_RELOAD_LABEL,
  CUSTOMER_EDIT_STALE_TITLE,
  CUSTOMER_EDIT_SUBMIT_LABEL,
} from './customers.const.js';

const CUSTOMER_ID = VALID_CUSTOMER_DETAIL.id;
const EDIT_ENTRY = `/customers/${CUSTOMER_ID}/edit`;
const DETAIL_ENTRY = `/customers/${CUSTOMER_ID}`;

/**
 * @param entry - the URL the memory router starts at.
 * @returns the render result plus the current-URL reader.
 */
function renderPage(entry: string = EDIT_ENTRY) {
  const utils = renderWithProviders(
    <>
      <Routes>
        <Route path={CUSTOMER_EDIT_ROUTE_PATH} element={<CustomerEditPage />} />
        <Route path={CUSTOMER_DETAIL_ROUTE_PATH} element={<p>detail page</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { initialEntries: [entry] },
  );

  const location = (): string =>
    screen.getByTestId(LOCATION_PROBE_TEST_ID).textContent ?? '';

  return { ...utils, location };
}

/**
 * Waits until the form itself is mounted (the shell renders its heading earlier).
 *
 * @returns the first input of the form.
 */
async function waitForForm(): Promise<HTMLElement> {
  return screen.findByLabelText(CUSTOMER_DETAIL_FIELD_LABELS.legalName);
}

/**
 * @param label - the visible label of one contract field.
 * @returns the labelled control.
 */
function field(label: string): HTMLElement {
  return screen.getByLabelText(label);
}

describe('CustomerEditPage', () => {
  it('announces the load before the record arrives', () => {
    renderPage();

    expect(screen.getByText(CUSTOMER_EDIT_LOADING_MESSAGE)).toBeInTheDocument();
  });

  it('renders the four sections and the record values on success', async () => {
    const { container } = renderPage();

    await waitForForm();

    expect(
      screen.getByRole('heading', { level: 1, name: CUSTOMER_EDIT_PAGE_TITLE }),
    ).toBeInTheDocument();

    // The legends are read from the DOM as a list, because one of them (`Cím`)
    // is also the label of the address-line input — a text query would be
    // ambiguous, and the order is part of the layout contract anyway.
    const legends = Array.from(container.querySelectorAll('legend')).map(
      (legend) => legend.textContent,
    );

    expect(legends).toEqual(Object.values(CUSTOMER_EDIT_SECTION_TITLES));

    expect(field(CUSTOMER_DETAIL_FIELD_LABELS.legalName)).toHaveValue(
      VALID_CUSTOMER_DETAIL.legalName,
    );
    expect(field(CUSTOMER_DETAIL_FIELD_LABELS.city)).toHaveValue(
      VALID_CUSTOMER_DETAIL.registeredAddressCity ?? '',
    );
  });

  it('renders no input for a read-only-by-contract field', async () => {
    renderPage();

    await waitForForm();

    // The customer number is shown (as part of the summary) but is not editable:
    // `updateCustomerSchema` is `.strict()` and would reject it.
    expect(
      screen.getByText(VALID_CUSTOMER_DETAIL.customerNumber),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(CUSTOMER_DETAIL_FIELD_LABELS.customerNumber),
    ).not.toBeInTheDocument();
  });

  it('shows its own not-found copy instead of a generic error', async () => {
    server.use(customersDetailNotFound);

    renderPage();

    expect(
      await screen.findByText(CUSTOMER_DETAIL_NOT_FOUND_TITLE),
    ).toBeInTheDocument();
    expect(screen.queryByText(CUSTOMER_EDIT_ERROR_TITLE)).not.toBeInTheDocument();
  });

  it('renders the page error on a 500 and recovers on retry', async () => {
    server.use(customersDetailServerError);

    renderPage();

    expect(await screen.findByText(CUSTOMER_EDIT_ERROR_TITLE)).toBeInTheDocument();

    server.use(customersDetailSuccess);

    await userEvent.click(
      screen.getByRole('button', { name: PAGE_ERROR_RETRY_LABEL }),
    );

    expect(await waitForForm()).toBeInTheDocument();
  });

  it('saves the record with the concurrency token and returns to the detail page', async () => {
    server.use(customersUpdateSuccess);
    const recorder = createRequestRecorder();

    const { location } = renderPage();

    const legalName = await waitForForm();

    await userEvent.clear(legalName);
    await userEvent.type(legalName, 'Új Név Kft.');

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(DETAIL_ENTRY);
    });

    await waitFor(() => {
      expect(recorder.requests.some((request) => request.method === 'PATCH')).toBe(
        true,
      );
    });

    const patch = recorder.requests.find((request) => request.method === 'PATCH');

    expect(patch?.url).toContain(`/api/admin/customers/${CUSTOMER_ID}`);
    expect(patch?.body).toMatchObject({
      legalName: 'Új Név Kft.',
      updatedAt: VALID_CUSTOMER_DETAIL.updatedAt,
    });

    recorder.stop();
  });

  it('cancels back to the detail page without a request', async () => {
    const recorder = createRequestRecorder();

    const { location } = renderPage();

    await waitForForm();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_CANCEL_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(DETAIL_ENTRY);
    });

    expect(recorder.requests.some((request) => request.method === 'PATCH')).toBe(
      false,
    );

    recorder.stop();
  });

  it('puts a 422 issue on the input it names', async () => {
    server.use(customersUpdateValidationError);

    renderPage();

    await waitForForm();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
    );

    expect(await screen.findByText(FIELD_INVALID_MESSAGE)).toBeInTheDocument();
  });

  it('puts a tax-number conflict on the tax-number input', async () => {
    server.use(customersUpdateTaxConflict);

    renderPage();

    await waitForForm();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
    );

    expect(
      await screen.findByText(CUSTOMER_TAX_NUMBER_FIELD_MESSAGE),
    ).toBeInTheDocument();
  });

  it('answers a stale write with a page-level notice and a reload action', async () => {
    server.use(customersUpdateStaleWrite);

    renderPage();

    await waitForForm();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
    );

    expect(await screen.findByText(CUSTOMER_EDIT_STALE_TITLE)).toBeInTheDocument();

    // The reload re-reads the record; the notice disappears instead of staying
    // next to inputs that now show the newer version.
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_STALE_RELOAD_LABEL }),
    );

    await waitFor(() => {
      expect(screen.queryByText(CUSTOMER_EDIT_STALE_TITLE)).not.toBeInTheDocument();
    });
  });

  it('keeps the form open on a 500 and reports the failure', async () => {
    server.use(customersUpdateServerError);

    renderPage();

    await waitForForm();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: CUSTOMER_EDIT_SUBMIT_LABEL }),
      ).toBeEnabled();
    });

    // The form is still there — a failed write never unmounts the operator's work.
    expect(field(CUSTOMER_DETAIL_FIELD_LABELS.legalName)).toBeInTheDocument();
  });
});
