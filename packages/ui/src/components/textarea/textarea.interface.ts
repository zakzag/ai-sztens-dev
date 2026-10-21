import type { TextareaHTMLAttributes } from 'react';
import type { TextareaVariants } from './textarea.variants.js';

/**
 * Props of {@link Textarea}.
 *
 * `id` is required (not generated) so the label association is deterministic in
 * tests and in the DOM — the same contract as {@link Input}.
 */
export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>,
    TextareaVariants {
  readonly id: string;
  /** Visible, associated `<label>` text — never a placeholder substitute. */
  readonly label: string;
  /** Field-level validation message; also sets `aria-invalid`. */
  readonly error?: string;
  /** Helper text shown when there is no error. */
  readonly hint?: string;
}
