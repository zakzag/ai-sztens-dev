import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  TOOLTIP_DEFAULT_DELAY_MS,
  TOOLTIP_SIDE_OFFSET,
} from './tooltip.const.js';
import { tooltipVariants } from './tooltip.variants.js';
import type { TooltipProps } from './tooltip.interface.js';

/**
 * Supplementary text shown next to a control on hover and on focus.
 *
 * AIS-117 D6: the component carries **its own** `Tooltip.Provider` (delay from
 * `TOOLTIP_DEFAULT_DELAY_MS`), so a consumer cannot forget the provider and end
 * up with a silently dead tooltip. A shared app-level provider with a
 * `skipDelayDuration` is an additive change for later.
 *
 * AIS-117 D7: Radix links the panel to the trigger through `aria-describedby`,
 * so the trigger keeps its own accessible name — a tooltip never replaces a
 * label.
 *
 * @param props - see {@link TooltipProps}.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delayMs = TOOLTIP_DEFAULT_DELAY_MS,
  disabled = false,
}: TooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={delayMs}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={TOOLTIP_SIDE_OFFSET}
            className={tooltipVariants()}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
