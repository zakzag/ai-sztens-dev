import type { CardProps } from './card.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Raised surface that groups related content.
 *
 * The outline is set explicitly to the dark `--color-border-hairline` token so
 * the card never inherits `currentColor` (the near-white text colour).
 *
 * @param props - see {@link CardProps}.
 */
export function Card({
  title,
  description,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = Boolean(title) || Boolean(description);

  return (
    <div
      {...rest}
      className={cn(
        'rounded-card border border-hairline border-border-hairline bg-surface-raised p-6 shadow-neu-raised',
        className,
      )}
    >
      {title ? (
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      ) : null}
      {children ? (
        <div className={hasHeader ? 'mt-4' : undefined}>{children}</div>
      ) : null}
    </div>
  );
}
