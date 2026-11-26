import { Button } from '../button/Button.js';
import { DIALOG_CLOSE_LABEL } from '../dialog/dialog.const.js';
import { dialogVariants } from '../dialog/dialog.variants.js';
import { OverlayShell } from '../dialog/OverlayShell.js';
import { cn } from '../../lib/cn.js';
import {
  ENTITY_DIALOG_ACTIONS_CLASS,
  ENTITY_DIALOG_BODY_CLASS,
  ENTITY_DIALOG_CANCEL_LABEL,
  ENTITY_DIALOG_FOOTER_CLASS,
} from './entity-dialog.const.js';
import type {
  EntityDialogProps,
  EntityDialogSubmit,
} from './entity-dialog.interface.js';

/**
 * The standard entity window: a route-mounted overlay above the list (AIS-155).
 *
 * It is a **presentational** component: it imports no router, knows no entity,
 * and receives every text and handler as a prop. The page passes the title, the
 * body (the form or the read-only fields) and the submit description; the
 * overlay supplies the frame, the close control and the footer.
 *
 * Behaviour that comes for free from {@link OverlayShell} (Radix): focus trap,
 * `Esc`, outside dismiss, `aria-modal`, and focus returned to the element that
 * opened the window. All of them call {@link EntityDialogProps.onClose}, so a
 * page has exactly one way out — the one that navigates back to the list.
 *
 * The panel is `size="fit"` (as large as the content, never larger than the
 * viewport) and its body is the scroll container, so the header and the footer
 * stay visible with a long form.
 *
 * @param props - see {@link EntityDialogProps}.
 * @returns the overlay, portalled above the page.
 */
export function EntityDialog({
  title,
  description,
  onClose,
  children,
  submit,
  cancelLabel = ENTITY_DIALOG_CANCEL_LABEL,
  headerStart,
  headerEnd,
  footerExtras,
  closeLabel = DIALOG_CLOSE_LABEL,
  className,
}: EntityDialogProps) {
  const isSubmitting = submit?.isSubmitting === true;

  const footer = (
    <div className={ENTITY_DIALOG_FOOTER_CLASS}>
      {footerExtras ?? null}
      <div className={ENTITY_DIALOG_ACTIONS_CLASS}>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        {submit === undefined || submit === null ? null : (
          <EntityDialogSubmitButton submit={submit} />
        )}
      </div>
    </div>
  );

  return (
    <OverlayShell
      open
      onOpenChange={(next) => {
        // Radix reports `false` for Esc and the backdrop; there is no other
        // reason to open, because the URL owns visibility.
        if (!next) {
          onClose();
        }
      }}
      title={title}
      description={description}
      headerStart={headerStart}
      headerEnd={headerEnd}
      footer={footer}
      closeLabel={closeLabel}
      contentClassName={cn(dialogVariants({ size: 'fit' }), className)}
      bodyClassName={ENTITY_DIALOG_BODY_CLASS}
    >
      {children}
    </OverlayShell>
  );
}

/** Props of {@link EntityDialogSubmitButton}. */
interface EntityDialogSubmitButtonProps {
  /** The description of the submit action the overlay renders. */
  readonly submit: EntityDialogSubmit;
}

/**
 * The footer submit button of the overlay.
 *
 * It carries `type="submit"` and the `form` attribute instead of living inside
 * the form: the body holds the form (the caller's `useAppForm`), the footer is
 * a sibling of the body, and the attribute is the one supported way to submit
 * across that boundary without a second submit path.
 *
 * @param props - see {@link EntityDialogSubmitButtonProps}.
 * @returns the submit button, spinner included while the request is in flight.
 */
function EntityDialogSubmitButton({ submit }: EntityDialogSubmitButtonProps) {
  const isSubmitting = submit.isSubmitting === true;
  const label = isSubmitting ? (submit.pendingLabel ?? submit.label) : submit.label;

  return (
    <Button type="submit" form={submit.formId} isLoading={isSubmitting}>
      {label}
    </Button>
  );
}
