import type { InputHTMLAttributes } from 'react';

/**
 * Props of {@link NumberInput}.
 *
 * `type` is fixed to `number` and `id` is required, so the label association and
 * the message wiring behave exactly like {@link Input}'s.
 */
export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  /** Field id — the label and message ids derive from it. */
  readonly id: string;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
}
