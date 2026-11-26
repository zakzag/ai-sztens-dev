/**
 * Tests of the wizard's step strip (AIS-19, gating added by AIS-182).
 *
 * Two facts matter: the active step is announced as `aria-current="step"`, and a
 * step the draft does not unlock is `disabled` — the strip may only jump up to
 * `reachableStep`, never ahead of the data.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_STEPPER_LABEL,
} from '../customers.const.js';
import type { CustomerWizardStep } from '../customers-wizard.interface.js';
import { CustomerWizardStepper } from './CustomerWizardStepper.js';

/**
 * @param reachableStep - the last step the draft unlocks.
 * @param onStepChange - the callback under assertion.
 * @returns the rendered strip.
 */
function renderStepper(
  reachableStep: CustomerWizardStep,
  onStepChange: (step: CustomerWizardStep) => void = () => undefined,
) {
  return render(
    <CustomerWizardStepper
      activeStep="1"
      reachableStep={reachableStep}
      onStepChange={onStepChange}
    />,
  );
}

describe('CustomerWizardStepper', () => {
  it('renders every step inside one labelled navigation landmark', () => {
    renderStepper('1');

    expect(
      screen.getByRole('navigation', { name: CUSTOMERS_WIZARD_STEPPER_LABEL }),
    ).toBeInTheDocument();

    for (const title of Object.values(CUSTOMERS_WIZARD_STEP_TITLES)) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
  });

  it('marks the active step with aria-current', () => {
    renderStepper('1');

    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    ).toHaveAttribute('aria-current', 'step');
    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    ).not.toHaveAttribute('aria-current');
  });

  it('disables every step beyond the one the draft unlocks', () => {
    renderStepper('1');

    expect(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['1'] }),
    ).toBeEnabled();

    for (const step of ['2', '3', '4'] as const) {
      expect(
        screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES[step] }),
      ).toBeDisabled();
    }
  });

  it('leaves every step enabled once the draft is complete', () => {
    renderStepper('4');

    for (const step of ['1', '2', '3', '4'] as const) {
      expect(
        screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES[step] }),
      ).toBeEnabled();
    }
  });

  it('reports the requested step', async () => {
    const onStepChange = vi.fn();

    renderStepper('2', onStepChange);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['2'] }),
    );

    expect(onStepChange).toHaveBeenCalledWith('2');
  });

  it('does not report a step the draft does not unlock', async () => {
    const onStepChange = vi.fn();

    renderStepper('1', onStepChange);

    await userEvent.click(
      screen.getByRole('button', { name: CUSTOMERS_WIZARD_STEP_TITLES['3'] }),
    );

    expect(onStepChange).not.toHaveBeenCalled();
  });
});
