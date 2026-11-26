import { Button } from '../button/Button.js';
import type { EmptyStateProps } from './empty-state.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * The “success, but no rows” state of a list or collection.
 *
 * Announced as a `status` region whose accessible name is the title, so a screen
 * reader hears “Nincs még tárolt API kulcs” once instead of reading two
 * paragraphs of prose in the middle of a table region.
 *
 * The CTA's `aria-label` repeats the title (`Kulcs felvitele — Nincs még tárolt
 * API kulcs`): the same button text appears elsewhere on the page, and a screen
 * reader's element list is otherwise ambiguous.
 *
 * @param props - see {@link EmptyStateProps}.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-hairline border-border-hairline bg-surface-raised px-6 py-8 text-center shadow-neu-raised',
        className,
      )}
    >
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description === undefined ? null : (
        <p className="max-w-prose text-sm text-text-secondary">{description}</p>
      )}
      {action === undefined ? null : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={`${action.label} — ${title}`}
          onClick={action.onAction}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
