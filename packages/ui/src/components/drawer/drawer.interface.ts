import type { ReactNode } from 'react';
import type { DrawerSide } from './drawer.variants.js';

/**
 * Props of {@link Drawer}.
 *
 * A drawer is a **modal** side panel (a sequential form, a filter set), so it
 * carries the same contract as `Dialog`: controlled `open`, accessible title,
 * focus trap and `Esc` dismiss (AIS-117 D3). It is deliberately not built on
 * Radix `Popover`, which is non-modal and would silently drop all of that.
 */
export interface DrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** Defaults to `DRAWER_DEFAULT_SIDE`. */
  readonly side?: DrawerSide;
  /** Sticky action row under the scrollable body. */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  /** Defaults to `DIALOG_CLOSE_LABEL`. */
  readonly closeLabel?: string;
  readonly className?: string;
}
