import { Toast } from './Toast.js';
import { TOAST_MAX_VISIBLE, TOAST_STACK_ARIA_LABEL } from './toast.const.js';
import { toToastDepth } from './toast.logic.js';
import { toastStackVariants } from './toast.variants.js';
import type { ToastStackProps } from './toast.interface.js';

/**
 * Bottom-right container of the toast cards.
 *
 * Two rules live here and nowhere else:
 *
 * 1. **Trimming.** The store keeps every entry, the stack renders at most
 *    `TOAST_MAX_VISIBLE` cards, so a burst of notifications cannot cover the
 *    page. The input array is newest-first, therefore the *newest* cards are the
 *    ones that stay visible (D3).
 * 2. **Depth.** Each card gets the visual depth of its position, so older cards
 *    read as "behind" the newest one (D6).
 *
 * The container is the live region (`polite`, `atomic=false`, labelled), which
 * means the host does not have to wrap it in another one.
 *
 * @param props - see {@link ToastStackProps}.
 */
export function ToastStack({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: ToastStackProps) {
  const visible = toasts.slice(0, TOAST_MAX_VISIBLE);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-atomic="false"
      aria-label={TOAST_STACK_ARIA_LABEL}
      className={toastStackVariants()}
    >
      {visible.map((toast, index) => (
        <Toast
          key={toast.id}
          level={toast.level}
          depth={toToastDepth(index)}
          message={toast.message}
          detail={toast.detail}
          repeatCount={toast.repeatCount}
          onDismiss={() => onDismiss(toast.id)}
          onPause={onPause ? () => onPause(toast.id) : undefined}
          onResume={onResume ? () => onResume(toast.id) : undefined}
        />
      ))}
    </div>
  );
}
