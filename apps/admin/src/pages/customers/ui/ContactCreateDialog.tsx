/**
 * `/customers/:id/contacts/new` — the contact-create overlay (AIS-179).
 *
 * A **child route** of the detail entry, so it renders into the detail page's
 * `<Outlet/>`, keeps the page mounted behind it and has an address of its own: a
 * reload lands on the same window, and closing it returns to the *Kapcsolattartók*
 * tab (`toCustomerTabRoute`).
 *
 * The component owns the read: the detail payload supplies the customer's login
 * users for the “belépő felhasználó” select (`D-W3` — no separate list request),
 * so the form is mounted only once that payload is there. Only the loading state
 * is handled here; a failure of the read is already rendered by the page behind
 * the window.
 *
 * @returns the overlay, mounted as the `/customers/:id/contacts/new` route element.
 */

import { DescriptionList, EntityDialog } from '@callback/ui';
import { useParams } from 'react-router-dom';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { useCustomerDetail } from '../../../features/customers/use-customer-detail.js';
import {
  CUSTOMER_CONTACT_CREATE_DIALOG_TITLE,
  CUSTOMER_DETAIL_LOADING_MESSAGE,
  CUSTOMER_DETAIL_PARAM,
  toCustomerTabRoute,
} from '../customers.const.js';
import { CustomerContactForm } from './CustomerContactForm.js';

/**
 * @returns the create overlay of one contact.
 */
export function ContactCreateDialog() {
  const params = useParams();
  const customerId = params[CUSTOMER_DETAIL_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(toCustomerTabRoute(customerId, 'contacts'));

  const detail = useCustomerDetail(customerId);
  const data = detail.data;

  if (detail.isLoading || data === null) {
    return (
      <EntityDialog
        title={CUSTOMER_CONTACT_CREATE_DIALOG_TITLE}
        onClose={closeDialog}
        submit={null}
      >
        <p role="status" className="sr-only">
          {CUSTOMER_DETAIL_LOADING_MESSAGE}
        </p>
        <DescriptionList items={[]} isLoading />
      </EntityDialog>
    );
  }

  const viewModel = toCustomerDetailViewModel(data);

  return (
    <CustomerContactForm
      customerId={customerId}
      contact={null}
      customerUsers={viewModel.customerUsers}
      onClose={closeDialog}
      onStaleWrite={detail.refetch}
    />
  );
}
