import type { InputHTMLAttributes } from 'react';
import type { InputVariants } from './input.variants.js';

/**
 * Props of {@link Input}.
 *
 * `id` is required (not generated) so the label association is deterministic in
 * server-side tests and in the DOM.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, InputVariants {
  readonly id: string;
  /** Visible, associated `<label>` text — never a placeholder substitute. */
  readonly label: string;
  /** Field-level validation message; also sets `aria-invalid`. */
  readonly error?: string;
  /** Helper text shown when there is no error. */
  readonly hint?: string;
}
