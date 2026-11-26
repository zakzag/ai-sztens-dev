/**
 * Tests of the *Felhasználók* tab (AIS-179).
 *
 * The rule that matters most here is `D8`: the revoke action exists **only** on a
 * pending invitation. The tab is rendered from a view model, so the two variants
 * are produced by the mapper from a fixture with the status overridden.
 */

import { VALID_CUSTOMER_DETAIL, VALID_CUSTOMER_USER } from '@callback/shared';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CUSTOMER_USER_ROLE_LABELS } from '../../../entities/customer/customer.const.js';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { renderWithProviders } from '../../../test/mocks/render-with-providers.js';
import {
  CUSTOMER_DETAIL_ROUTE_PATH,
  CUSTOMER_USERS_EMPTY_TITLE,
  CUSTOMER_USERS_INVITE_LABEL,
  CUSTOMER_USER_EDIT_LABEL,
  CUSTOMER_USER_REVOKE_LABEL,
  toCustomerUserEditRoute,
  toCustomerUserInviteRoute,
} from '../customers.const.js';
import { CustomerUsersTab } from './CustomerUsersTab.js';

/** The detail entry the tab is mounted under. */
const DETAIL_ENTRY = `/customers/${VALID_CUSTOMER_DETAIL.id}`;

/**
 * @param customerUsers - the users to render; defaults to the fixture's row.
 * @returns the render result.
 */
function renderTab(
  customerUsers = VALID_CUSTOMER_DETAIL.customerUsers,
): ReturnType<typeof renderWithProviders> {
  const customer = toCustomerDetailViewModel({
    ...VALID_CUSTOMER_DETAIL,
    customerUsers,
  });

  return renderWithProviders(
    <Routes>
      <Route
        path={CUSTOMER_DETAIL_ROUTE_PATH}
        element={<CustomerUsersTab customer={customer} />}
      />
    </Routes>,
    { initialEntries: [`${DETAIL_ENTRY}?tab=users`] },
  );
}

describe('CustomerUsersTab', () => {
  it('renders the name, e-mail and role of the row', () => {
    renderTab([{ ...VALID_CUSTOMER_USER, status: 'active' }]);

    expect(screen.getByText(VALID_CUSTOMER_USER.name)).toBeInTheDocument();
    expect(screen.getByText(VALID_CUSTOMER_USER.email)).toBeInTheDocument();
    expect(
      screen.getByText(CUSTOMER_USER_ROLE_LABELS[VALID_CUSTOMER_USER.role]),
    ).toBeInTheDocument();
  });

  it('links the invite CTA to the invite overlay', () => {
    renderTab();

    expect(
      screen.getByRole('link', { name: CUSTOMER_USERS_INVITE_LABEL }),
    ).toHaveAttribute(
      'href',
      toCustomerUserInviteRoute(VALID_CUSTOMER_DETAIL.id),
    );
  });

  it('offers the edit overlay on an accepted user', () => {
    renderTab([{ ...VALID_CUSTOMER_USER, status: 'active' }]);

    expect(screen.queryByText(CUSTOMER_USER_REVOKE_LABEL)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: CUSTOMER_USER_EDIT_LABEL }),
    ).toHaveAttribute(
      'href',
      toCustomerUserEditRoute(VALID_CUSTOMER_DETAIL.id, VALID_CUSTOMER_USER.id),
    );
  });

  it('offers the revoke action only on a pending invitation', () => {
    renderTab([{ ...VALID_CUSTOMER_USER, status: 'invited' }]);

    expect(
      screen.getByRole('button', { name: CUSTOMER_USER_REVOKE_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: CUSTOMER_USER_EDIT_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('renders the empty state with the invite CTA when there are no users', () => {
    renderTab([]);

    expect(screen.getByText(CUSTOMER_USERS_EMPTY_TITLE)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: CUSTOMER_USERS_INVITE_LABEL }).length,
    ).toBeGreaterThan(0);
  });
});
