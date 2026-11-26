import type { ReactNode } from 'react';

/**
 * DOM-safe attributes for a control that is **not** one of our primitives.
 *
 * Spreading this object onto `<input>`, `<select>` or `<textarea>` cannot leak
 * an invalid attribute, because every key is a real ARIA attribute or `id`.
 */
export interface FormFieldAriaProps {
  /** The `id` the label points at. */
  readonly id: string;
  /** `true` while an error message is rendered, `undefined` otherwise. */
  readonly 'aria-invalid': boolean | undefined;
  /** Id of the rendered error or hint paragraph. */
  readonly 'aria-describedby': string | undefined;
}

/**
 * The wiring a control receives from {@link FormField}.
 *
 * `id` + `invalid` + `describedBy` are the props our primitives accept, while
 * `ariaProps` is the spread-ready form for raw DOM elements — so neither usage
 * has to hand-wire accessibility attributes (decision **D1** of the plan).
 */
export interface FormFieldControlProps {
  /** The `id` the label points at — always the field's own `id`. */
  readonly id: string;
  /** `true` when an error message is shown. */
  readonly invalid: boolean;
  /** Id of the rendered error or hint paragraph, `undefined` when neither. */
  readonly describedBy: string | undefined;
  /** Spread-ready ARIA + id bundle for a raw DOM control. */
  readonly ariaProps: FormFieldAriaProps;
}

/**
 * Props of {@link FormField}.
 *
 * `id` and `label` are required so the association is deterministic in the DOM
 * and in tests; a generated id would make every assertion positional.
 */
export interface FormFieldProps {
  /** Field id — the label points here and the message ids derive from it. */
  readonly id: string;
  /** Visible, associated `<label>` text. */
  readonly label: string;
  /** Helper text shown when there is no error. */
  readonly hint?: string;
  /** Field-level validation message; wins over `hint`. */
  readonly error?: string;
  /** Renders a required marker (the control still owns the `required` attribute). */
  readonly required?: boolean;
  /** Renders the control with the wiring described by {@link FormFieldControlProps}. */
  readonly children: (field: FormFieldControlProps) => ReactNode;
}
