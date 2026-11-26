import type { SpinnerVariants } from './spinner.variants.js';

/**
 * Props of {@link Spinner}.
 *
 * `label` is not decoration: it is the only text a screen reader gets from the
 * spinner, so it must describe *what* is loading when that is not obvious from
 * the surrounding region.
 */
export interface SpinnerProps extends SpinnerVariants {
  /** Screen-reader text; defaults to {@link SPINNER_DEFAULT_LABEL}. */
  readonly label?: string;
  /** Extra classes merged onto the wrapper. */
  readonly className?: string;
}
