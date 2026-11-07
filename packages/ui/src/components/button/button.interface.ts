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
  /**
   * Optional leading icon slot (AIS-155).
   *
   * A decorative icon (one of `@callback/ui`'s `*Icon` components) is rendered
   * before the label with the recipe's `gap`, so the "add" and "close" patterns
   * are written once instead of per page. The slot never carries the accessible
   * name: that stays the visible label or the `aria-label` of the button.
   */
  readonly icon?: ReactNode;
  /** Renders a spinner, disables the button and marks it `aria-busy`. */
  readonly isLoading?: boolean;
}
