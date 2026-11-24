/**
 * The step strip of the create wizard (AIS-19).
 *
 * A labelled `<nav>` of `Button`s — **not** a new `packages/ui` primitive: a tab
 * or step strip is not a shared visual concept until a second page needs it
 * (screen contract §3.1). The active step is marked with `aria-current="step"`,
 * which is what assistive technology needs; the `primary` variant is the visual
 * half of the same signal, so the state is never colour-only either.
 */

import { Button } from '@callback/ui';
import { CUSTOMERS_WIZARD_STEPPER_LABEL, CUSTOMERS_WIZARD_STEPS } from '../customers.const.js';
import type { CustomerWizardStepperProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerWizardStepperProps}.
 */
export function CustomerWizardStepper({
  activeStep,
  onStepChange,
}: CustomerWizardStepperProps) {
  return (
    <nav aria-label={CUSTOMERS_WIZARD_STEPPER_LABEL}>
      <ol className="flex flex-wrap items-center gap-2">
        {CUSTOMERS_WIZARD_STEPS.map((definition) => {
          const isActive = definition.step === activeStep;

          return (
            <li key={definition.step}>
              <Button
                type="button"
                size="sm"
                variant={isActive ? 'primary' : 'ghost'}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => {
                  onStepChange(definition.step);
                }}
              >
                {definition.title}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
