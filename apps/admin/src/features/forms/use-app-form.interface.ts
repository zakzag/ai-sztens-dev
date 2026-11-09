/**
 * Types of {@link useAppForm} (AIS-115).
 *
 * The hook is the one place where a form's five moving parts meet — the zod
 * resolver, the failure → field mapping, the page-level message, the notification
 * port and the reset convention. Its types therefore carry the three decisions
 * that are easiest to lose in a copy-pasted form:
 *
 * - **the caller owns the domain** ({@link UseAppFormOptions.fieldPaths},
 *   `defaultPathByCode`, `schema`): the hook knows no field name and no copy;
 * - **the notification system is a port** ({@link FormNotifier}), so the hook is
 *   testable and shippable before AIS-84 lands;
 * - **the page-level message is state** (`formError`), not a toast, because a
 *   failure that could not be addressed must stay visible next to the inputs.
 */

import type { BaseSyntheticEvent } from 'react';
import type {
  DefaultValues,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * A form field path usable as a react-hook-form name.
 *
 * `Path<T>` also yields numeric paths for array values; a form field is always
 * addressed by name, so the numeric half is removed here instead of at every
 * call site.
 */
export type FieldPath<FV extends FieldValues> = Extract<Path<FV>, string>;

/**
 * The notification port of the form pattern (plan `D2`).
 *
 * Deliberately a one-method interface: the admin app has no notification system
 * yet (AIS-84), and widening the port before that ticket exists would guess its
 * API. AIS-84/85 supplies the implementation; until then the caller passes
 * `null` and the hook stays silent.
 */
export interface FormNotifier {
  /** Announces a successful submit with the already-translated copy. */
  readonly success: (message: string) => void;
}

/**
 * The subset of react-hook-form's `formState` the pattern exposes.
 *
 * A narrow, plain object instead of the library's proxy: consumer types stay
 * simple, and a test can assert the three flags without touching RHF internals.
 */
export interface AppFormState {
  /** `true` while the submit callback is running; drives `FormActions`. */
  readonly isSubmitting: boolean;
  /** `true` when a value differs from `defaultValues`. */
  readonly isDirty: boolean;
  /** `true` when the current values pass the schema. */
  readonly isValid: boolean;
}

/** Everything a form has to declare about itself. */
export interface UseAppFormOptions<FV extends FieldValues> {
  /**
   * The client schema, always **derived** from the shared request schema
   * (AIS-112). It runs on submit and produces the Hungarian field messages.
   */
  readonly schema: ZodType<FV>;
  /**
   * Initial values, and what {@link UseAppFormResult.reset} restores.
   *
   * Typed as react-hook-form's `DefaultValues<FV>` (a deep partial) because that
   * is what `useForm` accepts for a generic `FV`; a concrete form passes its full
   * value object, which satisfies it.
   */
  readonly defaultValues: DefaultValues<FV>;
  /**
   * Every input the form renders, **in visual order**.
   *
   * The order is the contract of decision `D3`: server errors are applied in this
   * order and only the first one takes focus, so the result is deterministic.
   */
  readonly fieldPaths: readonly FieldPath<FV>[];
  /**
   * Performs the write, usually a `useApiMutation` `mutateAsync`.
   *
   * A rejection is mapped onto the fields by the hook, so the implementation must
   * reject with the raw error instead of swallowing it.
   */
  readonly submit: (values: FV) => Promise<unknown>;
  /**
   * Code → the path to blame when the envelope carried no `issues[]`.
   *
   * Only the feature knows that, e.g., a duplicate `identifier` belongs on its
   * `identifier` input; the hook just forwards it to `toFieldErrors`.
   */
  readonly defaultPathByCode?: Readonly<Record<string, FieldPath<FV>>>;
  /** Notification port; `null`/omitted means the hook announces nothing. */
  readonly notify?: FormNotifier | null;
  /** Success copy handed to {@link FormNotifier.success}; ignored without `notify`. */
  readonly successMessage?: string;
  /** Runs after a successful submit, reset and notification (e.g. close a drawer). */
  readonly onSuccess?: () => void;
}

/**
 * The ready-to-use submit handler of the pattern.
 *
 * Deliberately **not** react-hook-form's curried `handleSubmit`: the hook already
 * owns the callback, so what a page needs is the function that goes straight onto
 * `<form onSubmit={…}>` (plan `D11`). That also removes the possibility of a page
 * bypassing the validate → submit → reset → notify order.
 */
export type AppFormSubmitHandler = (
  event?: BaseSyntheticEvent,
) => Promise<void>;

/** What a form consumes. */
export interface UseAppFormResult<FV extends FieldValues> {
  /** Pass to every control; the ref is what makes `shouldFocus` work. */
  readonly register: UseFormRegister<FV>;
  /** Pass to `<form onSubmit={…}>` — it validates first, then submits. */
  readonly handleSubmit: AppFormSubmitHandler;
  /** Per-field messages, keyed by field name. */
  readonly errors: FieldErrors<FV>;
  /** The three flags the UI needs. */
  readonly formState: AppFormState;
  /** Page-level copy for the `Alert` above the form, or `null`. */
  readonly formError: string | null;
  /** Restores `defaultValues` and drops the page-level message. */
  readonly reset: () => void;
  /** Maps a failure onto this form; the same path a submit rejection takes. */
  readonly setServerError: (error: unknown) => void;
  /** Drops the page-level message without touching the values. */
  readonly clearFormError: () => void;
}

/** One field message, already ordered. */
export interface FormErrorEntry<F extends string> {
  /** The input the message belongs to. */
  readonly path: F;
  /** The translated copy to render under that input. */
  readonly message: string;
}

/**
 * The mapping result reduced to what react-hook-form needs.
 *
 * Produced by `toFormErrorPlan` from the mapping of `lib/field-errors.logic.ts`,
 * so the ordering and the “only owned paths” rule stay pure and testable.
 */
export interface FormErrorPlan<F extends string> {
  /** Field messages in `fieldPaths` order; the first one takes focus. */
  readonly entries: readonly FormErrorEntry<F>[];
  /**
   * The page-level message, or `null` when another surface owns the failure.
   *
   * Non-`null` only for a `field`-surface failure whose issue the mapping could
   * not address: a `page` failure is toasted by the capture (AIS-84), a `banner`
   * failure by `AppErrorBanner` (AIS-96), and a `silent` one is not reported at
   * all. Anything else would say the same sentence twice (AIS-85 `D2`).
   */
  readonly formMessage: string | null;
}
