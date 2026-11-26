import { radioVariants } from './radio-group.variants.js';
import { nextOptionValue, toRadioId } from './radio-group.logic.js';
import { cn } from '../../lib/cn.js';
import type { RadioGroupProps } from './radio-group.interface.js';

const KEY_DIRECTIONS = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
} as const;

/**
 * Grouped radio buttons rendered from an option list.
 *
 * A `<fieldset>` + `<legend>` names the group for screen readers. Arrow keys
 * move the selection through the pure {@link nextOptionValue} helper; the
 * platform still owns focus movement, so the two never fight over it.
 *
 * @param props - see {@link RadioGroupProps}.
 */
export function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  orientation = 'vertical',
  invalid = false,
  describedBy,
  disabled = false,
}: RadioGroupProps) {
  return (
    <fieldset
      className="space-y-2"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <legend className="text-sm font-medium text-text-secondary">
        {legend}
      </legend>
      <div
        className={
          orientation === 'horizontal'
            ? 'flex flex-wrap gap-4'
            : 'flex flex-col gap-2'
        }
      >
        {options.map((option) => {
          const optionId = toRadioId(name, option.value);

          return (
            <div key={option.value} className="flex items-start gap-2">
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                onKeyDown={(event) => {
                  const direction =
                    KEY_DIRECTIONS[event.key as keyof typeof KEY_DIRECTIONS];

                  if (!direction) {
                    return;
                  }

                  const nextValue = nextOptionValue(options, value, direction);

                  if (nextValue !== null) {
                    event.preventDefault();
                    onChange(nextValue);
                  }
                }}
                className={cn(radioVariants({ invalid }))}
              />
              <label htmlFor={optionId} className="text-sm text-text-secondary">
                {option.icon ? (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="shrink-0">
                      {option.icon}
                    </span>
                    <span>{option.label}</span>
                  </span>
                ) : (
                  option.label
                )}
                {option.description ? (
                  <span className="block text-xs text-text-muted">
                    {option.description}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
