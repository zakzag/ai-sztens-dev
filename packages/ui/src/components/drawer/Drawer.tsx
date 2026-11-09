import { DIALOG_CLOSE_LABEL } from '../dialog/dialog.const.js';
import { OverlayShell } from '../dialog/OverlayShell.js';
import { DRAWER_BODY_CLASS, DRAWER_DEFAULT_SIDE } from './drawer.const.js';
import { drawerVariants } from './drawer.variants.js';
import { cn } from '../../lib/cn.js';
import type { DrawerProps } from './drawer.interface.js';

/**
 * Side panel for a sequential form or a filter set.
 *
 * Built on the same modal shell as {@link Dialog} (AIS-117 D3): focus trap,
 * `Esc`, outside dismiss, `aria-modal` and focus restoration are Radix's, the
 * slide-in surface is the `drawerVariants` recipe. The body is the scroll
 * container, so the footer stays reachable in a long form.
 *
 * @param props - see {@link DrawerProps}.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  side = DRAWER_DEFAULT_SIDE,
  footer,
  children,
  closeLabel = DIALOG_CLOSE_LABEL,
  className,
}: DrawerProps) {
  return (
    <OverlayShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      closeLabel={closeLabel}
      contentClassName={cn(drawerVariants({ side }), className)}
      bodyClassName={DRAWER_BODY_CLASS}
    >
      {children}
    </OverlayShell>
  );
}
