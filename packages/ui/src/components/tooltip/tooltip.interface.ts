import type { ReactNode } from 'react';

/** Edge of the trigger the tooltip panel is placed on. */
export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Props of {@link Tooltip}.
 *
 * A tooltip is **supplementary** information (AIS-117 D7): its content is wired
 * as `aria-describedby`, never as the accessible name. A control whose only
 * description lives in a tooltip is unlabelled, so the trigger must already have
 * a name of its own.
 */
export interface TooltipProps {
  readonly content: ReactNode;
  /** The trigger element; it keeps its own accessible name. */
  readonly children: ReactNode;
  /** Defaults to `top`. */
  readonly side?: TooltipSide;
  /** Defaults to `TOOLTIP_DEFAULT_DELAY_MS`. */
  readonly delayMs?: number;
  /** Renders the trigger alone, with no tooltip behaviour at all. */
  readonly disabled?: boolean;
}
