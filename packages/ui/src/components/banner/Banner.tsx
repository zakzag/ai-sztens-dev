import type { BannerProps } from './banner.interface.js';
import { bannerVariants } from './banner.variants.js';
import { Button } from '../button/Button.js';
import { cn } from '../../lib/cn.js';

/**
 * App-level strip for a condition that persists across navigation (offline,
 * expired session, maintenance window).
 *
 * Unlike `Alert`, it is not part of the page content: it sits at the top of the
 * layout shell and stays visible until the condition ends or the user dismisses
 * it (there is no timer — a disappearing banner would hide a condition that is
 * still true).
 *
 * `danger` is announced as `alert`, the other severities as `status`.
 *
 * @param props - see {@link BannerProps}; `onDismiss` also requires
 *   `dismissLabel`, which becomes the accessible name of the close control.
 */
export function Banner({
  variant,
  title,
  action,
  onDismiss,
  dismissLabel,
  className,
  children,
  ...rest
}: BannerProps) {
  return (
    <div
      {...rest}
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn(bannerVariants({ variant }), className)}
    >
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div
            className={cn('text-text-secondary', title ? 'mt-0.5' : undefined)}
          >
            {children}
          </div>
        ) : null}
      </div>

      {action !== undefined || onDismiss !== undefined ? (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onDismiss !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              aria-label={dismissLabel}
            >
              <span aria-hidden="true">✕</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
