import type { ReactNode } from 'react';

/**
 * Description of the overlay's submit button (AIS-155).
 *
 * The button is deliberately **not** rendered inside the form: the form belongs
 * to the caller (react-hook-form owns the values), and the footer is a sibling
 * of the body. The `form` attribute of the HTML button bridges the two, so the
 * footer submit still runs the form's own `onSubmit` — no second submit path is
 * created, and the pending state stays the form's.
 */
export interface EntityDialogSubmit {
  /** Visible label of the submit button, e.g. "Létrehozás". */
  readonly label: string;
  /** `id` of the `<form>` element rendered inside the body. */
  readonly formId: string;
  /** Label shown while the request is in flight; defaults to {@link label}. */
  readonly pendingLabel?: string;
  /** Disables the button and turns it into a spinner (`aria-busy`). */
  readonly isSubmitting?: boolean;
}

/**
 * Props of {@link EntityDialog}.
 *
 * There is **no `open` prop on purpose** (AIS-155 `D5`): the overlay is a route
 * element, so it is mounted exactly while its URL matches — the URL is the only
 * owner of "is it open". Radix's `Esc`, the backdrop click and the header `X`
 * all funnel into {@link onClose}, which the page implements as "go back to the
 * list".
 *
 * With `submit` omitted the window is **read-only**: only the dismiss button is
 * rendered, which is how a view-only entity is shown (AIS-155 `D4`).
 */
export interface EntityDialogProps {
  /** Dialog title — the accessible name of the window, so it is required. */
  readonly title: string;
  /** One-line subtitle under the title. */
  readonly description?: string;
  /** Called by `Esc`, the backdrop, the `X` and the dismiss button. */
  readonly onClose: () => void;
  /** The body content; the caller decides layout and scroll behaviour. */
  readonly children: ReactNode;
  /** Submit description, or `null`/omitted for a read-only window. */
  readonly submit?: EntityDialogSubmit | null;
  /** Dismiss label; defaults to `ENTITY_DIALOG_CANCEL_LABEL`. */
  readonly cancelLabel?: string;
  /** Extra control before the title block in the header. */
  readonly headerStart?: ReactNode;
  /** Extra control before the close `X` in the header. */
  readonly headerEnd?: ReactNode;
  /** Extra actions on the **left** side of the footer (e.g. a destructive link). */
  readonly footerExtras?: ReactNode;
  /** Accessible name of the close control; defaults to `DIALOG_CLOSE_LABEL`. */
  readonly closeLabel?: string;
  /** Extra classes for the panel. */
  readonly className?: string;
}
