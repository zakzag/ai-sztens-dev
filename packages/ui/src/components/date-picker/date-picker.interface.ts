import type { InputHTMLAttributes } from 'react';

/**
 * Props of {@link DatePicker}.
 *
 * The value is an ISO date-only string (`yyyy-mm-dd`) — exactly what a native
 * `input[type="date"]` produces and what the shared date-only schema accepts.
 * There is deliberately **no** `Date` object and no conversion helper here
 * (decision **D6**): the caller owns the domain format.
 */
export interface DatePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'value' | 'onChange' | 'min' | 'max'
> {
  /** Field id — the label and message ids derive from it. */
  readonly id: string;
  /** Current value as `yyyy-mm-dd`, or `''` when empty. */
  readonly value: string;
  /** Receives the new `yyyy-mm-dd` value, or `''` when cleared. */
  readonly onChange: (value: string) => void;
  /** Earliest selectable date as `yyyy-mm-dd`. */
  readonly min?: string;
  /** Latest selectable date as `yyyy-mm-dd`. */
  readonly max?: string;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
}
