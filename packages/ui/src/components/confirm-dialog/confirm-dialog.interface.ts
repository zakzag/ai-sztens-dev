/**
 * Visual tone of the confirm button.
 *
 * Both values are `Button` variants, so the recipe is never re-implemented here.
 * `danger` is the default because the component exists for destructive
 * decisions; a non-destructive confirmation can opt into `primary`.
 */
export type ConfirmDialogTone = 'danger' | 'primary';

/**
 * Props of {@link ConfirmDialog}.
 *
 * The component returns the user's decision and nothing else (AIS-117 D4):
 * `onConfirm` fires when the confirm button is pressed, everything that
 * dismisses the dialog (cancel, `Esc`, outside click) calls
 * `onOpenChange(false)`. Navigation, toasts and mutations belong to the caller.
 */
export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** Required on purpose: a generic "OK" label is meaningless in a destructive flow. */
  readonly confirmLabel: string;
  /** Defaults to `CONFIRM_DIALOG_CANCEL_LABEL`. */
  readonly cancelLabel?: string;
  /** Defaults to `CONFIRM_DIALOG_DEFAULT_TONE`. */
  readonly tone?: ConfirmDialogTone;
  /** Disables both buttons, marks the confirm button `aria-busy` and blocks dismissal. */
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
}
