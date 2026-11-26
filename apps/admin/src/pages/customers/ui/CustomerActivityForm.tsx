/**
 * The “add an entry” form of the *Tevékenység* tab (AIS-181).
 *
 * A real form through `useAppForm`, exactly like the contact overlays: the schema
 * is derived from the shared request schema, so the field messages are the
 * contract's own words, only the first broken field takes focus, and the success
 * copy is announced **once** by the notify port (never twice: the mutation carries
 * no `meta.successMessage`).
 *
 * It is deliberately **not** inside the empty state: an empty feed still has to
 * accept its first entry, which is why the tab renders this form above the list in
 * every one of the four states.
 */

import { useNotifier } from '@callback/notifications/react';
import {
  Alert,
  Card,
  FormActions,
  FormField,
  Select,
  Textarea,
} from '@callback/ui';
import {
  CUSTOMER_ACTIVITY_FIELD_PATHS,
  CUSTOMERS_ACTIVITY_CREATE_SUCCESS_MESSAGE,
} from '../../../features/customers/customers.const.js';
import { useCreateActivityMutation } from '../../../features/customers/use-customer-activities.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  EMPTY_ACTIVITY_FORM_VALUES,
  customerActivityFormSchema,
  toActivityTypeOptions,
  toCreateActivityInput,
} from '../customer-activity.logic.js';
import {
  CUSTOMER_ACTIVITY_BODY_LABEL,
  CUSTOMER_ACTIVITY_FIELD_IDS,
  CUSTOMER_ACTIVITY_FORM_ERROR_TITLE,
  CUSTOMER_ACTIVITY_FORM_TITLE,
  CUSTOMER_ACTIVITY_SUBMIT_LABEL,
  CUSTOMER_ACTIVITY_TYPE_LABEL,
} from '../customers.const.js';
import type {
  CustomerActivityFormProps,
  CustomerActivityFormValues,
} from '../customers.interface.js';

/**
 * @param props - see {@link CustomerActivityFormProps}.
 */
export function CustomerActivityForm({ customerId }: CustomerActivityFormProps) {
  const notify = useNotifier();
  const create = useCreateActivityMutation(customerId);

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerActivityFormValues>({
      schema: customerActivityFormSchema,
      defaultValues: EMPTY_ACTIVITY_FORM_VALUES,
      fieldPaths: CUSTOMER_ACTIVITY_FIELD_PATHS,
      submit: (values: CustomerActivityFormValues) =>
        create.createActivity(toCreateActivityInput(values)),
      notify,
      successMessage: CUSTOMERS_ACTIVITY_CREATE_SUCCESS_MESSAGE,
    });

  return (
    <Card title={CUSTOMER_ACTIVITY_FORM_TITLE}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {formError === null ? null : (
          <Alert variant="danger" title={CUSTOMER_ACTIVITY_FORM_ERROR_TITLE}>
            {formError}
          </Alert>
        )}

        <FormField
          id={CUSTOMER_ACTIVITY_FIELD_IDS.type}
          label={CUSTOMER_ACTIVITY_TYPE_LABEL}
          error={errors.type?.message}
        >
          {(field) => (
            <Select
              {...register('type')}
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={toActivityTypeOptions()}
            />
          )}
        </FormField>

        <Textarea
          {...register('body')}
          id={CUSTOMER_ACTIVITY_FIELD_IDS.body}
          label={CUSTOMER_ACTIVITY_BODY_LABEL}
          error={errors.body?.message}
          rows={4}
        />

        <FormActions
          submitLabel={CUSTOMER_ACTIVITY_SUBMIT_LABEL}
          isSubmitting={formState.isSubmitting}
        />
      </form>
    </Card>
  );
}
