/**
 * Tests of the customer detail page (AIS-20).
 *
 * Every assertion is about what the operator sees or about the URL the page
 * wrote: the tab is URL state, so “the tab reached the URL” is the real proof,
 * not the fact that a button was clicked.
 *
 * The page is mounted through a real `<Routes>` with its registry path, so
 * `useParams` supplies the id exactly as it does in the application.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import {
  VALID_ACTIVITY,
  VALID_AUDIT_LOG,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
} from '@callback/shared';
import { CUSTOMER_DETAIL_GROUP_TITLES } from '../../entities/customer/customer.const.js';
import { PAGE_ERROR_RETRY_LABEL } from '../../lib/error-surface.const.js';
import {
  LOCATION_PROBE_TEST_ID,
  LocationProbe,
} from '../../test/mocks/location-probe.mock.js';
import { renderWithProviders } from '../../test/mocks/render-with-providers.js';
import { server } from '../../test/mocks/server.js';
import {
  customersDetailNotFound,
  customersDetailServerError,
  customersDetailSuccess,
} from '../../test/mocks/handlers/customers.handlers.js';
import { CustomerDetailPage } from './CustomerDetailPage.js';
import {
  CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL,
  CUSTOMER_DETAIL_EDIT_LABEL,
  CUSTOMER_DETAIL_ERROR_TITLE,
  CUSTOMER_DETAIL_LOADING_MESSAGE,
  CUSTOMER_DETAIL_NOT_FOUND_TITLE,
  CUSTOMER_DETAIL_ROUTE_PATH,
  CUSTOMER_DETAIL_TABS,
  CUSTOMER_USERS_INVITE_LABEL,
} from './customers.const.js';
import type { CustomerTab } from './customers.interface.js';

const DETAIL_ENTRY = `/customers/${VALID_CUSTOMER_DETAIL.id}`;

/**
 * @param value - the `?tab=` value.
 * @returns the visible label the constant maps it to.
 */
function labelOf(value: CustomerTab): string {
  return CUSTOMER_DETAIL_TABS.find((tab) => tab.value === value)?.label ?? '';
}

/**
 * @param entry - the URL the memory router starts at.
 * @returns the render result plus the current-URL reader.
 */
function renderPage(entry: string = DETAIL_ENTRY) {
  const utils = renderWithProviders(
    <>
      <Routes>
        <Route
          path={CUSTOMER_DETAIL_ROUTE_PATH}
          element={<CustomerDetailPage />}
        />
      </Routes>
      <LocationProbe />
    </>,
    { initialEntries: [entry] },
  );

  const location = (): string =>
    screen.getByTestId(LOCATION_PROBE_TEST_ID).textContent ?? '';

  return { ...utils, location };
}

describe('CustomerDetailPage', () => {
  it('announces the load and shows the neutral page title meanwhile', () => {
    renderPage();

    expect(screen.getByText(CUSTOMER_DETAIL_LOADING_MESSAGE)).toBeInTheDocument();
  });

  it('renders the header and the default tab on success', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(VALID_CUSTOMER.customerNumber)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: labelOf('overview') }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders the write actions next to the status badge', async () => {
    // AIS-21 took over the `actions` slot: the badge stays, and the edit link plus
    // the status/archive menu join it.
    renderPage();

    await screen.findByRole('heading', {
      level: 1,
      name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
    });

    expect(
      screen.getByRole('link', { name: CUSTOMER_DETAIL_EDIT_LABEL }),
    ).toHaveAttribute('href', `/customers/${VALID_CUSTOMER_DETAIL.id}/edit`);
    expect(
      screen.getByRole('button', { name: CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL }),
    ).toBeInTheDocument();
  });

  it('renders the not-found copy instead of a generic error', async () => {
    server.use(customersDetailNotFound);

    renderPage();

    expect(
      await screen.findByText(CUSTOMER_DETAIL_NOT_FOUND_TITLE),
    ).toBeInTheDocument();
    expect(screen.queryByText(CUSTOMER_DETAIL_ERROR_TITLE)).not.toBeInTheDocument();
  });

  it('renders the page error state on a 500 and recovers on retry', async () => {
    server.use(customersDetailServerError);

    renderPage();

    expect(await screen.findByText(CUSTOMER_DETAIL_ERROR_TITLE)).toBeInTheDocument();

    server.use(customersDetailSuccess);

    await userEvent.click(
      screen.getByRole('button', { name: PAGE_ERROR_RETRY_LABEL }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
      }),
    ).toBeInTheDocument();
  });

  it('opens the tab named by the URL', async () => {
    renderPage(`${DETAIL_ENTRY}?tab=data`);

    expect(
      await screen.findByText(CUSTOMER_DETAIL_GROUP_TITLES.identifiers),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: labelOf('data') }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('writes a tab change into the URL in one navigation', async () => {
    const { location } = renderPage();

    await screen.findByRole('heading', {
      level: 1,
      name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
    });

    await userEvent.click(
      screen.getByRole('button', { name: labelOf('users') }),
    );

    await waitFor(() => {
      expect(location()).toContain('tab=users');
    });
    expect(location()).toBe(`/customers/${VALID_CUSTOMER_DETAIL.id}?tab=users`);
    // AIS-179: the `users` tab is a real tab now — its invite CTA is the marker.
    expect(
      screen.getByRole('link', { name: CUSTOMER_USERS_INVITE_LABEL }),
    ).toBeInTheDocument();
  });

  it('falls back to the default tab for an unknown value', async () => {
    renderPage(`${DETAIL_ENTRY}?tab=nonsense`);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: VALID_CUSTOMER.shortName ?? VALID_CUSTOMER.legalName,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: labelOf('overview') }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders the activity feed on `?tab=activity` (AIS-181)', async () => {
    renderPage(`${DETAIL_ENTRY}?tab=activity`);

    expect(await screen.findByText(VALID_ACTIVITY.body)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: labelOf('activity') }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders the audit ledger on `?tab=audit` (AIS-181)', async () => {
    renderPage(`${DETAIL_ENTRY}?tab=audit`);

    expect(await screen.findByText(VALID_AUDIT_LOG.actorName)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: labelOf('audit') }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('drops the paged list state when the tab changes (AIS-181)', async () => {
    const { location } = renderPage(
      `${DETAIL_ENTRY}?tab=activity&page=3&limit=50`,
    );

    await screen.findByText(VALID_ACTIVITY.body);

    await userEvent.click(screen.getByRole('button', { name: labelOf('audit') }));

    await waitFor(() => {
      expect(location()).toContain('tab=audit');
    });

    // One write: the new tab, and none of the `activity` tab's paging keys.
    expect(location()).toBe(`${DETAIL_ENTRY}?tab=audit`);
  });

  it('keeps `?tab=` when the feed is paged (AIS-181)', async () => {
    const { location } = renderPage(`${DETAIL_ENTRY}?tab=activity&page=3`);

    await screen.findByText(VALID_ACTIVITY.body);

    // The tab is still `activity` — the paged read did not rewrite the URL.
    expect(location()).toContain('tab=activity');
    expect(location()).toContain('page=3');
  });
});
