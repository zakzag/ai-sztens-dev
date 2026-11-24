/**
 * Tests of the create wizard shell (AIS-19).
 *
 * Two things are proved here: the step lives in the **URL** (so a reload and the
 * back button work), and step 1's value lives in the **page store** (so it
 * survives a trip to another step and back) — that round trip is what justifies
 * the store's existence.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CUSTOMERS_LIST_ROUTE_PATH,
  CUSTOMERS_WIZARD_CANCEL_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_TITLE,
} from './customers.const.js';
import {
  LOCATION_PROBE_TEST_ID,
  LocationProbe,
} from '../../test/mocks/location-probe.mock.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
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

  it('writes the chosen step to the URL', async () => {
    const { location } = renderWizard();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );

    await waitFor(() => {
      expect(location()).toBe(`${CREATE_ENTRY}?step=2`);
    });
  });

  it('keeps the chosen type in the store across a step change', async () => {
    renderWizard();

    await userEvent.click(screen.getByLabelText('Egyéni vállalkozó'));
    expect(screen.getByLabelText('Egyéni vállalkozó')).toBeChecked();

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    );

    // The value came back from the page store, not from a remounted form.
    expect(screen.getByLabelText('Egyéni vállalkozó')).toBeChecked();
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
