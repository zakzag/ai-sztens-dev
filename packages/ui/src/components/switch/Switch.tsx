import { forwardRef } from 'react';
import { switchTrackVariants } from './switch.variants.js';
import { cn } from '../../lib/cn.js';
import type { SwitchProps } from './switch.interface.js';

/**
 * Toggle switch built on a native checkbox with `role="switch"`.
 *
 * The input is visually hidden but still focusable and registerable, so
 * keyboard handling (Space), form serialisation and react-hook-form all keep
 * working without a single line of JavaScript state. The visible track is a
 * sibling styled through `peer-*` variants.
 *
 * @param props - see {@link SwitchProps}.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { id, label, description, describedBy, checked, ...rest },
  ref,
) {
  return (
    <div className="flex items-start gap-2">
      <input
        {...rest}
        ref={ref}
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={typeof checked === 'boolean' ? checked : undefined}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span aria-hidden="true" className={cn(switchTrackVariants())} />
      <label htmlFor={id} className="text-sm text-text-secondary">
        {label}
        {description ? (
          <span className="block text-xs text-text-muted">{description}</span>
        ) : null}
      </label>
    </div>
  );
});
