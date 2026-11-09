import type { InputHTMLAttributes } from 'react';

/**
 * Props of {@link Checkbox}.
 *
 * The label lives inside the component because a bare checkbox with a sibling
 * `<label>` is exactly the markup this primitive exists to delete.
 */
export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  /** Field id — the label points here and the message ids derive from it. */
  readonly id: string;
  /** Visible, associated label text. */
  readonly label: string;
  /** Secondary line under the label explaining the consequence of the choice. */
  readonly description?: string;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
}
