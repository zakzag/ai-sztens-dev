/**
 * The contact form, shared by the create and the edit overlay (AIS-179).
 *
 * One component for both, because the inputs, the validation and the failure
 * mapping are identical; `contact === null` is what makes it a creation and also
 * decides whether the body carries the `updatedAt` token.
 *
 * Three decisions worth keeping:
 *
 * - the role set is **three checkboxes**, converted to the wire array by
 *   `toContactRoles()` — no `useFieldArray`, and the closed role union stays the
 *   single source (plan decision `D3`);
 * - the “belépő felhasználó” select offers the customer's own users plus a
 *   clearable “none” entry, which is exactly the set the server accepts;
 * - a `409 STALE_WRITE` is reported to the owner (`onStaleWrite`) and re-thrown:
 *   the owner re-reads the record, while `useAppForm` keeps the announce-and-map
 *   step, so the copy is never duplicated.
 */

import { useNotifier } from '@callback/notifications/react';
import { Alert, Checkbox, EntityDialog, FormField, Input, Select } from '@callback/ui';
import {
  CUSTOMER_CONTACT_DEFAULT_PATH_BY_CODE,
  CUSTOMER_CONTACT_FIELD_PATHS,
  CUSTOMERS_CONTACT_CREATE_SUCCESS_MESSAGE,
  CUSTOMERS_CONTACT_UPDATE_SUCCESS_MESSAGE,
} from '../../../features/customers/customers.const.js';
import {
  useCreateContactMutation,
  useUpdateContactMutation,
} from '../../../features/customers/use-customer-contacts.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { isStaleWriteFailure } from '../../../lib/error-surface.logic.js';
import {
  customerContactFormSchema,
  toContactUserOptions,
  toCreateContactInput,
  toCustomerContactFormValues,
  toUpdateContactInput,
} from '../customer-contact.logic.js';
import {
  CUSTOMER_CONTACT_CREATE_DIALOG_DESCRIPTION,
  CUSTOMER_CONTACT_CREATE_DIALOG_TITLE,
  CUSTOMER_CONTACT_EDIT_DIALOG_TITLE,
  CUSTOMER_CONTACT_FIELD_HINTS,
  CUSTOMER_CONTACT_FIELD_IDS,
  CUSTOMER_CONTACT_FIELD_LABELS,
  CUSTOMER_CONTACT_FORM_ERROR_TITLE,
  CUSTOMER_CONTACT_FORM_ID,
  CUSTOMER_CONTACT_ROLE_FIELDS,
  CUSTOMER_CONTACT_SUBMIT_LABEL,
  CUSTOMER_CONTACT_SUBMIT_PENDING_LABEL,
  CUSTOMER_EDIT_CANCEL_LABEL,
} from '../customers.const.js';
import type {
  CustomerContactFormProps,
  CustomerContactFormValues,
} from '../customers.interface.js';

/**
 * @param props - see {@link CustomerContactFormProps}.
 */
export function CustomerContactForm({
  customerId,
  contact,
  customerUsers,
  onClose,
  onStaleWrite,
}: CustomerContactFormProps) {
  const notify = useNotifier();
  const create = useCreateContactMutation(customerId);
  const update = useUpdateContactMutation(customerId, contact?.id ?? '');

  /**
   * Creates or patches, depending on whether a contact was supplied.
   *
   * @param values - validated form values.
   * @returns the written (or created) contact.
   */
  const submit = async (
    values: CustomerContactFormValues,
  ): Promise<unknown> => {
    try {
      return contact === null
        ? await create.createContact(toCreateContactInput(values))
        : await update.updateContact(
            toUpdateContactInput(values, contact.updatedAt),
          );
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        onStaleWrite();
      }

      throw error;
    }
  };

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerContactFormValues>({
      schema: customerContactFormSchema,
      defaultValues: toCustomerContactFormValues(contact),
      fieldPaths: CUSTOMER_CONTACT_FIELD_PATHS,
      defaultPathByCode: CUSTOMER_CONTACT_DEFAULT_PATH_BY_CODE,
      submit,
      notify,
      successMessage:
        contact === null
          ? CUSTOMERS_CONTACT_CREATE_SUCCESS_MESSAGE
          : CUSTOMERS_CONTACT_UPDATE_SUCCESS_MESSAGE,
      onSuccess: onClose,
    });

  const roleError =
    errors.isPrimary?.message ??
    errors.isTechnical?.message ??
    errors.isAlerting?.message ??
    null;

  return (
    <EntityDialog
      title={
        contact === null
          ? CUSTOMER_CONTACT_CREATE_DIALOG_TITLE
          : CUSTOMER_CONTACT_EDIT_DIALOG_TITLE
      }
      description={
        contact === null ? CUSTOMER_CONTACT_CREATE_DIALOG_DESCRIPTION : undefined
      }
      onClose={onClose}
      cancelLabel={CUSTOMER_EDIT_CANCEL_LABEL}
      submit={{
        label: CUSTOMER_CONTACT_SUBMIT_LABEL,
        formId: CUSTOMER_CONTACT_FORM_ID,
        pendingLabel: CUSTOMER_CONTACT_SUBMIT_PENDING_LABEL,
        isSubmitting: formState.isSubmitting,
      }}
    >
      <form
        id={CUSTOMER_CONTACT_FORM_ID}
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        {formError === null ? null : (
          <Alert variant="danger" title={CUSTOMER_CONTACT_FORM_ERROR_TITLE}>
            {formError}
          </Alert>
        )}

        <Input
          {...register('name')}
          id={CUSTOMER_CONTACT_FIELD_IDS.name}
          label={CUSTOMER_CONTACT_FIELD_LABELS.name}
          error={errors.name?.message}
          autoComplete="off"
          required
        />

        <Input
          {...register('position')}
          id={CUSTOMER_CONTACT_FIELD_IDS.position}
          label={CUSTOMER_CONTACT_FIELD_LABELS.position}
          error={errors.position?.message}
          autoComplete="off"
        />

        <Input
          {...register('email')}
          id={CUSTOMER_CONTACT_FIELD_IDS.email}
          type="email"
          label={CUSTOMER_CONTACT_FIELD_LABELS.email}
          hint={CUSTOMER_CONTACT_FIELD_HINTS.email}
          error={errors.email?.message}
          autoComplete="off"
        />

        <Input
          {...register('phone')}
          id={CUSTOMER_CONTACT_FIELD_IDS.phone}
          type="tel"
          label={CUSTOMER_CONTACT_FIELD_LABELS.phone}
          hint={CUSTOMER_CONTACT_FIELD_HINTS.phone}
          error={errors.phone?.message}
          autoComplete="off"
        />

        <FormField
          id={CUSTOMER_CONTACT_FIELD_IDS.customerUserId}
          label={CUSTOMER_CONTACT_FIELD_LABELS.customerUserId}
          error={errors.customerUserId?.message}
        >
          {(field) => (
            <Select
              {...register('customerUserId')}
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={toContactUserOptions(customerUsers)}
            />
          )}
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-secondary">
            {CUSTOMER_CONTACT_FIELD_LABELS.roles}
          </legend>
          {CUSTOMER_CONTACT_ROLE_FIELDS.map((definition) => (
            <Checkbox
              key={definition.field}
              {...register(definition.field)}
              id={definition.id}
              label={definition.label}
            />
          ))}
          {roleError === null ? null : (
            <p role="alert" className="text-sm text-danger">
              {roleError}
            </p>
          )}
        </fieldset>

        <Checkbox
          {...register('isActive')}
          id={CUSTOMER_CONTACT_FIELD_IDS.isActive}
          label={CUSTOMER_CONTACT_FIELD_LABELS.isActive}
        />
      </form>
    </EntityDialog>
  );
}
