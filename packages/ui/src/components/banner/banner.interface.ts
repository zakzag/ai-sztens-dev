import type { HTMLAttributes, ReactNode } from 'react';
import type { BannerVariants } from './banner.variants.js';

/**
 * Props shared by every {@link Banner} usage.
 */
export interface BannerBaseProps extends HTMLAttributes<HTMLDivElement>, BannerVariants {
  /** Bold first line; the body stays in `children`. */
  readonly title?: string;
  /** Action slot on the right (e.g. a login CTA button). */
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * A dismissible banner must name its close control: the visible glyph is
 * `aria-hidden`, so the accessible name can only come from here.
 */
export interface BannerDismissibleProps {
  readonly onDismiss: () => void;
  readonly dismissLabel: string;
}

/**
 * A banner without `onDismiss` renders no close control at all.
 */
export interface BannerStaticProps {
  readonly onDismiss?: undefined;
  readonly dismissLabel?: undefined;
}

/**
 * Props of {@link Banner}.
 *
 * Declared as an intersection with a union so "dismissible" cannot be expressed
 * without an accessible label — the compiler enforces the accessibility rule
 * instead of a comment in the component.
 */
export type BannerProps = BannerBaseProps & (BannerDismissibleProps | BannerStaticProps);
