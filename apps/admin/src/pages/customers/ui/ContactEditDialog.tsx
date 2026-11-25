/**
 * `/customers/:id/contacts/:contactId/edit` — the contact-edit overlay (AIS-179).
 *
 * A child route of the detail entry: the window has an address, so the URL owns
 * "is it open", and closing returns to the *Kapcsolattartók* tab.
 *
 * The row is read from the **detail** payload that the page already loaded
 * (`D-W3`), which is why there is no second request here — a `404` of the customer
 * is the page's error, and a contact id that is not in the payload is this
 * window's own not-found state.
 *
 * The form is keyed by `contact.updatedAt`: a record re-read after `409
 * STALE_WRITE` remounts it, and that is the only way a new version reaches the
 * inputs (`useAppForm` seeds `defaultValues` on mount).
 *
 * @returns the edit overlay of one contact.
 */

import { DescriptionList, EmptyState, EntityDialog } from '@callback/ui';
import { useParams } from 'react-router-dom';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { useCustomerDetail } from '../../../features/customers/use-customer-detail.js';
import {
  CUSTOMER_CONTACT_NOT_FOUND_MESSAGE,
  CUSTOMER_CONTACT_NOT_FOUND_TITLE,
  CUSTOMER_CONTACT_PARAM,
  CUSTOMER_DETAIL_LOADING_MESSAGE,
  CUSTOMER_DETAIL_PARAM,
  CUSTOMER_EDIT_CANCEL_LABEL,
  toCustomerTabRoute,
} from '../customers.const.js';
import { CustomerContactForm } from './CustomerContactForm.js';

/**
 * @returns the edit overlay of one contact.
 */
export function ContactEditDialog() {
  const params = useParams();
  const customerId = params[CUSTOMER_DETAIL_PARAM] ?? '';
  const contactId = params[CUSTOMER_CONTACT_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(
    toCustomerTabRoute(customerId, 'contacts'),
  );

  const detail = useCustomerDetail(customerId);
  const data = detail.data;

  if (detail.isLoading || data === null) {
    return (
      <EntityDialog
        title={CUSTOMER_CONTACT_NOT_FOUND_TITLE}
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
  const contact =
    viewModel.contacts.find((candidate) => candidate.id === contactId) ?? null;

  if (contact === null) {
    return (
      <EntityDialog
        title={CUSTOMER_CONTACT_NOT_FOUND_TITLE}
        onClose={closeDialog}
        submit={null}
        cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
      >
        <EmptyState
          title={CUSTOMER_CONTACT_NOT_FOUND_TITLE}
          description={CUSTOMER_CONTACT_NOT_FOUND_MESSAGE}
        />
      </EntityDialog>
    );
  }

  return (
    <CustomerContactForm
      key={contact.updatedAt}
      customerId={customerId}
      contact={contact}
      customerUsers={viewModel.customerUsers}
      onClose={closeDialog}
      onStaleWrite={detail.refetch}
    />
  );
}
