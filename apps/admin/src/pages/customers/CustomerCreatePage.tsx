/**
 * `/customers/new` — the create wizard (AIS-19 shell, filled in by AIS-182).
 *
 * The page is a **composition**: the chrome (back link, step strip, cancel), the
 * four step bodies and the one place that turns a step request into a URL write.
 * Everything that can be decided from values lives in `customers-wizard.logic.ts`,
 * everything user-visible in `customers.const.ts`, and the step bodies in `ui/`.
 *
 * State ownership (screen contract §4.2):
 * - the open step is the **URL** (`?step=`), read by `useTabParam`;
 * - the values carried between steps are the **page store** (`D11`), because
 *   react-hook-form seeds `defaultValues` on mount only;
 * - the submitted result is TanStack Query's, never the store's;
 * - which steps the draft already unlocks is **derived** from the draft
 *   (`toReachableStep`), so the store keeps the contract AIS-19 gave it while the
 *   step strip still refuses to jump ahead;
 * - a failed create is page state: only the page may decide which step the
 *   failure belongs to and navigate there (`D8`).
 */

import { Card, FormActions, PageShell, RadioGroup, buttonVariants } from '@callback/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTabParam } from '../../features/api/use-tab-param.js';
import {
  CUSTOMER_TYPE_ERROR_ID,
  CUSTOMER_TYPE_FIELD_ID,
  CUSTOMER_TYPE_OPTIONS,
  CUSTOMER_TYPE_STEP_LEGEND,
  CUSTOMERS_LIST_ROUTE_PATH,
  CUSTOMERS_WIZARD_BACK_LABEL,
  CUSTOMERS_WIZARD_CANCEL_LABEL,
  CUSTOMERS_WIZARD_DEFAULT_STEP,
  CUSTOMERS_WIZARD_NEXT_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_STEP_PARAM,
  CUSTOMERS_WIZARD_SUBTITLE,
  CUSTOMERS_WIZARD_TITLE,
  CUSTOMERS_WIZARD_TYPE_REQUIRED,
  CUSTOMER_WIZARD_STEP_VALUES,
} from './customers.const.js';
import type {
  CustomerTypeStepProps,
  CustomerWizardScreenProps,
  CustomerWizardServerError,
  CustomerWizardShellProps,
} from './customers.interface.js';
import {
  CustomersWizardStoreProvider,
  useCustomersWizardStore,
} from './customers-wizard.provider.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';
import {
  canLeaveStep,
  nextStep,
  previousStep,
  toReachableStep,
  toWizardServerError,
} from './customers-wizard.logic.js';
import { toCustomerType } from './customers.logic.js';
import { CustomerAddressStep } from './ui/CustomerAddressStep.js';
import { CustomerNameStep } from './ui/CustomerNameStep.js';
import { CustomerReviewStep } from './ui/CustomerReviewStep.js';
import { CustomerWizardStepper } from './ui/CustomerWizardStepper.js';

/**
 * Step 1's body: the customer type.
 *
 * A controlled `RadioGroup` rather than a `useAppForm`: the primitive owns the
 * selection and has no `register`-able input, so a form wrapper would only add a
 * resolver without a field. The step still validates before it leaves — through
 * the **same** `canLeaveStep` the step strip uses, so the rule has one definition.
 *
 * @param props - see {@link CustomerTypeStepProps}.
 */
function CustomerTypeStep({ onNext }: CustomerTypeStepProps) {
  const draft = useCustomersWizardStore((state) => state.draft);
  const setDraft = useCustomersWizardStore((state) => state.setDraft);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!canLeaveStep(draft, '1')) {
      setError(CUSTOMERS_WIZARD_TYPE_REQUIRED);

      return;
    }

    setError(null);
    onNext();
  };

  return (
    <Card title={CUSTOMERS_WIZARD_STEP_TITLES['1']}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <RadioGroup
          name={CUSTOMER_TYPE_FIELD_ID}
          legend={CUSTOMER_TYPE_STEP_LEGEND}
          options={CUSTOMER_TYPE_OPTIONS}
          value={draft.type ?? ''}
          invalid={error !== null}
          describedBy={error === null ? undefined : CUSTOMER_TYPE_ERROR_ID}
          onChange={(value) => {
            const type = toCustomerType(value);

            if (type !== undefined) {
              setDraft({ type });
              setError(null);
            }
          }}
        />

        {error === null ? null : (
          <p
            id={CUSTOMER_TYPE_ERROR_ID}
            role="alert"
            className="text-sm text-danger"
          >
            {error}
          </p>
        )}

        <FormActions submitLabel={CUSTOMERS_WIZARD_NEXT_LABEL} />
      </form>
    </Card>
  );
}

/**
 * The chrome of the wizard: back link, step strip, the active step and cancel.
 *
 * @param props - see {@link CustomerWizardShellProps}.
 */
function CustomerWizardShell({
  activeStep,
  reachableStep,
  onStepChange,
  children,
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
          reachableStep={reachableStep}
          onStepChange={onStepChange}
        />
        {children}
      </div>
    </PageShell>
  );
}

/**
 * The stateful part of the wizard, mounted inside its store provider.
 *
 * Owns the four navigation handlers and the one piece of page state: the failure
 * a create returned. A rejection that names an input (`409`/`422`) navigates to
 * the step that renders it and hands the raw error down, where `useAppForm` maps
 * it; a failure no input can fix stays on the review step.
 *
 * @param props - see {@link CustomerWizardScreenProps}.
 */
function CustomerWizardScreen({
  activeStep,
  onStepChange,
}: CustomerWizardScreenProps) {
  const draft = useCustomersWizardStore((state) => state.draft);
  const storeStep = useCustomersWizardStore((state) => state.step);
  const setStep = useCustomersWizardStore((state) => state.setStep);
  const [serverError, setServerError] =
    useState<CustomerWizardServerError | null>(null);

  // The URL owns the step; this only mirrors it into the store (AIS-19). An
  // effect, not a render-time write: mutating a store while rendering is a side
  // effect React must not see.
  useEffect(() => {
    if (storeStep !== activeStep) {
      setStep(activeStep);
    }
  }, [storeStep, activeStep, setStep]);

  const reachableStep = toReachableStep(draft);

  /**
   * Performs one URL write and forgets the previous step's failure.
   *
   * @param step - the step to show.
   */
  const goTo = (step: CustomerWizardStep): void => {
    setServerError(null);
    onStepChange(step);
  };

  const goNext = (): void => {
    const next = nextStep(activeStep);

    if (next !== null) {
      goTo(next);
    }
  };

  const goBack = (): void => {
    const previous = previousStep(activeStep);

    if (previous !== null) {
      goTo(previous);
    }
  };

  const handleServerError = (error: unknown): void => {
    const routing = toWizardServerError(error);

    setServerError(routing);

    if (routing.step !== activeStep) {
      onStepChange(routing.step);
    }
  };

  const serverErrorForStep =
    serverError !== null && serverError.step === activeStep
      ? serverError.error
      : undefined;

  const renderStep = () => {
    switch (activeStep) {
      case '1':
        return <CustomerTypeStep onNext={goNext} />;
      case '2':
        return (
          <CustomerNameStep
            onNext={goNext}
            onBack={goBack}
            serverError={serverErrorForStep}
          />
        );
      case '3':
        return (
          <CustomerAddressStep
            onNext={goNext}
            onBack={goBack}
            serverError={serverErrorForStep}
          />
        );
      case '4':
        return (
          <CustomerReviewStep
            onBack={goBack}
            onRestart={() => {
              goTo(CUSTOMERS_WIZARD_DEFAULT_STEP);
            }}
            onServerError={handleServerError}
            serverError={serverErrorForStep}
          />
        );
    }
  };

  return (
    <CustomerWizardShell
      activeStep={activeStep}
      reachableStep={reachableStep}
      onStepChange={goTo}
    >
      {renderStep()}
    </CustomerWizardShell>
  );
}

/**
 * @returns the wizard, wrapped in its page store provider.
 */
export function CustomerCreatePage() {
  const { value: activeStep, setValue: setActiveStep } = useTabParam({
    paramName: CUSTOMERS_WIZARD_STEP_PARAM,
    allowed: CUSTOMER_WIZARD_STEP_VALUES,
    fallback: CUSTOMERS_WIZARD_DEFAULT_STEP,
  });

  return (
    <CustomersWizardStoreProvider initialStep={activeStep}>
      <CustomerWizardScreen
        activeStep={activeStep}
        onStepChange={setActiveStep}
      />
    </CustomersWizardStoreProvider>
  );
}
