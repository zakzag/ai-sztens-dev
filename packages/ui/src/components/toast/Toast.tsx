import { Badge } from '../badge/Badge.js';
import { Button } from '../button/Button.js';
import { cn } from '../../lib/cn.js';
import { TOAST_DISMISS_LABEL, TOAST_LEVEL_GLYPHS } from './toast.const.js';
import type { ToastProps } from './toast.interface.js';
import { toastLevelChipVariants, toastVariants } from './toast.variants.js';

/**
 * One notification card.
 *
 * The component is intentionally stateless: it renders props, reports the
 * dismiss intent and forwards pointer enter/leave so the **host** can stop or
 * restart its auto-dismiss timer. No timer, no store import, no storage access
 * (that all belongs to AIS-79 / AIS-83).
 *
 * Severity is announced the same way as in `Alert`: `error` is an assertive
 * `role="alert"`, every other level is a polite `role="status"`.
 *
 * @param props - see {@link ToastProps}; `onDismiss` is the only required
 *   callback, because a toast that cannot be closed would be a trap when its
 *   level is sticky.
 */
export function Toast({
  level,
  depth,
  message,
  detail,
  repeatCount,
  onDismiss,
  onPause,
  onResume,
  className,
  ...rest
}: ToastProps) {
  return (
    <div
      {...rest}
      role={level === 'error' ? 'alert' : 'status'}
      data-level={level}
      onPointerEnter={onPause ? () => onPause() : undefined}
      onPointerLeave={onResume ? () => onResume() : undefined}
      className={cn(toastVariants({ level, depth }), className)}
    >
      <span className={toastLevelChipVariants({ level })} aria-hidden="true">
        {TOAST_LEVEL_GLYPHS[level]}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words font-medium">{message}</p>
          {repeatCount !== undefined && repeatCount > 1 ? (
            <Badge variant="neutral">×{repeatCount}</Badge>
          ) : null}
        </div>

        {detail ? (
          <p
            className="mt-1 line-clamp-2 break-words text-xs text-text-secondary"
            title={detail}
          >
            {detail}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        aria-label={TOAST_DISMISS_LABEL}
      >
        <span aria-hidden="true">✕</span>
      </Button>
    </div>
  );
}
