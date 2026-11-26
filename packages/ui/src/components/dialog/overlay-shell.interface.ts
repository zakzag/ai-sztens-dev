import type { ReactNode } from 'react';

/**
 * Props of the internal `OverlayShell`.
 *
 * The shell is the single place where Radix's modal markup lives: portal,
 * backdrop, content, title, description, close button, body slot and footer
 * slot. `Dialog` and `Drawer` differ only in the class recipe handed in as
 * `contentClassName`, which is why the shell is not exported from the package
 * index — it is an implementation detail, not an API.
 */
export interface OverlayShellProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /**
   * Extra control rendered in the header **before** the title block (AIS-155).
   *
   * Kept empty unless a feature really needs a header action: the standard
   * overlay has exactly one header control, the close `X`.
   */
  readonly headerStart?: ReactNode;
  /**
   * Extra control rendered in the header **before** the close `X` (AIS-155).
   *
   * The `X` is always the last control of the header, so the two series of
   * overlays never drift on where the close button sits.
   */
  readonly headerEnd?: ReactNode;
  /** Action row rendered under the body; the caller owns the buttons. */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  /** Accessible name of the close control. */
  readonly closeLabel: string;
  /** Positioning + surface recipe of the panel (`dialog` or `drawer`). */
  readonly contentClassName: string;
  /** Extra classes for the scrollable body area. */
  readonly bodyClassName?: string;
}
