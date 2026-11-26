/**
 * Status-change window of the customer detail header (AIS-21).
 *
 * A route of its own on the server (`PATCH /api/customers/:id/status`), and a
 * **non-navigable modal** in the UI: nothing links to it, nothing reloads into it,
 * so it has no address and its open flag stays local `useState` in the header
 * actions (UI-Architecture §6.3 / AIS-173 exception) — the same treatment the
 * archive confirmation already gets.
 *
 * The owner mounts this component **only while the window is open**, which is what
 * re-seeds the select on every opening: `useAppForm` reads `defaultValues` on
 * mount, so a value the operator abandoned last time cannot survive.
 *
 * One field, but a real form: `useAppForm` supplies the validation, the failure →
 * field mapping, the first-error focus and the single success announcement, so the
 * header cannot grow a second submit path (`CustomerEditForm` and this one behave
 * identically on a `409 STALE_WRITE` / `500`).
 */

import { useNotifier } from '@callback/notifications/react';
import { Alert, Dialog, FormActions, FormField, Select } from '@callback/ui';
import { CUSTOMERS_STATUS_SUCCESS_MESSAGE } from '../../../features/customers/customers.const.js';
import { useUpdateCustomerStatusMutation } from '../../../features/customers/use-update-customer-status.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { customerStatusFormSchema } from '../customer-edit.logic.js';
import {
  CUSTOMERS_STATUS_DIALOG_DESCRIPTION,
  CUSTOMERS_STATUS_DIALOG_TITLE,
  CUSTOMERS_STATUS_FIELD_ID,
  CUSTOMERS_STATUS_FIELD_LABEL,
  CUSTOMERS_STATUS_OPTIONS,
  CUSTOMERS_STATUS_SUBMIT_LABEL,
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_EDIT_FORM_ERROR_TITLE,
} from '../customers.const.js';
import type {
  CustomerStatusDialogProps,
  CustomerStatusFormValues,
} from '../customers.interface.js';

/** The single input of the form — also its error-focus list. */
const CUSTOMER_STATUS_FIELD_PATHS: readonly (keyof CustomerStatusFormValues)[] =
  Object.freeze(['status']);

/**
 * @param props - see {@link CustomerStatusDialogProps}.
 */
export function CustomerStatusDialog({
  customerId,
  currentStatus,
  updatedAt,
  onClose,
}: CustomerStatusDialogProps) {
  const notify = useNotifier();
  const { updateCustomerStatus } = useUpdateCustomerStatusMutation(customerId);

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerStatusFormValues>({
      schema: customerStatusFormSchema,
      defaultValues: { status: currentStatus },
      fieldPaths: CUSTOMER_STATUS_FIELD_PATHS,
      // The version the page was rendered from: a concurrent edit is refused with
      // `409 STALE_WRITE` instead of silently overwriting it.
      submit: (values) =>
        updateCustomerStatus({ status: values.status, updatedAt }),
      notify,
      successMessage: CUSTOMERS_STATUS_SUCCESS_MESSAGE,
      onSuccess: onClose,
    });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={CUSTOMERS_STATUS_DIALOG_TITLE}
      description={CUSTOMERS_STATUS_DIALOG_DESCRIPTION}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {formError === null ? null : (
          <Alert variant="danger" title={CUSTOMER_EDIT_FORM_ERROR_TITLE}>
            {formError}
          </Alert>
        )}

        <FormField
          id={CUSTOMERS_STATUS_FIELD_ID}
          label={CUSTOMERS_STATUS_FIELD_LABEL}
          error={errors.status?.message}
        >
          {(field) => (
            <Select
              {...register('status')}
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={CUSTOMERS_STATUS_OPTIONS}
            />
          )}
        </FormField>

        <FormActions
          submitLabel={CUSTOMERS_STATUS_SUBMIT_LABEL}
          cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
          onCancel={onClose}
          isSubmitting={formState.isSubmitting}
        />
      </form>
    </Dialog>
  );
}
