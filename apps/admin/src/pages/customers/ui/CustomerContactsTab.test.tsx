/**
 * Tests of the *Kapcsolattartók* tab (AIS-179).
 *
 * The tab owns no read, so the assertions are about what the mapped view model
 * becomes on screen: the role badges, the “belépő” marker, the edit link's target,
 * the empty state with its CTA and the archive confirmation.
 */

import { VALID_CUSTOMER_DETAIL } from '@callback/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  CONTACT_ROLE_LABELS,
  CUSTOMER_CONTACT_NO_ROLE_LABEL,
} from '../../../entities/customer/customer.const.js';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import {
  CUSTOMER_CONTACTS_CREATE_LABEL,
  CUSTOMER_CONTACTS_EMPTY_TITLE,
  CUSTOMER_CONTACT_ARCHIVE_CONFIRM_TITLE,
  CUSTOMER_CONTACT_ARCHIVE_LABEL,
  CUSTOMER_CONTACT_EDIT_LABEL,
  CUSTOMER_DETAIL_ROUTE_PATH,
  toCustomerContactCreateRoute,
  toCustomerContactEditRoute,
} from '../customers.const.js';
import { CustomerContactsTab } from './CustomerContactsTab.js';

/** The detail entry the tab is mounted under. */
const DETAIL_ENTRY = `/customers/${VALID_CUSTOMER_DETAIL.id}`;

/**
 * @param contacts - the contact list to render; defaults to the fixture's two.
 * @returns the render result.
 */
function renderTab(
  contacts = VALID_CUSTOMER_DETAIL.contacts,
): ReturnType<typeof renderWithProviders> {
  const customer = toCustomerDetailViewModel({
    ...VALID_CUSTOMER_DETAIL,
    contacts,
  });

  return renderWithProviders(
    <Routes>
      <Route
        path={CUSTOMER_DETAIL_ROUTE_PATH}
        element={<CustomerContactsTab customer={customer} />}
      />
    </Routes>,
    { initialEntries: [`${DETAIL_ENTRY}?tab=contacts`] },
  );
}

describe('CustomerContactsTab', () => {
  it('renders one row per contact with its name', () => {
    renderTab();

    for (const contact of VALID_CUSTOMER_DETAIL.contacts) {
      expect(screen.getByText(contact.name)).toBeInTheDocument();
    }
  });

  it('renders every role as a badge', () => {
    renderTab([{ ...VALID_CUSTOMER_DETAIL.contacts[0], roles: ['primary'] }]);

    expect(screen.getByText(CONTACT_ROLE_LABELS.primary)).toBeInTheDocument();
  });

  it('shows the no-role copy for a contact without roles', () => {
    renderTab([{ ...VALID_CUSTOMER_DETAIL.contacts[0], roles: [] }]);

    expect(screen.getByText(CUSTOMER_CONTACT_NO_ROLE_LABEL)).toBeInTheDocument();
  });

  it('links the create CTA to the create overlay', () => {
    renderTab();

    expect(
      screen.getByRole('link', { name: CUSTOMER_CONTACTS_CREATE_LABEL }),
    ).toHaveAttribute('href', toCustomerContactCreateRoute(VALID_CUSTOMER_DETAIL.id));
  });

  it('links every row action to its own edit overlay', () => {
    renderTab([VALID_CUSTOMER_DETAIL.contacts[0]]);

    expect(
      screen.getByRole('link', { name: CUSTOMER_CONTACT_EDIT_LABEL }),
    ).toHaveAttribute(
      'href',
      toCustomerContactEditRoute(
        VALID_CUSTOMER_DETAIL.id,
        VALID_CUSTOMER_DETAIL.contacts[0].id,
      ),
    );
  });

  it('renders the empty state with the create CTA when there are no contacts', () => {
    renderTab([]);

    expect(screen.getByText(CUSTOMER_CONTACTS_EMPTY_TITLE)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: CUSTOMER_CONTACTS_CREATE_LABEL }).length,
    ).toBeGreaterThan(0);
  });

  it('asks for confirmation before archiving a contact', async () => {
    renderTab([VALID_CUSTOMER_DETAIL.contacts[0]]);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMER_CONTACT_ARCHIVE_LABEL }),
    );

    expect(
      screen.getByText(CUSTOMER_CONTACT_ARCHIVE_CONFIRM_TITLE),
    ).toBeInTheDocument();
  });
});
