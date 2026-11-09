import { useNotifier } from '@callback/notifications/react';
import { EntityDialog } from '@callback/ui';
import {
  API_KEY_FIELD_PATHS,
  DEFAULT_FIELD_PATH_BY_CODE,
} from '../../../features/api-keys/api-keys.const.js';
import { useCreateApiKeyMutation } from '../../../features/api-keys/use-api-keys.js';
import { useEntityDialog } from '../../../features/entity-dialog/use-entity-dialog.js';
import { useAppForm } from '../../../features/forms/use-app-form.js';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_CREATE_DIALOG_SUBTITLE,
  API_KEY_CREATE_DIALOG_TITLE,
  API_KEY_CREATE_FORM_ID,
  API_KEY_CREATE_PENDING_LABEL,
  API_KEY_CREATE_SUBMIT_LABEL,
  API_KEY_FORM_DEFAULTS,
  API_KEY_FORM_SUCCESS_MESSAGE,
} from '../api-keys.const.js';
import { apiKeyFormSchema, toCreateApiKeyInput } from '../api-keys.logic.js';
import type { ApiKeyFormValues } from '../api-keys.interface.js';
import { ApiKeyFormFields } from './ApiKeyFormFields.js';

/**
 * `/api-keys/new` — the create overlay of the API key list (AIS-155).
 *
 * The page owns the standard here, so the responsibilities are split the same
 * way a future entity will copy:
 *
 * - **the URL** (`/api-keys/new`) decides that the window is open, and the close
 *   handler from {@link useEntityDialog} navigates back to the list with
 *   `replace`;
 * - **`useAppForm`** owns the values, the zod validation, the field-error
 *   mapping, the first-error focus, the reset and the single announcement
 *   (AIS-115/AIS-85). Its `onSuccess` closes the window, so the list — which
 *   stayed mounted behind the overlay — is refreshed only by the invalidation
 *   the mutation already performs;
 * - **`EntityDialog`** owns the frame and the footer: `Mégsem` closes and
 *   `Létrehozás` submits the `<form>` in the body through its id.
 *
 * No submit button is rendered inside the form on purpose: the pending label and
 * the `aria-busy` state of that one button follow `formState.isSubmitting`, which
 * only this component knows.
 *
 * @returns the overlay, mounted as the `/api-keys/new` route element.
 */
export function ApiKeyCreateDialog() {
  const notify = useNotifier();
  const { closeDialog } = useEntityDialog(API_KEYS_LIST_ROUTE_PATH);
  const { createApiKey } = useCreateApiKeyMutation();

  const { register, handleSubmit, errors, formState, formError } =
    useAppForm<ApiKeyFormValues>({
      schema: apiKeyFormSchema,
      defaultValues: API_KEY_FORM_DEFAULTS,
      fieldPaths: API_KEY_FIELD_PATHS,
      defaultPathByCode: DEFAULT_FIELD_PATH_BY_CODE,
      submit: (values) => createApiKey(toCreateApiKeyInput(values)),
      notify,
      successMessage: API_KEY_FORM_SUCCESS_MESSAGE,
      onSuccess: closeDialog,
    });

  return (
    <EntityDialog
      title={API_KEY_CREATE_DIALOG_TITLE}
      description={API_KEY_CREATE_DIALOG_SUBTITLE}
      onClose={closeDialog}
      submit={{
        label: API_KEY_CREATE_SUBMIT_LABEL,
        formId: API_KEY_CREATE_FORM_ID,
        pendingLabel: API_KEY_CREATE_PENDING_LABEL,
        isSubmitting: formState.isSubmitting,
      }}
    >
      <form
        id={API_KEY_CREATE_FORM_ID}
        className="space-y-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <ApiKeyFormFields
          register={register}
          errors={errors}
          formError={formError}
        />
      </form>
    </EntityDialog>
  );
}
