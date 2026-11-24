/**
 * `/customers/new` — the create wizard's **shell** (AIS-19).
 *
 * AIS-19 owns the route, the page store, the provider, the step strip and the
 * first step's body; AIS-182 fills in steps 2–4 and the submit (`D-W5`). The
 * shell is deliberately not an empty placeholder: step 1 renders and writes into
 * the store, which is what makes the store a real consumer in the very change
 * that installs `zustand` — an unused store would fail the dead-code gate.
 *
 * State ownership (screen contract §4.2):
 * - the open step is the **URL** (`?step=`), read by `useTabParam`;
 * - the values carried between steps are the **page store** (`D11`), because
 *   react-hook-form seeds `defaultValues` on mount only;
 * - the submitted result will be TanStack Query's, never the store's.
 */

import { Card, PageShell, RadioGroup, buttonVariants } from '@callback/ui';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTabParam } from '../../features/api/use-tab-param.js';
import {
  CUSTOMER_TYPE_FIELD_ID,
  CUSTOMER_TYPE_OPTIONS,
  CUSTOMER_TYPE_STEP_LEGEND,
  CUSTOMERS_LIST_ROUTE_PATH,
  CUSTOMERS_WIZARD_BACK_LABEL,
  CUSTOMERS_WIZARD_CANCEL_LABEL,
  CUSTOMERS_WIZARD_DEFAULT_STEP,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_STEP_PARAM,
  CUSTOMERS_WIZARD_SUBTITLE,
  CUSTOMERS_WIZARD_TITLE,
  CUSTOMER_WIZARD_STEP_VALUES,
} from './customers.const.js';
import {
  CustomersWizardStoreProvider,
  useCustomersWizardStore,
} from './customers-wizard.provider.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';
import type { CustomerWizardShellProps } from './customers.interface.js';
import { toCustomerType } from './customers.logic.js';
import { CustomerWizardStepper } from './ui/CustomerWizardStepper.js';

/**
 * Step 1's body: the customer type.
 *
 * Reads and writes the store directly, so the choice survives a trip to another
 * step and back — which is exactly the reason the page has a store at all.
 * Validation of the step is AIS-182's (`canLeaveStep`), so this body only
 * records the value.
 *
 * @returns the type chooser inside a `Card`.
 */
function CustomerTypeStep() {
  const draft = useCustomersWizardStore((state) => state.draft);
  const setDraft = useCustomersWizardStore((state) => state.setDraft);

  return (
    <Card title={CUSTOMERS_WIZARD_STEP_TITLES['1']}>
      <RadioGroup
        name={CUSTOMER_TYPE_FIELD_ID}
        legend={CUSTOMER_TYPE_STEP_LEGEND}
        options={CUSTOMER_TYPE_OPTIONS}
        value={draft.type ?? ''}
        onChange={(value) => {
          const type = toCustomerType(value);

          if (type !== undefined) {
            setDraft({ type });
          }
        }}
      />
    </Card>
  );
}

/**
 * Keeps the store's `step` in step with the URL.
 *
 * A separate component because the write has to happen inside the provider,
 * where the store exists — and an effect, not a render-time write: mutating a
 * store while rendering is a side effect React must not see.
 *
 * @param props - the step the URL currently shows.
 */
function CustomerWizardStepMirror({
  step,
}: {
  readonly step: CustomerWizardStep;
}) {
  const storeStep = useCustomersWizardStore((state) => state.step);
  const setStep = useCustomersWizardStore((state) => state.setStep);

  useEffect(() => {
    if (storeStep !== step) {
      setStep(step);
    }
  }, [storeStep, step, setStep]);

  return null;
}

/**
 * The chrome of the wizard: back link, step strip, the active step and cancel.
 *
 * @param props - see {@link CustomerWizardShellProps}.
 */
function CustomerWizardShell({
  activeStep,
  onStepChange,
}: CustomerWizardShellProps) {
  const navigate = useNavigate();
  const reset = useCustomersWizardStore((state) => state.reset);

  const handleCancel = (): void => {
    // A draft must not outlive the wizard, and `navigate` (never `history.back`)
    // keeps a deep link from leaving the app.
    reset();
    navigate(CUSTOMERS_LIST_ROUTE_PATH);
  };

  return (
    <PageShell
      title={CUSTOMERS_WIZARD_TITLE}
      subtitle={CUSTOMERS_WIZARD_SUBTITLE}
      back={
        <Link
          to={CUSTOMERS_LIST_ROUTE_PATH}
          className="text-sm text-text-secondary underline-offset-4 hover:underline"
        >
          {CUSTOMERS_WIZARD_BACK_LABEL}
        </Link>
      }
      actions={
        <button
          type="button"
          className={buttonVariants({ variant: 'ghost' })}
          onClick={handleCancel}
        >
          {CUSTOMERS_WIZARD_CANCEL_LABEL}
        </button>
      }
    >
      <div className="space-y-6">
        <CustomerWizardStepper
          activeStep={activeStep}
          onStepChange={onStepChange}
        />
        <CustomerTypeStep />
      </div>
    </PageShell>
  );
}

/**
 * @returns the wizard shell, wrapped in its page store provider.
 */
export function CustomerCreatePage() {
  const { value: activeStep, setValue: setActiveStep } = useTabParam({
    paramName: CUSTOMERS_WIZARD_STEP_PARAM,
    allowed: CUSTOMER_WIZARD_STEP_VALUES,
    fallback: CUSTOMERS_WIZARD_DEFAULT_STEP,
  });

  return (
    <CustomersWizardStoreProvider initialStep={activeStep}>
      <CustomerWizardStepMirror step={activeStep} />
      <CustomerWizardShell
        activeStep={activeStep}
        onStepChange={setActiveStep}
      />
    </CustomersWizardStoreProvider>
  );
}
