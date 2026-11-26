import type { ReactNode } from 'react';
import type { DialogSize } from './dialog.variants.js';

/**
 * Props of {@link Dialog}.
 *
 * The dialog is **controlled only** (`open` is required): the page store or the
 * feature hook stays the single owner of "is it open", so no component can hold
 * a second copy of that state. `title` is required because a dialog without an
 * accessible name is unusable with a screen reader.
 */
export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** Action row under the body; the caller owns the buttons (AIS-117 D11). */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly size?: DialogSize;
  /** Defaults to `DIALOG_CLOSE_LABEL`. */
  readonly closeLabel?: string;
  readonly className?: string;
}
