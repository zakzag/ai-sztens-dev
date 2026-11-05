/**
 * The shared form pattern of the admin app (AIS-115).
 *
 * A page should not have to re-derive the same five things for every form, so
 * this hook is the single place where they meet:
 *
 * 1. **resolver** — the zod schema of the caller, with the shared error map, so
 *    an invalid form is blocked on the client with Hungarian copy before a single
 *    request leaves the browser;
 * 2. **failure mapping** — a rejected submit runs through `toFieldErrors`
 *    (AIS-111) and lands on the inputs; whatever could not be addressed becomes
 *    one page-level message;
 * 3. **focus** — errors are applied in the caller's declared field order and only
 *    the first one takes focus (plan `D3`), so two identical failures focus the
 *    same input;
 * 4. **success convention** — `reset(defaultValues)` → notification → `onSuccess`
 *    (plan `D8`), so the toast never announces state React has not applied yet;
 * 5. **notification** — through an optional port (plan `D2`), never a direct
 *    dependency on AIS-84.
 *
 * The hook owns no copy, no field name and no business rule: it only sequences
 * what the caller declared. That is also why it never branches on `error.status`
 * or `error.code` — the decision lives in `lib/field-errors.logic.ts`, which is
 * what the `quality:field-errors` gate requires.
 *
 * Since AIS-85 the page-level `formError` is not "whatever the mapping could not
 * address" but "the residue of a **field** failure": `toErrorSurface` classifies
 * the failure once, and a `page` failure (the capture toast), a `banner` failure
 * (`AppErrorBanner`) or a `silent` one already has an owner. That is what keeps a
 * `500` from rendering the same sentence twice.
 */

import { VALIDATION_ERROR_MAP } from '@callback/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { toErrorSurface } from '../../lib/error-surface.logic.js';
import { toFieldErrors } from '../../lib/field-errors.logic.js';
import { APP_FORM_FIELD_ERROR_TYPE } from './use-app-form.const.js';
import { toFormErrorPlan } from './use-app-form.logic.js';
import type {
  UseAppFormOptions,
  UseAppFormResult,
} from './use-app-form.interface.js';

/**
 * Wires one form to the shared validation, error and feedback convention.
 *
 * @param options - schema, defaults, the owned field paths, the submit call and
 *   the optional notification/`onSuccess` hooks.
 * @returns the react-hook-form handles plus the page-level `formError` state.
 */
export function useAppForm<FV extends FieldValues>(
  options: UseAppFormOptions<FV>,
): UseAppFormResult<FV> {
  const {
    schema,
    defaultValues,
    fieldPaths,
    submit,
    defaultPathByCode,
    notify,
    successMessage,
    onSuccess,
  } = options;

  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, setError, clearErrors, reset, formState } =
    useForm<FV>({
      // The `errorMap` is what makes the zod-generated issues (`too_small`,
      // `invalid_string`, …) speak the locale configured in `main.tsx` (AIS-112).
      resolver: zodResolver(schema, { errorMap: VALIDATION_ERROR_MAP }),
      defaultValues,
    });

  /**
   * Applies one failure to this form.
   *
   * Shared by the submit rejection path and the exported `setServerError`, so a
   * caller that submits outside `handleSubmit` cannot get a different behaviour.
   *
   * @param error - whatever the write rejected with; never inspected here.
   */
  function applyServerError(error: unknown): void {
    const plan = toFormErrorPlan(
      toFieldErrors(error, { fieldPaths, defaultPathByCode }),
      fieldPaths,
      toErrorSurface(error),
    );

    plan.entries.forEach((entry, index) => {
      // Only the first entry focuses: consecutive `shouldFocus: true` calls would
      // each steal focus and the last one would win (plan `D3`).
      setError(
        entry.path,
        { type: APP_FORM_FIELD_ERROR_TYPE, message: entry.message },
        { shouldFocus: index === 0 },
      );
    });

    setFormError(plan.formMessage);
  }

  /**
   * Validates, submits and applies the outcome.
   *
   * The `try/catch` sits **inside** the callback on purpose: `handleSubmit`
   * returns a resolved promise even when the submit rejects, so a `catch` outside
   * it would never see the server failure.
   *
   * The parameter type is inferred from `handleSubmit` on purpose: annotating it
   * as `FV` would not be assignable inside a generic hook.
   */
  const submitHandler = handleSubmit(async (values): Promise<void> => {
    // A stale server error (and the previous attempt's field messages) must not
    // survive the retry the user is starting right now.
    setFormError(null);
    clearErrors();

    try {
      await submit(values);
    } catch (error) {
      applyServerError(error);
      return;
    }

    reset(defaultValues);

    if (
      notify !== null &&
      notify !== undefined &&
      successMessage !== undefined
    ) {
      notify.success(successMessage);
    }

    onSuccess?.();
  });

  return {
    register,
    handleSubmit: submitHandler,
    errors: formState.errors,
    formState: {
      isSubmitting: formState.isSubmitting,
      isDirty: formState.isDirty,
      isValid: formState.isValid,
    },
    formError,
    reset: () => {
      setFormError(null);
      reset(defaultValues);
    },
    setServerError: (error: unknown) => {
      applyServerError(error);
    },
    clearFormError: () => {
      setFormError(null);
    },
  };
}
