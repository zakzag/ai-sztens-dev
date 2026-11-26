import type { CardProps } from './card.interface.js';
import { cn } from '../../lib/cn.js';
import { SHEEN_GLASS_CLASS } from '../../theme/theme.const.js';

/**
 * Raised surface that groups related content.
 *
 * The outline is set explicitly to the dark `--color-border-hairline` token so
 * the card never inherits `currentColor` (the near-white text colour).
 *
 * The card carries the gloss-only glass utility and **not** `surface-glass`: it
 * sits in the scrolling flow, where a `backdrop-filter` per panel is the known
 * frame-cost worst case, but a thick glass rim without a highlight reads
 * as painted plastic. `sheen-glass` adds the same specular gradient with no filter,
 * and it is a no-op outside the glass family.
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
        `rounded-card border border-hairline border-border-hairline bg-surface-raised p-6 shadow-neu-raised ${SHEEN_GLASS_CLASS}`,
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
