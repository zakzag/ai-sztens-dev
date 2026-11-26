import type { SelectHTMLAttributes } from 'react';

/** One selectable entry of a {@link Select}. */
export interface SelectOption {
  /** Submitted value. */
  readonly value: string;
  /** Visible text. */
  readonly label: string;
  /** Renders the option disabled (visible, not selectable). */
  readonly disabled?: boolean;
}

/**
 * Props of {@link Select}.
 *
 * `id` is required and `children` is not accepted: the option list comes from
 * `options`, so the DOM order and the labels stay assertable in tests.
 */
export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'children'
> {
  /** Field id — the label and message ids derive from it. */
  readonly id: string;
  /** Options in display order. */
  readonly options: readonly SelectOption[];
  /** Renders a disabled empty option first, shown while nothing is chosen. */
  readonly placeholder?: string;
  /** Error state; sets `aria-invalid` and the danger border. */
  readonly invalid?: boolean;
  /** Id of the error/hint paragraph rendered by `FormField`. */
  readonly describedBy?: string;
}
