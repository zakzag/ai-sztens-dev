/**
 * The invitation form of one login user (AIS-179).
 *
 * Three inputs and a real form: `useAppForm` supplies the validation, the
 * failure → field mapping (a duplicate e-mail lands on the e-mail input through
 * `CUSTOMER_USER_EMAIL_CONFLICT`), the first-error focus and the single success
 * announcement, so the invite surface cannot invent a second submit path.
 *
 * There is no `status` here on purpose: an invitation is always created in the
 * server-written `invited` state, and accepting it is the auth story's job
 * (AIS-73 / AIS-74).
 */

import { useNotifier } from '@callback/notifications/react';
import { Alert, EntityDialog, FormField, Input, Select } from '@callback/ui';
import {
  CUSTOMER_USER_INVITE_DEFAULT_PATH_BY_CODE,
  CUSTOMER_USER_INVITE_FIELD_PATHS,
  CUSTOMERS_USER_INVITE_SUCCESS_MESSAGE,
} from '../../../features/customers/customers.const.js';
import { useInviteCustomerUserMutation } from '../../../features/customers/use-customer-users.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  customerUserInviteFormSchema,
  EMPTY_USER_INVITE_FORM_VALUES,
  toInviteCustomerUserInput,
} from '../customer-user.logic.js';
import {
  CUSTOMER_EDIT_CANCEL_LABEL,
  CUSTOMER_USER_FIELD_IDS,
  CUSTOMER_USER_FIELD_LABELS,
  CUSTOMER_USER_FORM_ERROR_TITLE,
  CUSTOMER_USER_INVITE_DIALOG_DESCRIPTION,
  CUSTOMER_USER_INVITE_DIALOG_TITLE,
  CUSTOMER_USER_INVITE_FORM_ID,
  CUSTOMER_USER_INVITE_SUBMIT_LABEL,
  CUSTOMER_USER_INVITE_SUBMIT_PENDING_LABEL,
  CUSTOMER_USER_ROLE_OPTIONS,
} from '../customers.const.js';
import type {
  CustomerUserInviteFormProps,
  CustomerUserInviteFormValues,
} from '../customers.interface.js';

/**
 * @param props - see {@link CustomerUserInviteFormProps}.
 */
export function CustomerUserInviteForm({
  customerId,
  onClose,
}: CustomerUserInviteFormProps) {
  const notify = useNotifier();
  const { inviteCustomerUser } = useInviteCustomerUserMutation(customerId);

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerUserInviteFormValues>({
      schema: customerUserInviteFormSchema,
      defaultValues: EMPTY_USER_INVITE_FORM_VALUES,
      fieldPaths: CUSTOMER_USER_INVITE_FIELD_PATHS,
      defaultPathByCode: CUSTOMER_USER_INVITE_DEFAULT_PATH_BY_CODE,
      submit: (values) => inviteCustomerUser(toInviteCustomerUserInput(values)),
      notify,
      successMessage: CUSTOMERS_USER_INVITE_SUCCESS_MESSAGE,
      onSuccess: onClose,
    });

  return (
    <EntityDialog
      title={CUSTOMER_USER_INVITE_DIALOG_TITLE}
      description={CUSTOMER_USER_INVITE_DIALOG_DESCRIPTION}
      onClose={onClose}
      cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
      submit={{
        label: CUSTOMER_USER_INVITE_SUBMIT_LABEL,
        formId: CUSTOMER_USER_INVITE_FORM_ID,
        pendingLabel: CUSTOMER_USER_INVITE_SUBMIT_PENDING_LABEL,
        isSubmitting: formState.isSubmitting,
      }}
    >
      <form
        id={CUSTOMER_USER_INVITE_FORM_ID}
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

        <Input
          {...register('email')}
          id={CUSTOMER_USER_FIELD_IDS.email}
          type="email"
          label={CUSTOMER_USER_FIELD_LABELS.email}
          error={errors.email?.message}
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
      </form>
    </EntityDialog>
  );
}
