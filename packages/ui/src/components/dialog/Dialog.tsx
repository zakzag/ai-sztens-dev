import { DIALOG_CLOSE_LABEL } from './dialog.const.js';
import { dialogVariants } from './dialog.variants.js';
import { OverlayShell } from './OverlayShell.js';
import { cn } from '../../lib/cn.js';
import type { DialogProps } from './dialog.interface.js';

/**
 * Modal window: a centred raised card over a dimmed backdrop.
 *
 * Behaviour is Radix's (AIS-117 D1) — focus trap, `Esc`, outside dismiss,
 * `aria-modal`, focus returned to the trigger — while the visual layer is the
 * token-based `dialogVariants` recipe. No Radix stylesheet is imported.
 *
 * @param props - see {@link DialogProps}.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  size,
  closeLabel = DIALOG_CLOSE_LABEL,
  className,
}: DialogProps) {
  return (
    <OverlayShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      closeLabel={closeLabel}
      contentClassName={cn(dialogVariants({ size }), className)}
    >
      {children}
    </OverlayShell>
  );
}
