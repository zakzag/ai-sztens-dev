import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Input, Textarea } from '@callback/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toIdentifierFieldError } from '../../../features/api-keys/api-keys.logic.js';
import { useCreateApiKeyMutation } from '../../../features/api-keys/use-api-keys.js';
import { toErrorMessage } from '../../../lib/error-message.js';
import {
  API_KEY_FORM_DEFAULTS,
  API_KEY_FORM_ERROR_TITLE,
  API_KEY_FORM_FIELD_IDS,
  API_KEY_FORM_HINTS,
  API_KEY_FORM_LABELS,
  API_KEY_FORM_PENDING_LABEL,
  API_KEY_FORM_SUBMIT_LABEL,
  API_KEY_FORM_SUCCESS_MESSAGE,
  API_KEY_FORM_TITLE,
} from '../api-keys.const.js';
import type { ApiKeyFormValues } from '../api-keys.interface.js';
import { apiKeyFormSchema, toCreateApiKeyInput } from '../api-keys.logic.js';

/**
 * Create form of the API key page.
 *
 * The form owns exactly one bucket — react-hook-form state — plus one piece of
 * page-level feedback (`pageError`). The server state stays in the query cache:
 * the mutation hook invalidates the list and only then runs `onCreated`, which
 * is where the fields are cleared.
 *
 * Error routing (plan decision D36):
 * - HTTP 409 → `setError('identifier')`, a field-level problem the user can fix;
 * - anything else → a page-level `Alert`, text mapped by `toErrorMessage`.
 *
 * @returns the form card.
 */
export function ApiKeyForm() {
  const [pageError, setPageError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: API_KEY_FORM_DEFAULTS,
  });

  const {
    createApiKey,
    isPending,
    isSuccess,
    reset: resetMutation,
  } = useCreateApiKeyMutation({
    onCreated: () => {
      reset(API_KEY_FORM_DEFAULTS);
      setPageError(null);
    },
  });

  /**
   * Submits the validated values.
   *
   * @param values - form values already accepted by the schema.
   */
  async function onSubmit(values: ApiKeyFormValues): Promise<void> {
    setPageError(null);
    resetMutation();

    try {
      await createApiKey(toCreateApiKeyInput(values));
    } catch (error) {
      const identifierError = toIdentifierFieldError(error);

      if (identifierError !== null) {
        setError('identifier', { type: 'conflict', message: identifierError }, { shouldFocus: true });

        return;
      }

      setPageError(toErrorMessage(error));
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">{API_KEY_FORM_TITLE}</h2>

      {isSuccess ? <Alert variant="success">{API_KEY_FORM_SUCCESS_MESSAGE}</Alert> : null}

      {pageError !== null ? (
        <Alert variant="danger" title={API_KEY_FORM_ERROR_TITLE}>
          {pageError}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          {...register('name')}
          id={API_KEY_FORM_FIELD_IDS.name}
          label={API_KEY_FORM_LABELS.name}
          hint={API_KEY_FORM_HINTS.name}
          error={errors.name?.message}
          autoComplete="off"
        />

        <Input
          {...register('identifier')}
          id={API_KEY_FORM_FIELD_IDS.identifier}
          label={API_KEY_FORM_LABELS.identifier}
          hint={API_KEY_FORM_HINTS.identifier}
          error={errors.identifier?.message}
          autoComplete="off"
        />

        <Textarea
          {...register('description')}
          id={API_KEY_FORM_FIELD_IDS.description}
          label={API_KEY_FORM_LABELS.description}
          hint={API_KEY_FORM_HINTS.description}
          error={errors.description?.message}
        />

        <Input
          {...register('apiKey')}
          id={API_KEY_FORM_FIELD_IDS.apiKey}
          label={API_KEY_FORM_LABELS.apiKey}
          hint={API_KEY_FORM_HINTS.apiKey}
          error={errors.apiKey?.message}
          type="text"
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          {...register('expiresAt')}
          id={API_KEY_FORM_FIELD_IDS.expiresAt}
          label={API_KEY_FORM_LABELS.expiresAt}
          hint={API_KEY_FORM_HINTS.expiresAt}
          error={errors.expiresAt?.message}
          type="date"
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? API_KEY_FORM_PENDING_LABEL : API_KEY_FORM_SUBMIT_LABEL}
        </Button>
      </form>
    </Card>
  );
}
