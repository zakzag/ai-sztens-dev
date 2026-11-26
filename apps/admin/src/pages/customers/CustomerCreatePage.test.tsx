/**
 * Tests of the create wizard (AIS-19 shell, AIS-182 steps and submit).
 *
 * Four facts are proved here:
 *
 * 1. the **step lives in the URL** (`?step=`), so a reload, the back button and a
 *    copied link land on the same step, and an invalid value falls back to `1`;
 * 2. the **draft lives in the page store**, which is what makes it survive a trip
 *    to another step and back — the reason the store exists at all;
 * 3. the step strip only unlocks what the draft already allows, so nothing can be
 *    filled in out of order;
 * 4. the submit sends **exactly one** `POST /api/admin/customers` (`D-W6`) and
 *    lands on `/customers/:id?tab=contacts`, while a failure is routed to the step
 *    that owns the blamed input (`D8`).
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CUSTOMERS_PATH, VALID_CUSTOMER } from '@callback/shared';
import { CUSTOMER_TYPE_LABELS } from '../../entities/customer/customer.const.js';
import { CUSTOMER_DETAIL_FIELD_LABELS } from '../../entities/customer/customer.const.js';
import { CUSTOMER_TAX_NUMBER_FIELD_MESSAGE } from '../../lib/error-message.const.js';
import {
  LOCATION_PROBE_TEST_ID,
  LocationProbe,
} from '../../test/mocks/location-probe.mock.js';
import { createRequestRecorder } from '../../test/mocks/request-recorder.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { server } from '../../test/mocks/server.js';
import {
  customersCreateServerError,
  customersCreateSuccess,
  customersCreateTaxConflict,
} from '../../test/mocks/handlers/customers.handlers.js';
import {
  CUSTOMERS_LIST_ROUTE_PATH,
  CUSTOMERS_WIZARD_CANCEL_LABEL,
  CUSTOMERS_WIZARD_FORM_ERROR_TITLE,
  CUSTOMERS_WIZARD_INCOMPLETE_TITLE,
  CUSTOMERS_WIZARD_NEXT_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_SUBMIT_LABEL,
  CUSTOMERS_WIZARD_TITLE,
} from './customers.const.js';
import { CustomerCreatePage } from './CustomerCreatePage.js';

/** Path the wizard is mounted at. */
const CREATE_ENTRY = '/customers/new';

/**
 * @param entry - the URL the memory router starts at.
 * @returns the render result plus the current-URL reader.
 */
function renderWizard(entry: string = CREATE_ENTRY) {
  const utils = renderWithProviders(
    <>
      <CustomerCreatePage />
      <LocationProbe />
    </>,
    { initialEntries: [entry] },
  );

  const location = (): string =>
    screen.getByTestId(LOCATION_PROBE_TEST_ID).textContent ?? '';

  return { ...utils, location };
}

/**
 * Walks the wizard from step 1 to the review step with the smallest valid draft.
 *
 * Typing into the real inputs (rather than seeding the store) is what proves the
 * per-step forms write into the draft and that each *Tovább* validates first.
 */
async function reachReviewStep(): Promise<void> {
  await userEvent.click(
    screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
  );
  await userEvent.click(
    screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
  );

  const legalName = await screen.findByLabelText(
    CUSTOMER_DETAIL_FIELD_LABELS.legalName,
  );

  await userEvent.type(legalName, 'Acme Kft.');
  await userEvent.click(
    screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
  );

  await screen.findByLabelText(CUSTOMER_DETAIL_FIELD_LABELS.zip);
  await userEvent.click(
    screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
  );

  await screen.findByRole('button', { name: CUSTOMERS_WIZARD_SUBMIT_LABEL });
}

describe('CustomerCreatePage', () => {
  it('renders the page title and all four steps of the strip', () => {
    renderWizard();

    expect(
      screen.getByRole('heading', { name: CUSTOMERS_WIZARD_TITLE }),
    ).toBeInTheDocument();

    for (const title of Object.values(CUSTOMERS_WIZARD_STEP_TITLES)) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
  });

  it('marks the first step as the current one on a bare URL', () => {
    renderWizard();

    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('reads the active step from the URL', () => {
    renderWizard(`${CREATE_ENTRY}?step=3`);

    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['3'] }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('falls back to the first step for an invalid step value', () => {
    renderWizard(`${CREATE_ENTRY}?step=9`);

    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('disables the steps the draft does not unlock yet', () => {
    renderWizard();

    for (const step of ['2', '3', '4'] as const) {
      expect(
        screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES[step] }),
      ).toBeDisabled();
    }
  });

  it('writes the chosen step to the URL once the draft unlocks it', async () => {
    const { location } = renderWizard();

    await userEvent.click(
      screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );

    await waitFor(() => {
      expect(location()).toBe(`${CREATE_ENTRY}?step=2`);
    });
  });

  it('keeps the chosen type in the store across a step change', async () => {
    renderWizard();

    await userEvent.click(
      screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
    );
    expect(
      screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
    ).toBeChecked();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    );

    // The value came back from the page store, not from a remounted form.
    expect(
      screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
    ).toBeChecked();
  });

  it('does not leave step 1 without a chosen type', async () => {
    const { location } = renderWizard();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(CREATE_ENTRY);
    });
    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('does not leave step 2 without a legal name', async () => {
    const { location } = renderWizard(`${CREATE_ENTRY}?step=2`);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(`${CREATE_ENTRY}?step=2`);
    });
  });

  it('keeps the name written on step 2 when the operator goes back', async () => {
    renderWizard();

    await userEvent.click(
      screen.getByLabelText(CUSTOMER_TYPE_LABELS.sole_proprietor),
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
    );

    const legalName = await screen.findByLabelText(
      CUSTOMER_DETAIL_FIELD_LABELS.legalName,
    );

    await userEvent.type(legalName, 'Acme Kft.');
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_NEXT_LABEL }),
    );
    await screen.findByLabelText(CUSTOMER_DETAIL_FIELD_LABELS.zip);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );

    // The step body was remounted, so the value can only come from the draft.
    expect(
      await screen.findByLabelText(CUSTOMER_DETAIL_FIELD_LABELS.legalName),
    ).toHaveValue('Acme Kft.');
  });

  it('summarises the draft on the review step', async () => {
    renderWizard();

    await reachReviewStep();

    expect(screen.getByText('Acme Kft.')).toBeInTheDocument();
  });

  it('warns instead of offering a submit for an incomplete draft', () => {
    renderWizard(`${CREATE_ENTRY}?step=4`);

    expect(screen.getByText(CUSTOMERS_WIZARD_INCOMPLETE_TITLE)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: CUSTOMERS_WIZARD_SUBMIT_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('creates the customer with exactly one request and opens the contacts tab', async () => {
    server.use(customersCreateSuccess);
    const recorder = createRequestRecorder();
    const { location } = renderWizard();

    await reachReviewStep();
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(
        `/customers/${VALID_CUSTOMER.id}?tab=contacts`,
      );
    });

    const createRequests = recorder.requests.filter(
      (request) =>
        request.method === 'POST' && request.url.includes(CUSTOMERS_PATH),
    );

    // The `D-W6` guarantee: one body, one request — a second call would be a
    // second customer.
    expect(createRequests).toHaveLength(1);
    expect(createRequests[0]?.body).toMatchObject({
      type: 'sole_proprietor',
      legalName: 'Acme Kft.',
    });

    recorder.stop();
  });

  it('sends a duplicate tax number back to step 2 with the field message', async () => {
    server.use(customersCreateTaxConflict);
    const { location } = renderWizard();

    await reachReviewStep();
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_SUBMIT_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(`${CREATE_ENTRY}?step=2`);
    });
    expect(
      await screen.findByText(CUSTOMER_TAX_NUMBER_FIELD_MESSAGE),
    ).toBeInTheDocument();
  });

  it('keeps an unexplainable failure on the review step as an alert', async () => {
    server.use(customersCreateServerError);
    const { location } = renderWizard();

    await reachReviewStep();
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_SUBMIT_LABEL }),
    );

    expect(
      await screen.findByText(CUSTOMERS_WIZARD_FORM_ERROR_TITLE),
    ).toBeInTheDocument();
    expect(location()).toBe(`${CREATE_ENTRY}?step=4`);
  });

  it('cancels back to the list', async () => {
    const { location } = renderWizard();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_CANCEL_LABEL }),
    );

    await waitFor(() => {
      expect(location()).toBe(CUSTOMERS_LIST_ROUTE_PATH);
    });
  });
});
