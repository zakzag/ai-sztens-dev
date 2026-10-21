import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Props of {@link Card}. `title`/`description` are optional header slots; when
 * both are omitted the card is a plain raised surface.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly title?: string;
  readonly description?: string;
  readonly children?: ReactNode;
}
