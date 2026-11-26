/**
 * The step strip of the create wizard (AIS-19; gating added by AIS-182).
 *
 * A labelled `<nav>` of `Button`s — **not** a new `packages/ui` primitive: a tab
 * or step strip is not a shared visual concept until a second page needs it
 * (screen contract §3.1). The active step is marked with `aria-current="step"`,
 * which is what assistive technology needs; the `primary` variant is the visual
 * half of the same signal, so the state is never colour-only either.
 *
 * A step the draft does not unlock yet renders `disabled`: the strip may only
 * jump up to `reachableStep`, because a later body would show inputs whose
 * predecessors are still empty (and a `?step=4` deep link would offer a submit
 * the contract would refuse). `disabled` also carries the “not available” signal
 * to assistive technology, so no second `aria-disabled` is added.
 */

import { Button } from '@callback/ui';
import {
  CUSTOMERS_WIZARD_STEPPER_LABEL,
  CUSTOMERS_WIZARD_STEPS,
  CUSTOMER_WIZARD_STEP_VALUES,
} from '../customers.const.js';
import type { CustomerWizardStepperProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerWizardStepperProps}.
 */
export function CustomerWizardStepper({
  activeStep,
  reachableStep,
  onStepChange,
}: CustomerWizardStepperProps) {
  const reachableIndex = CUSTOMER_WIZARD_STEP_VALUES.indexOf(reachableStep);

  return (
    <nav aria-label={CUSTOMERS_WIZARD_STEPPER_LABEL}>
      <ol className="flex flex-wrap items-center gap-2">
        {CUSTOMERS_WIZARD_STEPS.map((definition, index) => {
          const isActive = definition.step === activeStep;
          const isReachable = index <= reachableIndex;

          return (
            <li key={definition.step}>
              <Button
                type="button"
                size="sm"
                variant={isActive ? 'primary' : 'ghost'}
                aria-current={isActive ? 'step' : undefined}
                disabled={!isReachable}
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
