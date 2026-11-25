/**
 * The inline editor of one feed entry (AIS-181 `D7`).
 *
 * Rendered **inside** its row, not in a dialog and not on a route: nothing links to
 * an inline edit and nothing reloads into it, so it needs no address (the AIS-173
 * exception, applied to a non-dialog surface). The tab owns `editingId`; this
 * component owns the form.
 *
 * The body always carries the entry's concurrency token (`updatedAt ?? createdAt`,
 * `D13`). A `409 STALE_WRITE` is reported to the owner **and** re-thrown, so
 * `useAppForm` still maps and announces the failure exactly once while the tab
 * re-reads the feed and closes the editor.
 */

import { Alert, FormActions, Textarea } from '@callback/ui';
import {
  CUSTOMERS_ACTIVITY_UPDATE_SUCCESS_MESSAGE,
} from '../../../features/customers/customers.const.js';
import { useUpdateActivityMutation } from '../../../features/customers/use-customer-activities.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import { isStaleWriteFailure } from '../../../lib/error-surface.logic.js';
import {
  customerActivityEditSchema,
  toCustomerActivityFormValues,
  toUpdateActivityInput,
} from '../customer-activity.logic.js';
import {
  CUSTOMER_ACTIVITY_BODY_LABEL,
  CUSTOMER_ACTIVITY_CANCEL_LABEL,
  CUSTOMER_ACTIVITY_FIELD_IDS,
  CUSTOMER_ACTIVITY_FORM_ERROR_TITLE,
  CUSTOMER_ACTIVITY_SAVE_LABEL,
} from '../customers.const.js';
import type {
  CustomerActivityEditFormProps,
  CustomerActivityEditFormValues,
} from '../customers.interface.js';

/** Both inputs of the edit form; the body is the only editable field. */
const EDIT_FIELD_PATHS: readonly (keyof CustomerActivityEditFormValues)[] =
  Object.freeze(['body']);

/**
 * @param props - see {@link CustomerActivityEditFormProps}.
 */
export function CustomerActivityEditForm({
  customerId,
  activity,
  onCancel,
  onSaved,
  onStaleWrite,
}: CustomerActivityEditFormProps) {
  const update = useUpdateActivityMutation(customerId, activity.id);

  const submit = async (
    values: CustomerActivityEditFormValues,
  ): Promise<unknown> => {
    try {
      return await update.updateActivity(
        toUpdateActivityInput(values, activity.updateToken),
      );
    } catch (error) {
      if (isStaleWriteFailure(error)) {
        onStaleWrite();
      }

      throw error;
    }
  };

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<CustomerActivityEditFormValues>({
      schema: customerActivityEditSchema,
      defaultValues: toCustomerActivityFormValues(activity),
      fieldPaths: EDIT_FIELD_PATHS,
      submit,
      successMessage: CUSTOMERS_ACTIVITY_UPDATE_SUCCESS_MESSAGE,
      onSuccess: onSaved,
    });

  return (
    <form className="space-y-3" onSubmit={handleSubmit} noValidate>
      {formError === null ? null : (
        <Alert variant="danger" title={CUSTOMER_ACTIVITY_FORM_ERROR_TITLE}>
          {formError}
        </Alert>
      )}

      <Textarea
        {...register('body')}
        id={`${CUSTOMER_ACTIVITY_FIELD_IDS.body}-${activity.id}`}
        label={CUSTOMER_ACTIVITY_BODY_LABEL}
        error={errors.body?.message}
        rows={3}
      />

      <FormActions
        submitLabel={CUSTOMER_ACTIVITY_SAVE_LABEL}
        cancelLabel={CUSTOMER_ACTIVITY_CANCEL_LABEL}
        onCancel={onCancel}
        isSubmitting={formState.isSubmitting}
        align="start"
      />
    </form>
  );
}
