/**
 * `/customers/:id/users/invite` — the invitation overlay (AIS-179).
 *
 * The simplest of the four overlays: an invitation needs nothing but the customer
 * id from the route, so there is no read here at all — the window is the form.
 * Closing it returns to the *Felhasználók* tab.
 *
 * @returns the invite overlay, mounted as the `/customers/:id/users/invite` route.
 */

import { useParams } from 'react-router-dom';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { CUSTOMER_DETAIL_PARAM, toCustomerTabRoute } from '../customers.const.js';
import { CustomerUserInviteForm } from './CustomerUserInviteForm.js';

/**
 * @returns the invite overlay of one customer.
 */
export function CustomerUserInviteDialog() {
  const params = useParams();
  const customerId = params[CUSTOMER_DETAIL_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(toCustomerTabRoute(customerId, 'users'));

  return <CustomerUserInviteForm customerId={customerId} onClose={closeDialog} />;
}
