import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ButtonVariants } from './button.variants.js';

/**
 * Props of {@link Button}.
 *
 * `type` defaults to `button` on purpose: an accidental implicit `submit` in a
 * long form is a classic bug source, so submitting requires the explicit opt-in.
 */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  readonly children?: ReactNode;
  /** Renders a spinner, disables the button and marks it `aria-busy`. */
  readonly isLoading?: boolean;
}
