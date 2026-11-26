import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { Button } from '../button/Button.js';
import { CloseIcon } from '../icon/icons.js';
import { cn } from '../../lib/cn.js';
import { dialogOverlayVariants } from './dialog.variants.js';
import type { OverlayShellProps } from './overlay-shell.interface.js';

/**
 * The one place where the modal markup lives.
 *
 * `Dialog` and `Drawer` differ only in the class recipe they pass as
 * `contentClassName`; everything else — portal, backdrop, title, description,
 * close control, body and footer slots — is identical, so it lives here instead
 * of twice in two components (DRY).
 *
 * Radix owns every behaviour the ticket asks for: focus trap, `Esc`, outside
 * dismiss, `aria-modal`, and returning focus to the trigger on close. Radix also
 * derives `aria-labelledby` from the rendered `Title` and `aria-describedby`
 * from the `Description`, which is why this component never passes an id.
 *
 * @param props - see {@link OverlayShellProps}.
 */
export function OverlayShell({
  open,
  onOpenChange,
  title,
  description,
  headerStart,
  headerEnd,
  footer,
  children,
  closeLabel,
  contentClassName,
  bodyClassName,
}: OverlayShellProps) {
  /**
   * The element the dialog has to return focus to.
   *
   * Radix restores focus only when it opened the dialog itself through
   * `Dialog.Trigger`; our API opens the dialog from wherever the caller put the
   * button (a table row, a toolbar), so there is no trigger to remember. The
   * element is captured in the *mount* focus event, which Radix fires before it
   * moves focus into the panel — at that moment `document.activeElement` is
   * still the caller's control.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const handleOpenAutoFocus = (): void => {
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement ? active : null;
  };

  const handleCloseAutoFocus = (event: Event): void => {
    const target = returnFocusRef.current;

    if (target === null || !target.isConnected) {
      return;
    }

    event.preventDefault();
    target.focus();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={dialogOverlayVariants()} />
        <DialogPrimitive.Content
          className={contentClassName}
          aria-modal="true"
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              {headerStart === undefined ? null : headerStart}
              <div className="space-y-1">
                <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
                  {title}
                </DialogPrimitive.Title>
                {description === undefined ? null : (
                  <DialogPrimitive.Description className="text-sm text-text-secondary">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerEnd === undefined ? null : headerEnd}
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={closeLabel}
                  icon={<CloseIcon />}
                />
              </DialogPrimitive.Close>
            </div>
          </div>
          {children === undefined ? null : (
            <div className={cn('text-sm text-text-primary', bodyClassName)}>
              {children}
            </div>
          )}
          {footer === undefined ? null : (
            <div className="flex justify-end gap-2">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
