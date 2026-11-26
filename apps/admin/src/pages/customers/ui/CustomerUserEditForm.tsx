/**
 * The edit form of one login user (AIS-179).
 *
 * Name, role and **managed** status: the status select offers `active` /
 * `inactive` only, because `invited` is a server-written state that the request
 * schema rejects — a form that could choose it would be a form that can only fail.
 *
 * The owner mounts this component keyed by `user.updatedAt`, which is how a record
 * re-read after `409 STALE_WRITE` reaches the inputs: `useAppForm` seeds
 * `defaultValues` on mount.
 */

import { useNotifier } from '@callback/notifications/react';
import { Alert, EntityDialog, FormField, Input, Select } from '@callback/ui';
import {
  CUSTOMER_USER_EDIT_DEFAULT_PATH_BY_CODE,
  CUSTOMER_USER_EDIT_FIELD_PATHS,
  CUSTOMERS_USER_UPDATE_SUCCESS_MESSAGE,
} from '../../../features/customers/customers.const.js';
import { useUpdateCustomerUserMutation } from '../../../features/customers/use-customer-users.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { isStaleWriteFailure } from '../../../lib/error-surface.logic.js';
import {
  customerUserEditFormSchema,
  toCustomerUserEditFormValues,
  toUpdateCustomerUserInput,
} from '../customer-user.logic.js';
import {
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_USER_EDIT_DIALOG_TITLE,
  CUSTOMER_USER_EDIT_FORM_ID,
  CUSTOMER_USER_EDIT_SUBMIT_LABEL,
  CUSTOMER_USER_EDIT_SUBMIT_PENDING_LABEL,
  CUSTOMER_USER_FIELD_IDS,
  CUSTOMER_USER_FIELD_LABELS,
  CUSTOMER_USER_FORM_ERROR_TITLE,
  CUSTOMER_USER_MANAGED_STATUS_OPTIONS,
  CUSTOMER_USER_ROLE_OPTIONS,
} from '../customers.const.js';
import type {
  CustomerUserEditFormProps,
  CustomerUserEditFormValues,
} from '../customers.interface.js';

/**
 * @param props - see {@link CustomerUserEditFormProps}.
 */
export function CustomerUserEditForm({
  customerId,
  user,
  onClose,
  onStaleWrite,
}: CustomerUserEditFormProps) {
  const notify = useNotifier();
  const { updateCustomerUser } = useUpdateCustomerUserMutation(
    customerId,
    user.id,
  );

  /**
   * @param values - validated form values.
   * @returns the written login user.
   */
  const submit = async (
    values: CustomerUserEditFormValues,
  ): Promise<unknown> => {
    try {
      return await updateCustomerUser(
        toUpdateCustomerUserInput(values, user.updatedAt),
      );
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        onStaleWrite();
      }

      throw error;
    }
  };

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerUserEditFormValues>({
      schema: customerUserEditFormSchema,
      defaultValues: toCustomerUserEditFormValues(user),
      fieldPaths: CUSTOMER_USER_EDIT_FIELD_PATHS,
      defaultPathByCode: CUSTOMER_USER_EDIT_DEFAULT_PATH_BY_CODE,
      submit,
      notify,
      successMessage: CUSTOMERS_USER_UPDATE_SUCCESS_MESSAGE,
      onSuccess: onClose,
    });

  return (
    <EntityDialog
      title={CUSTOMER_USER_EDIT_DIALOG_TITLE}
      description={user.email}
      onClose={onClose}
      cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
      submit={{
        label: CUSTOMER_USER_EDIT_SUBMIT_LABEL,
        formId: CUSTOMER_USER_EDIT_FORM_ID,
        pendingLabel: CUSTOMER_USER_EDIT_SUBMIT_PENDING_LABEL,
        isSubmitting: formState.isSubmitting,
      }}
    >
      <form
        id={CUSTOMER_USER_EDIT_FORM_ID}
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        {formError === null ? null : (
          <Alert variant="danger" title={CUSTOMER_USER_FORM_ERROR_TITLE}>
            {formError}
          </Alert>
        )}

        <Input
          {...register('name')}
          id={CUSTOMER_USER_FIELD_IDS.name}
          label={CUSTOMER_USER_FIELD_LABELS.name}
          error={errors.name?.message}
          autoComplete="off"
          required
        />

        <FormField
          id={CUSTOMER_USER_FIELD_IDS.role}
          label={CUSTOMER_USER_FIELD_LABELS.role}
          error={errors.role?.message}
        >
          {(field) => (
            <Select
              {...register('role')}
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={CUSTOMER_USER_ROLE_OPTIONS}
            />
          )}
        </FormField>

        <FormField
          id={CUSTOMER_USER_FIELD_IDS.status}
          label={CUSTOMER_USER_FIELD_LABELS.status}
          error={errors.status?.message}
        >
          {(field) => (
            <Select
              {...register('status')}
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={CUSTOMER_USER_MANAGED_STATUS_OPTIONS}
            />
          )}
        </FormField>
      </form>
    </EntityDialog>
  );
}
