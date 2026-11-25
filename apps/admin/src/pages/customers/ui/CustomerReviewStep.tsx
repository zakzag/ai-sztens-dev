/**
 * Step 4 of the create wizard — *Ellenőrzés* (AIS-182).
 *
 * The read-only summary of the draft plus the wizard's **only** write: one
 * `POST /api/admin/customers` (`D-W6`). Everything else is deliberately absent —
 * no contact step, no `felelős operátor`, no tags (screen contract §4.4) — so a
 * successful submit cannot leave a half-created customer behind.
 *
 * Three decisions are worth keeping:
 *
 * - the step **owns the write and the jump**: after the row exists, the store is
 *   reset, the success toast is announced through the notification port, and the
 *   operator lands on `/customers/:id?tab=contacts`, where the first contact is
 *   added with its own dialog. The mutation hook itself never navigates
 *   (`react.coding-standards.md` §2);
 * - a rejection is **reported to the page**, not swallowed: only the page may
 *   navigate to the step a `409`/`422` blames (`D8`). What comes back here is the
 *   failure that has to stay on this step (a `5xx`), rendered as a residue
 *   `Alert` next to the submit;
 * - an **incomplete draft** (reachable only through a hand-written `?step=4`)
 *   renders the warning instead of the submit: sending it would fail validation
 *   the client can already see.
 */

import { useNotifier } from '@callback/notifications/react';
import { Alert, Button, Card, DescriptionList, FormActions } from '@callback/ui';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CUSTOMERS_CREATE_SUCCESS_MESSAGE } from '../../../features/customers/customers.const.js';
import { useCreateCustomerMutation } from '../../../features/customers/use-create-customer.js';
import { toErrorMessage } from '../../../lib/error-message.js';
import {
  CUSTOMERS_WIZARD_BACK_STEP_LABEL,
  CUSTOMERS_WIZARD_FORM_ERROR_TITLE,
  CUSTOMERS_WIZARD_INCOMPLETE_DESCRIPTION,
  CUSTOMERS_WIZARD_INCOMPLETE_TITLE,
  CUSTOMERS_WIZARD_RESTART_LABEL,
  CUSTOMERS_WIZARD_STEP_TITLES,
  CUSTOMERS_WIZARD_SUBMIT_LABEL,
  toCustomerTabRoute,
} from '../customers.const.js';
import type { CustomerReviewStepProps } from '../customers.interface.js';
import { useCustomersWizardStore } from '../customers-wizard.provider.js';
import {
  isDraftComplete,
  toCreateCustomerPayload,
  toWizardSummary,
} from '../customers-wizard.logic.js';

/**
 * @param props - see {@link CustomerReviewStepProps}.
 */
export function CustomerReviewStep({
  onBack,
  onRestart,
  onServerError,
  serverError,
}: CustomerReviewStepProps) {
  const navigate = useNavigate();
  const notify = useNotifier();
  const draft = useCustomersWizardStore((state) => state.draft);
  const reset = useCustomersWizardStore((state) => state.reset);
  const { createCustomer, isPending } = useCreateCustomerMutation();

  const isComplete = isDraftComplete(draft);
  const errorText = serverError === undefined ? null : toErrorMessage(serverError);

  /**
   * Sends the draft and leaves the wizard on success.
   *
   * A rejection is handed to the page — including `CustomersWizardIncompleteError`
   * from the payload builder, which is a wiring mistake rather than user input —
   * so the page can route it to the step that owns the blamed input.
   *
   * @param event - the form submit event; always prevented.
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    try {
      const created = await createCustomer(toCreateCustomerPayload(draft));

      notify.success(CUSTOMERS_CREATE_SUCCESS_MESSAGE);
      reset();
      navigate(toCustomerTabRoute(created.id, 'contacts'));
    } catch (error) {
      onServerError(error);
    }
  };

  return (
    <Card title={CUSTOMERS_WIZARD_STEP_TITLES['4']}>
      <form className="space-y-6" onSubmit={submit} noValidate>
        <DescriptionList items={toWizardSummary(draft)} columns={2} />

        {errorText === null ? null : (
          <Alert variant="danger" title={CUSTOMERS_WIZARD_FORM_ERROR_TITLE}>
            {errorText}
          </Alert>
        )}

        {isComplete ? (
          <FormActions
            submitLabel={CUSTOMERS_WIZARD_SUBMIT_LABEL}
            cancelLabel={CUSTOMERS_WIZARD_BACK_STEP_LABEL}
            onCancel={onBack}
            isSubmitting={isPending}
          />
        ) : (
          <div className="space-y-3">
            <Alert variant="warning" title={CUSTOMERS_WIZARD_INCOMPLETE_TITLE}>
              {CUSTOMERS_WIZARD_INCOMPLETE_DESCRIPTION}
            </Alert>
            <Button type="button" variant="secondary" onClick={onRestart}>
              {CUSTOMERS_WIZARD_RESTART_LABEL}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
