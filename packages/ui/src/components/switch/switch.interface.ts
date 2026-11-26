import type { InputHTMLAttributes } from 'react';

/**
 * Props of {@link Switch}.
 *
 * Same contract as a checkbox, different semantics: a switch applies
 * immediately, a checkbox is confirmed by a submit. `aria-checked` is emitted
 * when the caller controls `checked`.
 */
export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'role'
> {
  /** Field id — the label points here. */
  readonly id: string;
  /** Visible, associated label text. */
  readonly label: string;
  /** Secondary line under the label explaining the effect of the toggle. */
  readonly description?: string;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
}
