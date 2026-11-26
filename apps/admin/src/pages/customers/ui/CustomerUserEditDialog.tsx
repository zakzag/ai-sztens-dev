/**
 * `/customers/:id/users/:userId/edit` — the login-user edit overlay (AIS-179).
 *
 * Reads the row from the detail payload the page already loaded (`D-W3`), keys the
 * form by `user.updatedAt` so a re-read after `409 STALE_WRITE` reaches the
 * inputs, and closes back to the *Felhasználók* tab.
 *
 * @returns the edit overlay of one login user.
 */

import { DescriptionList, EmptyState, EntityDialog } from '@callback/ui';
import { useParams } from 'react-router-dom';
import { toCustomerDetailViewModel } from '../../../entities/customer/customer.mapper.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { useCustomerDetail } from '../../../features/customers/use-customer-detail.js';
import {
  CUSTOMER_DETAIL_LOADING_MESSAGE,
  CUSTOMER_DETAIL_PARAM,
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_USER_NOT_FOUND_MESSAGE,
  CUSTOMER_USER_NOT_FOUND_TITLE,
  CUSTOMER_USER_PARAM,
  toCustomerTabRoute,
} from '../customers.const.js';
import { CustomerUserEditForm } from './CustomerUserEditForm.js';

/**
 * @returns the edit overlay of one login user.
 */
export function CustomerUserEditDialog() {
  const params = useParams();
  const customerId = params[CUSTOMER_DETAIL_PARAM] ?? '';
  const userId = params[CUSTOMER_USER_PARAM] ?? '';
  const { closeDialog } = useEntityDialog(toCustomerTabRoute(customerId, 'users'));

  const detail = useCustomerDetail(customerId);
  const data = detail.data;

  if (detail.isLoading || data === null) {
    return (
      <EntityDialog
        title={CUSTOMER_USER_NOT_FOUND_TITLE}
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
  const user =
    viewModel.customerUsers.find((candidate) => candidate.id === userId) ?? null;

  if (user === null) {
    return (
      <EntityDialog
        title={CUSTOMER_USER_NOT_FOUND_TITLE}
        onClose={closeDialog}
        submit={null}
        cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
      >
        <EmptyState
          title={CUSTOMER_USER_NOT_FOUND_TITLE}
          description={CUSTOMER_USER_NOT_FOUND_MESSAGE}
        />
      </EntityDialog>
    );
  }

  return (
    <CustomerUserEditForm
      key={user.updatedAt}
      customerId={customerId}
      user={user}
      onClose={closeDialog}
      onStaleWrite={detail.refetch}
    />
  );
}
